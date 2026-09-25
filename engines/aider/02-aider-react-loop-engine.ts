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
  extend(scope: string): { dispose: () => Promise<void> | void };
  emit(event: string, payload: unknown): Promise<void> | void;
}

export interface aiderModelStreamChunk {
  type: 'thought_chunk' | 'text_chunk' | 'tool_call' | string;
  deltaThought?: string;
  deltaText?: string;
  toolCall?: ToolCall;
}

export interface aiderAgentLoopConfig {
  maxSteps?: number;
  maxStagnantSteps?: number;
  timeoutMs?: number;
}

function canonicalizeArgs(args: Record<string, unknown> | undefined): string {
  if (!args || typeof args !== 'object') {
    return String(args);
  }
  try {
    const keys = Object.keys(args).sort();
    const sorted: Record<string, unknown> = {};
    for (const key of keys) {
      sorted[key] = args[key];
    }
    return JSON.stringify(sorted);
  } catch {
    try {
      return JSON.stringify(args);
    } catch {
      return '[Unserializable Args]';
    }
  }
}

export class aiderAgentLoopEngine {
  constructor(
    private ctx: aiderLifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: { maxSteps?: number; maxStagnantSteps?: number; timeoutMs?: number } = {}
  ) {}

  public async executeTask(prompt: string): Promise<{
    status: 'completed' | 'max_steps_exceeded' | 'stagnation_detected' | 'error';
    trajectory: StepRecord[];
    finalOutput: string;
  }> {
    const maxSteps = Math.max(1, Math.min(this.config.maxSteps ?? 10, 100));
    const maxStagnant = Math.max(1, this.config.maxStagnantSteps ?? 3);
    const trajectory: StepRecord[] = [];

    try {
      if (this.session && typeof this.session.initRoot === 'function') {
        this.session.initRoot('You are an autonomous systems engineering agent.');
      }
      if (this.session && typeof this.session.appendMessage === 'function') {
        this.session.appendMessage({ role: 'user', content: prompt });
      }

      let stepNumber = 0;
      let consecutiveSameTools = 0;
      let lastToolSignature = '';

      while (stepNumber < maxSteps) {
        stepNumber++;
        const stepStartTime = Date.now();
        const stepCtx = typeof this.ctx?.extend === 'function'
          ? this.ctx.extend('step')
          : { dispose: async () => {} };

        try {
          if (this.ctx && typeof this.ctx.emit === 'function') {
            await this.ctx.emit('step:before', { stepNumber, prompt });
          }

          const history = typeof this.session?.getLinearHistory === 'function'
            ? this.session.getLinearHistory()
            : [];
          const tools = typeof this.sandbox?.getTools === 'function'
            ? this.sandbox.getTools()
            : [];
          
          if (!this.modelAdapter || typeof this.modelAdapter.generateStream !== 'function') {
            throw new Error('Model adapter does not support generateStream');
          }

          const stream = this.modelAdapter.generateStream(history, tools);

          let thought = '';
          let text = '';
          const pendingTools: ToolCall[] = [];

          if (stream && (Symbol.asyncIterator in stream || Symbol.iterator in stream)) {
            for await (const chunk of stream) {
              if (!chunk) continue;
              if (chunk.type === 'thought_chunk' && typeof chunk.deltaThought === 'string') {
                thought += chunk.deltaThought;
              } else if (chunk.type === 'text_chunk' && typeof chunk.deltaText === 'string') {
                text += chunk.deltaText;
              } else if (chunk.type === 'tool_call' && chunk.toolCall) {
                const tc: ToolCall = {
                  id: String(chunk.toolCall.id || `call_${Date.now()}_${pendingTools.length}`),
                  name: String(chunk.toolCall.name || 'unknown_tool'),
                  args: (chunk.toolCall.args && typeof chunk.toolCall.args === 'object') ? chunk.toolCall.args : {},
                };
                pendingTools.push(tc);
              }
            }
          }

          if (this.session && typeof this.session.appendMessage === 'function') {
            this.session.appendMessage({ role: 'assistant', content: text, thought });
          }

          // Execute tool calls defensively
          const toolResults: ToolResult[] = [];
          for (const tc of pendingTools) {
            const toolStartTime = Date.now();
            if (this.ctx && typeof this.ctx.emit === 'function') {
              await this.ctx.emit('tool:invoke:before', tc);
            }

            let result: ToolResult;
            try {
              if (this.sandbox && typeof this.sandbox.executeToolCall === 'function') {
                result = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
                if (!result || typeof result !== 'object') {
                  result = {
                    toolCallId: tc.id,
                    name: tc.name,
                    output: String(result ?? ''),
                    isError: false,
                    durationMs: Date.now() - toolStartTime,
                  };
                }
              } else {
                result = {
                  toolCallId: tc.id,
                  name: tc.name,
                  output: 'Error: Sandbox executeToolCall handler unavailable',
                  isError: true,
                  durationMs: Date.now() - toolStartTime,
                };
              }
            } catch (toolError: any) {
              result = {
                toolCallId: tc.id,
                name: tc.name,
                output: `Execution error: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                isError: true,
                durationMs: Date.now() - toolStartTime,
              };
            }

            toolResults.push(result);

            if (this.ctx && typeof this.ctx.emit === 'function') {
              await this.ctx.emit('tool:invoke:after', result);
            }

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

          if (this.ctx && typeof this.ctx.emit === 'function') {
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

          // Stagnation detection using canonicalized representation
          const currentSignature = pendingTools
            .map((t) => `${t.name}:${canonicalizeArgs(t.args)}`)
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
        } finally {
          if (stepCtx && typeof stepCtx.dispose === 'function') {
            try {
              await stepCtx.dispose();
            } catch {
              // Ignore step disposal errors
            }
          }
        }
      }

      return {
        status: 'max_steps_exceeded',
        trajectory,
        finalOutput: trajectory[trajectory.length - 1]?.modelOutput || 'Step limit reached.',
      };
    } catch (error: any) {
      if (this.ctx && typeof this.ctx.emit === 'function') {
        try {
          await this.ctx.emit('loop:error', { error: error instanceof Error ? error.message : String(error) });
        } catch {
          // Ignore event emission errors
        }
      }

      return {
        status: 'error',
        trajectory,
        finalOutput: `Execution halted with error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}