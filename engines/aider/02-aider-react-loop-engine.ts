/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * aider ReAct Loop Engine
 * Source Origin: Aider-AI/aider
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

export interface aiderLifecycleContext {
  extend(scope: string): aiderLifecycleContext;
  emit(event: string, payload?: unknown): Promise<void> | void;
  dispose(): Promise<void> | void;
  [key: string]: unknown;
}

export interface StreamChunk {
  type: 'thought_chunk' | 'text_chunk' | 'tool_call' | string;
  deltaThought?: string;
  deltaText?: string;
  toolCall?: ToolCall;
  [key: string]: unknown;
}

export interface ModelAdapter {
  generateStream(history: unknown[], tools: unknown[]): AsyncIterable<StreamChunk> | Promise<AsyncIterable<StreamChunk>>;
  [key: string]: unknown;
}

export interface SandboxEnvironment {
  getTools(): unknown[];
  executeToolCall(id: string, name: string, args: Record<string, unknown>): Promise<ToolResult> | ToolResult;
  [key: string]: unknown;
}

export interface SessionManager {
  initRoot(systemPrompt: string): void;
  appendMessage(message: { role: string; content: string; thought?: string; toolCallId?: string; [key: string]: unknown }): void;
  getLinearHistory(): unknown[];
  [key: string]: unknown;
}

export interface AiderAgentLoopConfig {
  maxSteps?: number;
  maxStagnantSteps?: number;
}

export class aiderAgentLoopEngine {
  constructor(
    private ctx: aiderLifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: { maxSteps?: number; maxStagnantSteps?: number } = {}
  ) {}

