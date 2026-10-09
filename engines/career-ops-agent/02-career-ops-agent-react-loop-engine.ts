/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Career Ops Autonomous Agent Engine — ReAct Agent Loop
 * Source Origin: career-ops-hq/career-ops
 */

import { AgentStep, AgentTrajectory } from './types';

class CareerOpsAgentLoopEngine {
  private stepBudget: number;
  private trajectory: AgentStep[] = [];
  
  constructor(stepBudget: number = 50) {
    this.stepBudget = stepBudget;
  }
  
  /** Execute a single ReAct step */
  async executeStep(
    context: any,
    stepFn: (context: any, step: AgentStep) => Promise<AgentStep>
  ): Promise<AgentStep> {
    if (this.trajectory.length >= this.stepBudget) {
      throw new Error(`Step budget exceeded (${this.stepBudget} steps)`);
    }
    
    const step: AgentStep = {
      id: this.trajectory.length + 1,
      timestamp: Date.now(),
      context: { ...context },
      input: null,
      output: null,
      error: null
    };
    
    try {
      const result = await stepFn(context, step);
      step.output = result;
      this.trajectory.push(step);
      return result;
    } catch (error) {
      step.error = error instanceof Error ? error.message : String(error);
      this.trajectory.push(step);
      throw error;
    }
  }
  
  /** Get the current agent trajectory */
  getTrajectory(): AgentTrajectory {
    return {
      steps: [...this.trajectory],
      totalSteps: this.trajectory.length,
      budgetRemaining: this.stepBudget - this.trajectory.length
    };
  }
  
  /** Reset the agent loop */
  reset(): void {
    this.trajectory = [];
  }
}
