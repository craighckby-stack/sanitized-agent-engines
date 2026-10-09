/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Cherry Studio Autonomous Agent Runtime Engine — ReAct Agent Loop
 * Source Origin: CherryHQ/cherry-studio
 */

export class cherryStudioAgentLoopEngine {
  private stepBudget: number;
  private trajectory: Array<{ step: number; input: any; output: any; error?: any }> = [];

  constructor(maxSteps: number = 20) {
    this.stepBudget = maxSteps;
  }

  async execute(
    initialInput: any,
    stepFn: (input: any, step: number) => Promise<any>,
    onStep?: (step: number, input: any, output: any) => void
  ): Promise<any> {
    let currentInput = initialInput;
    let step = 0;

    while (step < this.stepBudget) {
      try {
        const output = await stepFn(currentInput, step);
        
        this.trajectory.push({ step, input: currentInput, output });
        onStep?.(step, currentInput, output);
        
        // Check for completion condition
        if (this.isComplete(output)) {
          return output;
        }
        
        currentInput = output;
        step++;
      } catch (error) {
        this.trajectory.push({ step, input: currentInput, error });
        throw error;
      }
    }
    
    throw new Error(`Agent loop exceeded step budget of ${this.stepBudget}`);
  }

  private isComplete(output: any): boolean {
    // Simple completion check - can be customized
    return output?.status === 'completed' || 
           output?.finishReason === 'stop' ||
           (typeof output === 'string' && output.includes('[DONE]'));
  }

  getTrajectory(): Array<{ step: number; input: any; output: any; error?: any }> {
    return [...this.trajectory];
  }

  reset(): void {
    this.trajectory = [];
  }
}