  private safeSerializeArgs(args: Record<string, unknown>): string {
    try {
      const seen = new WeakSet();
      return JSON.stringify(args, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      });
    } catch {
      return Object.prototype.toString.call(args);
    }
  }

  private safeEmit(event: string, payload?: unknown): Promise<void> {
    try {
      if (this.ctx && typeof this.ctx.emit === 'function') {
        const res = this.ctx.emit(event, payload);
        return Promise.resolve(res).catch((err) => {
          console.error(`[aiderAgentLoopEngine] Error emitting event "${event}":`, err);
        });
      }
    } catch (err) {
      console.error(`[aiderAgentLoopEngine] Synchronous error emitting event "${event}":`, err);
    }
    return Promise.resolve();
  }

  public async executeTask(prompt: string): Promise<{
    status: 'completed' | 'max_steps_exceeded' | 'stagnation_detected' | 'error';
    trajectory: StepRecord[];
    finalOutput: string;
  }> {
    const rawMaxSteps = Number(this.config?.maxSteps);
    const maxSteps = Number.isFinite(rawMaxSteps) && rawMaxSteps > 0 ? Math.floor(rawMaxSteps) : 10;

    const rawMaxStagnant = Number(this.config?.maxStagnantSteps);
    const maxStagnant = Number.isFinite(rawMaxStagnant) && rawMaxStagnant > 0 ? Math.floor(rawMaxStagnant) : 3;

    const trajectory: StepRecord[] = [];
    const normalizedPrompt = typeof prompt === 'string' ? prompt : String(prompt ?? '');

    try {
      if (this.session && typeof this.session.initRoot === 'function') {
        this.session.initRoot('You are an autonomous systems engineering agent.');
      }
      if (this.session && typeof this.session.appendMessage === 'function') {
        this.session.appendMessage({ role: 'user', content: normalizedPrompt });
      }

      let stepNumber = 0;
      let consecutiveSameTools = 0;
      let lastToolSignature = '';

      while (stepNumber < maxSteps) {
        stepNumber++;
        const stepStartTime = Date.now();
        const stepCtx: aiderLifecycleContext =
          this.ctx && typeof this.ctx.extend === 'function'
            ? this.ctx.extend('step')
            : {
                extend: () => stepCtx,
                emit: () => Promise.resolve(),
                dispose: () => Promise.resolve(),
              };

        let stepDisposed = false;
        const disposeStepCtx = async () => {
          if (!stepDisposed) {
            stepDisposed = true;
            try {
              if (stepCtx && typeof stepCtx.dispose === 'function') {
                await Promise.resolve(stepCtx.dispose());
              }
            } catch (disposeErr) {
              console.error('[aiderAgentLoopEngine] Error disposing step context:', disposeErr);
            }
          }
        };

        try {
          await this.safeEmit('step:before', { stepNumber, prompt: normalizedPrompt });

          const history =
            this.session && typeof this.session.getLinearHistory === 'function'
              ? this.session.getLinearHistory()
              : [];
          const tools =
            this.sandbox && typeof this.sandbox.getTools === 'function'
              ? this.sandbox.getTools()
              : [];

          if (!this.modelAdapter || typeof this.modelAdapter.generateStream !== 'function') {
            throw new Error('Invalid modelAdapter: generateStream method is required.');
          }

          const stream = await Promise.resolve(this.modelAdapter.generateStream(history, tools));

          let thought = '';
          let text = '';
          const pendingTools: ToolCall[] = [];

          if (stream && typeof (stream as any)[Symbol.asyncIterator] === 'function') {
            for await (const chunk of stream) {
              if (!chunk || typeof chunk !== 'object') {
                continue;
              }
              if (chunk.type === 'thought_chunk' && typeof chunk.deltaThought === 'string') {
                thought += chunk.deltaThought;
              } else if (chunk.type === 'text_chunk' && typeof chunk.deltaText === 'string') {
                text += chunk.deltaText;
              } else if (chunk.type === 'tool_call' && chunk.toolCall && typeof chunk.toolCall === 'object') {
                const tc = chunk.toolCall as ToolCall;
                pendingTools.push({
                  id: String(tc.id ?? `tool_${Date.now()}_${pendingTools.length}`),
                  name: String(tc.name ?? 'unknown_tool'),
                  args: (tc.args && typeof tc.args === 'object') ? tc.args : {},
                });
              }
            }
          }

          if (this.session && typeof this.session.appendMessage === 'function') {
            this.session.appendMessage({ role: 'assistant', content: text, thought });
          }

          // Execute tool calls
          const toolResults: ToolResult[] = [];
          for (const tc of pendingTools) {
            await this.safeEmit('tool:invoke:before', tc);
            const callStart = Date.now();
            let result: ToolResult;

            try {
              if (this.sandbox && typeof this.sandbox.executeToolCall === 'function') {
                result = await Promise.resolve(this.sandbox.executeToolCall(tc.id, tc.name, tc.args));
                if (!result || typeof result !== 'object') {
                  result = {
                    toolCallId: tc.id,
                    name: tc.name,
                    output: String(result ?? ''),
                    isError: false,
                    durationMs: Date.now() - callStart,
                  };
                }
              } else {
                result = {
                  toolCallId: tc.id,
                  name: tc.name,
                  output: 'Sandbox execution environment unavailable.',
                  isError: true,
                  durationMs: Date.now() - callStart,
                };
              }
            } catch (toolExecErr) {
              const errorMessage = toolExecErr instanceof Error ? toolExecErr.message : String(toolExecErr);
              result = {
                toolCallId: tc.id,
                name: tc.name,
                output: `Tool execution failed: ${errorMessage}`,
                isError: true,
                durationMs: Date.now() - callStart,
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
          await disposeStepCtx();

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
            .map((t) => `${t.name}:${this.safeSerializeArgs(t.args)}`)
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
        } catch (stepError) {
          await disposeStepCtx();
          throw stepError;
        }
      }

      return {
        status: 'max_steps_exceeded',
        trajectory,
        finalOutput: trajectory[trajectory.length - 1]?.modelOutput || 'Step limit reached.',
      };
    } catch (fatalError) {
      const errorMessage = fatalError instanceof Error ? fatalError.message : String(fatalError);
      await this.safeEmit('error', { error: errorMessage, trajectory });

      return {
        status: 'error',
        trajectory,
        finalOutput: `Fatal error in agent execution: ${errorMessage}`,
      };
    }
  }
}