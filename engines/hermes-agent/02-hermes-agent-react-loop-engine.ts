/* GLM-Engine-Harvester [2026-10-09T02:42:13.566Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Hermes Autonomous Agent Runtime Engine — ReAct Agent Loop
 * Source Origin: NousResearch/hermes-agent
 */

import { hermesLifecycleContext } from './lifecycle';

class hermesAgentLoopEngine {
  private stepBudget: number;
  private trajectory: any[] = [];
  
  constructor(
    private context: hermesLifecycleContext,
    private modelAdapter: any,
    private toolSandbox: any,
    private maxSteps: number = 20
  ) {
    this.stepBudget = maxSteps;
  }
  
  async run(initialPrompt: string): Promise<any> {
    this.trajectory = [];
    this.stepBudget = this.maxSteps;
    
    let currentThought = initialPrompt;
    let lastAction = null;
    
    while (this.stepBudget > 0) {
      this.stepBudget--;
      
      // Generate thought and action
      const response = await this.modelAdapter.generate(
        currentThought,
        lastAction ? this.formatAction(lastAction) : null
      );
      
      this.trajectory.push({
        step: this.maxSteps - this.stepBudget,
        thought: currentThought,
        response
      });
      
      // Parse action if present
      if (response.action) {
        try {
          const actionResult = await this.toolSandbox.execute(response.action);
          lastAction = {
            action: response.action,
            result: actionResult
          };
          
          currentThought = response.thought + '\nAction result: ' + actionResult;
        } catch (error) {
          currentThought = response.thought + '\nAction failed: ' + error;
        }
      } else {
        // No more actions, return final response
        return response;
      }
    }
    
    throw new Error('Max steps exceeded without completion');
  }
  
  private formatAction(action: any): string {
    return `Action: ${JSON.stringify(action)}`;
  }
  
  getTrajectory(): any[] {
    return [...this.trajectory];
  }
}
