/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * siyuan ReAct Loop Engine
 * Source Origin: siyuan-note/siyuan
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

export class siyuanAgentLoopEngine {
  constructor(
    private ctx: siyuanLifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: { maxSteps?: number; maxStagnantSteps?: number } = {}
  ) {}

  public async executeTask(prompt: string): Promise<{
    status: 'completed' | 'max_steps_exceeded' | 'stagnation_detected' | 'error';
    trajectory: StepRecord[];
    finalOutput: string;
  }> {
    const maxSteps = this.config.maxSteps || 10;
    const maxStagnant = this.config.maxStagnantSteps || 3;
    const trajectory: StepRecord[] = [];

    this.session.initRoot('You are an autonomous systems engineering agent.');
    this.session.appendMessage({ role: 'user', content: prompt });

    let stepNumber = 0;
    let consecutiveSameTools = 0;
    let lastToolSignature = '';

    while (stepNumber < maxSteps) {
      stepNumber++;
      const stepStartTime = Date.now();
      const stepCtx = this.ctx.extend('step');

      await this.ctx.emit('step:before', { stepNumber, prompt });

      const history = this.session.getLinearHistory();
      const tools = this.sandbox.getTools();
      const stream = this.modelAdapter.generateStream(history, tools);

      let thought = '';
      let text = '';
      const pendingTools: ToolCall[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'thought_chunk' && chunk.deltaThought) {
          thought += chunk.deltaThought;
        } else if (chunk.type === 'text_chunk' && chunk.deltaText) {
          text += chunk.deltaText;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          pendingTools.push(chunk.toolCall);
        }
      }

      this.session.appendMessage({ role: 'assistant', content: text, thought });

      // Execute tool calls
      const toolResults: ToolResult[] = [];
      for (const tc of pendingTools) {
        await this.ctx.emit('tool:invoke:before', tc);
        const result = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
        toolResults.push(result);
        await this.ctx.emit('tool:invoke:after', result);

        this.session.appendMessage({
          role: 'tool',
          content: result.output,
          toolCallId: tc.id,
        });
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
      await this.ctx.emit('step:after', stepRecord);
      await stepCtx.dispose();

      // Check loop completion
      if (pendingTools.length === 0) {
        return {
          status: 'completed',
          trajectory,
          finalOutput: text,
        };
      }

      // Stagnation detection
      const currentSignature = pendingTools.map((t) => `${t.name}:${JSON.stringify(t.args)}`).join('|');
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
    }

    return {
      status: 'max_steps_exceeded',
      trajectory,
      finalOutput: trajectory[trajectory.length - 1]?.modelOutput || 'Step limit reached.',
    };
  }
}
