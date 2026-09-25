/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ag2 ReAct Loop Engine
 * Source Origin: ag2ai/ag2
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface ag2LifecycleContext {
  extend(scope: string): { dispose(): Promise<void> | void };
  emit(event: string, payload: unknown): Promise<void> | void;
  [key: string]: unknown;
}

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

export interface ag2LoopConfig {
  maxSteps?: number;
  maxStagnantSteps?: number;
  systemPrompt?: string;
  stepTimeoutMs?: number;
}

function safeSerializeArgs(args: unknown): string {
  if (args === null || args === undefined) return '';
  if (typeof args !== 'object') return String(args);
  try {
    const keys = Object.keys(args as Record<string, unknown>).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const k of keys) {
      sortedObj[k] = (args as Record<string, unknown>)[k];
    }
    return JSON.stringify(sortedObj);
  } catch {
    try {
      return JSON.stringify(args);
    } catch {
      return String(args);
    }
  }
}

export class ag2AgentLoopEngine {
  constructor(
    private ctx: ag2LifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: ag2LoopConfig = {}
  ) {}

  public async executeTask(prompt: string): Promise<{
    status: 'completed' | 'max_steps_exceeded' | 'stagnation_detected' | 'error';
    trajectory: StepRecord[];
    finalOutput: string;
  }> {
    const sanitizedPrompt = typeof prompt === 'string' ? prompt : String(prompt || '');
    const maxSteps = Math.max(1, typeof this.config?.maxSteps === 'number' && Number.isFinite(this.config.maxSteps) ? this.config.maxSteps : 10);
    const maxStagnant = Math.max(1, typeof this.config?.maxStagnantSteps === 'number' && Number.isFinite(this.config.maxStagnantSteps) ? this.config.maxStagnantSteps : 3);
    const systemPrompt = this.config?.systemPrompt || 'You are an autonomous systems engineering agent.';
    const trajectory: StepRecord[] = [];

    try {
      if (typeof this.session?.initRoot === 'function') {
        this.session.initRoot(systemPrompt);
      }
      if (typeof this.session?.appendMessage === 'function') {
        this.session.appendMessage({ role: 'user', content: sanitizedPrompt });
      }
    } catch (sessionInitError: unknown) {
      const errMsg = sessionInitError instanceof Error ? sessionInitError.message : String(sessionInitError);
      await this.ctx?.emit?.('loop:error', { phase: 'init', error: errMsg });
      return {
        status: 'error',
        trajectory,
        finalOutput: `Session initialization failed: ${errMsg}`,
      };
    }

    let stepNumber = 0;
    let consecutiveSameTools = 0;
    let lastToolSignature = '';

    while (stepNumber < maxSteps) {
      stepNumber++;
      const stepStartTime = Date.now();
      const stepCtx = typeof this.ctx?.extend === 'function' ? this.ctx.extend('step') : { dispose: () => {} };

      try {
        if (typeof this.ctx?.emit === 'function') {
          await this.ctx.emit('step:before', { stepNumber, prompt: sanitizedPrompt });
        }

        const history = typeof this.session?.getLinearHistory === 'function' ? this.session.getLinearHistory() : [];
        const tools = typeof this.sandbox?.getTools === 'function' ? this.sandbox.getTools() : [];

        if (!this.modelAdapter || typeof this.modelAdapter.generateStream !== 'function') {
          throw new Error('Model adapter does not support generateStream');
        }

        const stream = this.modelAdapter.generateStream(history, tools);

        let thought = '';
        let text = '';
        const pendingTools: ToolCall[] = [];

        for await (const chunk of stream) {
          if (!chunk) continue;
          if (chunk.type === 'thought_chunk' && typeof chunk.deltaThought === 'string') {
            thought += chunk.deltaThought;
          } else if (chunk.type === 'text_chunk' && typeof chunk.deltaText === 'string') {
            text += chunk.deltaText;
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            const tc = chunk.toolCall;
            pendingTools.push({
              id: String(tc.id || `call_${Date.now()}_${pendingTools.length}`),
              name: String(tc.name || 'unknown_tool'),
              args: (tc.args && typeof tc.args === 'object') ? tc.args : {},
            });
          }
        }

        if (typeof this.session?.appendMessage === 'function') {
          this.session.appendMessage({ role: 'assistant', content: text, thought });
        }

        // Execute tool calls defensively
        const toolResults: ToolResult[] = [];
        for (const tc of pendingTools) {
          const toolStartTime = Date.now();
          if (typeof this.ctx?.emit === 'function') {
            await this.ctx.emit('tool:invoke:before', tc);
          }

          let result: ToolResult;
          try {
            if (!this.sandbox || typeof this.sandbox.executeToolCall !== 'function') {
              throw new Error(`Sandbox cannot execute tool: ${tc.name}`);
            }

            const rawResult = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
            result = {
              toolCallId: rawResult?.toolCallId ?? tc.id,
              name: rawResult?.name ?? tc.name,
              output: typeof rawResult?.output === 'string' ? rawResult.output : JSON.stringify(rawResult?.output ?? ''),
              isError: Boolean(rawResult?.isError),
              durationMs: typeof rawResult?.durationMs === 'number' ? rawResult.durationMs : (Date.now() - toolStartTime),
            };
          } catch (toolExecError: unknown) {
            const errStr = toolExecError instanceof Error ? toolExecError.message : String(toolExecError);
            result = {
              toolCallId: tc.id,
              name: tc.name,
              output: `Tool execution failure: ${errStr}`,
              isError: true,
              durationMs: Date.now() - toolStartTime,
            };
          }

          toolResults.push(result);

          if (typeof this.ctx?.emit === 'function') {
            await this.ctx.emit('tool:invoke:after', result);
          }

          if (typeof this.session?.appendMessage === 'function') {
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

        if (typeof this.ctx?.emit === 'function') {
          await this.ctx.emit('step:after', stepRecord);
        }

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
          .map((t) => `${t.name}:${safeSerializeArgs(t.args)}`)
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
      } catch (stepError: unknown) {
        const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
        if (typeof this.ctx?.emit === 'function') {
          await this.ctx.emit('step:error', { stepNumber, error: errorMessage });
        }
        return {
          status: 'error',
          trajectory,
          finalOutput: `Execution terminated on step ${stepNumber}: ${errorMessage}`,
        };
      } finally {
        if (stepCtx && typeof stepCtx.dispose === 'function') {
          try {
            await stepCtx.dispose();
          } catch {
            // Defensive cleanup suppression
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