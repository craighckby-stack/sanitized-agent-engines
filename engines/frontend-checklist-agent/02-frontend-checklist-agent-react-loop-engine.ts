/* GLM-Engine-Harvester [2026-10-09T03:30:29.651Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Frontend Checklist Agent Engine — ReAct Agent Loop
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistAgentLoop {
  private stepBudget: number;
  private trajectory: Array<{step: string, output: any}> = [];

  constructor(maxSteps: number = 20) {
    this.stepBudget = maxSteps;
  }

  /** Execute the main agent loop with step budgeting */
  async executeLoop(
    initialState: any,
    processStep: (state: any, step: number) => Promise<any>,
    shouldContinue: (state: any) => boolean
  ): Promise<any> {
    let currentState = initialState;
    let step = 0;

    while (step < this.stepBudget && shouldContinue(currentState)) {
      const stepResult = await processStep(currentState, step);
      
      this.trajectory.push({
        step: `Step ${step}`,
        output: stepResult
      });
      
      currentState = stepResult;
      step++;
    }

    return currentState;
  }

  /** Get the execution trajectory */
  getTrajectory() {
    return this.trajectory;
  }

  /** Reset the loop state */
  reset() {
    this.trajectory = [];
    this.stepBudget = 20;
  }
}
