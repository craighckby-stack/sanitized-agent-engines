/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AutoGPTRuntimeEngine ReAct Loop Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

export class AutoGPTRuntimeEngineAgentLoopEngine {
  constructor(
    private ctx: AutoGPTRuntimeEngineLifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: { maxSteps: number }
  ) {}

  public async executeTask(prompt: string) {
    this.session.initRoot('You are an autonomous engineering agent.');
    this.session.appendMessage({ role: 'user', content: prompt });
    const trajectory: any[] = [];
    let stepNumber = 0;

    while (stepNumber < this.config.maxSteps) {
      stepNumber++;
      const stepCtx = this.ctx.extend('step');
      await this.ctx.emit('step:before', { stepNumber, prompt });

      const history = this.session.getLinearHistory();
      const stream = this.modelAdapter.generateStream(history, this.sandbox.getTools());
      let thought = '', text = '', pendingTools: any[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'thought_chunk') thought += chunk.deltaThought;
        if (chunk.type === 'text_chunk') text += chunk.deltaText;
        if (chunk.type === 'tool_call') pendingTools.push(chunk.toolCall);
      }

      this.session.appendMessage({ role: 'assistant', content: text, thought });
      const toolResults = [];
      for (const tc of pendingTools) {
        const res = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
        toolResults.push(res);
        this.session.appendMessage({ role: 'tool', content: res.output });
      }

      const stepRecord = { stepNumber, thought, modelOutput: text, toolCalls: pendingTools, toolResults };
      trajectory.push(stepRecord);
      await this.ctx.emit('step:after', stepRecord);
      await stepCtx.dispose();

      if (pendingTools.length === 0) return { status: 'completed', trajectory, finalOutput: text };
    }
    return { status: 'max_steps_exceeded', trajectory };
  }
}
