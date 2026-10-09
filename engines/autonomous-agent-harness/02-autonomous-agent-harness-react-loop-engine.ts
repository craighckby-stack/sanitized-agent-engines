/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Autonomous Agent Harness Engine — ReAct Agent Loop
 * Source Origin: zhayujie/CowAgent
 */

import { AgentState, ToolResult } from './types';

/**
 * ReAct Agent Loop Engine - Multi-turn loop with step budget and trajectory tracking
 */
export class autonomousAgentHarnessAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Array<{
    step: number;
    action: string;
    observation?: string;
    result?: ToolResult;
    error?: string;
  }> = [];

  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }

  /**
   * Execute the ReAct loop with the given agent and query
   */
  async run(
    agent: any,
    query: string,
    onStep?: (step: number, action: string, observation?: string) => void
  ): Promise<{ result: string; trajectory: any[] }> {
    this.trajectory = [];
    let step = 0;
    let state: AgentState = {
      messages: [{ role: 'user', content: query }],
      currentStep: 0,
      maxSteps: this.maxSteps,
    };

    while (step < this.maxSteps) {
      step++;
      state.currentStep = step;

      // Get agent action (thought or tool call)
      const action = await agent.generateAction(state);
      this.trajectory.push({ step, action });
      onStep?.(step, action);

      if (this.isActionComplete(action)) {
        break;
      }

      // Execute tool if needed
      if (this.isToolAction(action)) {
        try {
          const toolResult = await agent.executeTool(action);
          this.trajectory[this.trajectory.length - 1].result = toolResult;
          onStep?.(step, 'tool_result', toolResult.content);
          
          // Update state with tool result
          state.messages.push({
            role: 'tool',
            content: toolResult.content,
            toolCallId: toolResult.toolCallId,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.trajectory[this.trajectory.length - 1].error = errorMsg;
          onStep?.(step, 'error', errorMsg);
          
          state.messages.push({
            role: 'error',
            content: errorMsg,
          });
        }
      }
    }

    // Generate final response
    const finalResponse = await agent.generateResponse(state);
    return {
      result: finalResponse,
      trajectory: this.trajectory,
    };
  }

  private isActionComplete(action: string): boolean {
    return action.toLowerCase().includes('finish') || 
           action.toLowerCase().includes('conclude');
  }

  private isToolAction(action: string): boolean {
    return action.toLowerCase().includes('use tool') || 
           action.toLowerCase().includes('call tool');
  }

  /**
   * Get the execution trajectory
   */
  getTrajectory() {
    return [...this.trajectory];
  }

  /**
   * Reset the engine state
   */
  reset() {
    this.trajectory = [];
  }
}
