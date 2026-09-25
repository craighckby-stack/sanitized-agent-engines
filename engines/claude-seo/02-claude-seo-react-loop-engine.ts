/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * claude-seo ReAct Loop Engine
 * Source Origin: https://github.com/AgriciDaniel/claude-seo
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface StepRecord {
  stepNumber: number;
  thought: string;
  modelOutput: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  durationMs: number;
}

export interface ClaudeSeoLifecycleContext {
  extend(scope: string): { dispose(): Promise<void> | void } | ClaudeSeoLifecycleContext;
  emit(event: string, payload?: unknown): Promise<void> | void;
  dispose?(): Promise<void> | void;
}

export type claude_seoLifecycleContext = ClaudeSeoLifecycleContext;

export interface ClaudeSeoAgentLoopConfig {
  maxSteps?: number;
  maxStagnantSteps?: number;
  maxToolOutputLength?: number;
  stepTimeoutMs?: number;
  normalizeStagnationArgs?: boolean;
}

export interface ExecuteTaskOptions {
  signal?: AbortSignal;
}

/**
 * Normalizes an unknown argument structure into a deterministic sorted canonical JSON representation
 * to guard against stagnation-detection evasions caused by unordered map keys.
 */
function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return '{' + sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(record[k])}`).join(',') + '}';
}

export class ClaudeSeoAgentLoopEngine {
  private config: Required<ClaudeSeoAgentLoopConfig>;

  constructor(
    private ctx: ClaudeSeoLifecycleContext | any,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    config: ClaudeSeoAgentLoopConfig = {}
  ) {
    this.config = {
      maxSteps: Math.max(1, config.maxSteps ?? 10),
      maxStagnantSteps: Math.max(1, config.maxStagnantSteps ?? 3),
      maxToolOutputLength: Math.max(256, config.maxToolOutputLength ?? 500_000),
      stepTimeoutMs: config.stepTimeoutMs ?? 0,
      normalizeStagnationArgs: config.normalizeStagnationArgs ?? true,
    };
  }

  private async safeEmit(event: string, payload: unknown): Promise<void> {
    if (this.ctx && typeof this.ctx.emit === 'function') {
      try {
        await this.ctx.emit(event, payload);
      } catch (emitErr) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[claude-seoAgentLoopEngine] Warning in lifecycle emit('${event}'):`, emitErr);
        }
      }
    }
  }

  private sanitizeToolOutput(rawOutput: unknown): string {
    let outputStr = '';
    if (typeof rawOutput === 'string') {
      outputStr = rawOutput;
    } else if (rawOutput === null || rawOutput === undefined) {
      outputStr = '';
    } else {
      try {
        outputStr = JSON.stringify(rawOutput, null, 2);
      } catch {
        outputStr = String(rawOutput);
      }
    }

    if (outputStr.length > this.config.maxToolOutputLength) {
      const excess = outputStr.length - this.config.maxToolOutputLength;
      outputStr =
        outputStr.slice(0, this.config.maxToolOutputLength) +
        `\n... [TRUNCATED: ${excess} characters omitted to preserve context bounds]`;
    }
    return outputStr;
  }

  public async executeTask(
    prompt: string,
    options?: ExecuteTaskOptions
  ): Promise<{
    status: 'completed' | 'max_steps_exceeded' | 'stagnation_detected' | 'error';
    trajectory: StepRecord[];
    finalOutput: string;
  }> {
    const maxSteps = this.config.maxSteps;
    const maxStagnant = this.config.maxStagnantSteps;
    const trajectory: StepRecord[] = [];

    if (!prompt || typeof prompt !== 'string') {
      return {
        status: 'error',
        trajectory,
        finalOutput: 'Task execution failed: prompt must be a non-empty string.',
      };
    }

    try {
      if (this.session && typeof this.session.initRoot === 'function') {
        this.session.initRoot('You are an autonomous systems engineering agent.');
      }
      if (this.session && typeof this.session.appendMessage === 'function') {
        this.session.appendMessage({ role: 'user', content: prompt });
      }
    } catch (sessionInitErr: any) {
      return {
        status: 'error',
        trajectory,
        finalOutput: `Session initialization failed: ${sessionInitErr instanceof Error ? sessionInitErr.message : String(sessionInitErr)}`,
      };
    }

    let stepNumber = 0;
    let consecutiveSameTools = 0;
    let lastToolSignature = '';

    while (stepNumber < maxSteps) {
      if (options?.signal?.aborted) {
        return {
          status: 'error',
          trajectory,
          finalOutput: `Task execution aborted by signal: ${options.signal.reason || 'AbortSignal triggered.'}`,
        };
      }

      stepNumber++;
      const stepStartTime = Date.now();
      let stepCtx: any = null;

      if (this.ctx && typeof this.ctx.extend === 'function') {
        try {
          stepCtx = this.ctx.extend('step');
        } catch {
          stepCtx = null;
        }
      }

      try {
        await this.safeEmit('step:before', { stepNumber, prompt });

        const history = this.session && typeof this.session.getLinearHistory === 'function'
          ? this.session.getLinearHistory()
          : [];
        const tools = this.sandbox && typeof this.sandbox.getTools === 'function'
          ? this.sandbox.getTools()
          : [];

        if (!this.modelAdapter || typeof this.modelAdapter.generateStream !== 'function') {
          throw new Error('Model adapter does not implement generateStream(history, tools).');
        }

        const stream = this.modelAdapter.generateStream(history, tools);

        let thought = '';
        let text = '';
        const pendingTools: ToolCall[] = [];

        try {
          for await (const chunk of stream) {
            if (options?.signal?.aborted) {
              throw new Error('AbortSignal triggered during model streaming.');
            }
            if (!chunk || typeof chunk !== 'object') continue;

            if (chunk.type === 'thought_chunk' && typeof chunk.deltaThought === 'string') {
              thought += chunk.deltaThought;
            } else if (chunk.type === 'text_chunk' && typeof chunk.deltaText === 'string') {
              text += chunk.deltaText;
            } else if (chunk.type === 'tool_call' && chunk.toolCall && typeof chunk.toolCall.name === 'string') {
              const tc = chunk.toolCall;
              pendingTools.push({
                id: String(tc.id || `call_${Date.now()}_${pendingTools.length}`),
                name: String(tc.name),
                args: tc.args && typeof tc.args === 'object' ? tc.args : {},
              });
            }
          }
        } catch (streamErr: any) {
          throw new Error(`Inference stream processing failed: ${streamErr instanceof Error ? streamErr.message : String(streamErr)}`);
        }

        if (this.session && typeof this.session.appendMessage === 'function') {
          this.session.appendMessage({ role: 'assistant', content: text, thought });
        }

        // Execute tool calls
        const toolResults: ToolResult[] = [];
        for (const tc of pendingTools) {
          if (options?.signal?.aborted) {
            throw new Error('AbortSignal triggered prior to tool execution.');
          }

          await this.safeEmit('tool:invoke:before', tc);
          const toolExecStart = Date.now();
          let result: ToolResult;

          try {
            if (!this.sandbox || typeof this.sandbox.executeToolCall !== 'function') {
              throw new Error(`Sandbox does not implement executeToolCall for tool '${tc.name}'.`);
            }

            const rawResult = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
            const durationMs = typeof rawResult?.durationMs === 'number'
              ? rawResult.durationMs
              : Date.now() - toolExecStart;

            result = {
              toolCallId: String(rawResult?.toolCallId || tc.id),
              name: String(rawResult?.name || tc.name),
              output: this.sanitizeToolOutput(rawResult?.output ?? rawResult),
              isError: Boolean(rawResult?.isError),
              durationMs,
            };
          } catch (toolError: any) {
            result = {
              toolCallId: tc.id,
              name: tc.name,
              output: `Execution error in '${tc.name}': ${toolError instanceof Error ? toolError.message : String(toolError)}`,
              isError: true,
              durationMs: Date.now() - toolExecStart,
            };
          }

          toolResults.push(result);
          await this.safeEmit('tool:invoke:after', result);

          if (this.session && typeof this.session.appendMessage === 'function') {
            this.session.appendMessage({
              role: 'tool',
              content: result.output,
              toolCallId: tc.id,
            });
          }
        }

        const stepRecord: StepRecord = {
          stepNumber,
          thought,
          modelOutput: text,
          toolCalls: pendingTools,
          toolResults,
          durationMs: Date.now() - stepStartTime,
        };

        trajectory.push(stepRecord);
        await this.safeEmit('step:after', stepRecord);

        // Check loop completion
        if (pendingTools.length === 0) {
          return {
            status: 'completed',
            trajectory,
            finalOutput: text,
          };
        }

        // Stagnation detection
        const currentSignature = pendingTools
          .map((t) => `${t.name}:${this.config.normalizeStagnationArgs ? canonicalizeJson(t.args) : JSON.stringify(t.args)}`)
          .join('|');

        if (currentSignature === lastToolSignature) {
          consecutiveSameTools++;
          if (consecutiveSameTools >= maxStagnant) {
            return {
              status: 'stagnation_detected',
              trajectory,
              finalOutput: `Agent stopped: repeated identical tool calls ${consecutiveSameTools} times without state progress.`,
            };
          }
        } else {
          consecutiveSameTools = 0;
          lastToolSignature = currentSignature;
        }
      } catch (stepErr: any) {
        const errorMsg = stepErr instanceof Error ? stepErr.message : String(stepErr);
        await this.safeEmit('step:error', { stepNumber, error: errorMsg });

        return {
          status: 'error',
          trajectory,
          finalOutput: `Agent loop terminated on step ${stepNumber} with error: ${errorMsg}`,
        };
      } finally {
        if (stepCtx && typeof stepCtx.dispose === 'function') {
          try {
            await stepCtx.dispose();
          } catch (disposeErr) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[claude-seoAgentLoopEngine] Non-critical step context dispose error:', disposeErr);
            }
          }
        }
      }
    }

    return {
      status: 'max_steps_exceeded',
      trajectory,
      finalOutput: trajectory[trajectory.length - 1]?.modelOutput || 'Step limit reached.',
    };
  }
}

export { ClaudeSeoAgentLoopEngine as "claude-seoAgentLoopEngine" };
export { ClaudeSeoAgentLoopEngine as claude_seoAgentLoopEngine };
export default ClaudeSeoAgentLoopEngine;