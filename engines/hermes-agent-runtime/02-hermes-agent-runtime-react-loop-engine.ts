/* GLM-Engine-Harvester [2026-10-09T02:52:52.183Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Hermes Autonomous Agent Runtime Engine — ReAct Agent Loop
 * Source Origin: NousResearch/hermes-agent
 */

import { AgentState, TrajectoryStep } from './types';

class HermesAgentLoopEngine {
  private maxSteps: number;
  private currentStep: number = 0;
  private trajectory: TrajectoryStep[] = [];
  
  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }
  
  async run(
    initialState: AgentState,
    stepCallback: (step: TrajectoryStep) => Promise<void>,
    terminationCondition?: (state: AgentState) => boolean
  ): Promise<AgentState> {
    let currentState = initialState;
    this.currentStep = 0;
    this.trajectory = [];
    
    while (this.currentStep < this.maxSteps && 
           (!terminationCondition || !terminationCondition(currentState))) {
      
      this.currentStep++;
      
      // Create step record
      const step: TrajectoryStep = {
        stepNumber: this.currentStep,
        timestamp: Date.now(),
        state: { ...currentState },
        action: null,
        observation: null
      };
      
      // Execute step callback (implementation-specific)
      await stepCallback(step);
      
      // Update trajectory
      this.trajectory.push(step);
      
      // Update current state based on step execution
      currentState = this.updateStateFromStep(currentState, step);
    }
    
    return currentState;
  }
  
  private updateStateFromStep(state: AgentState, step: TrajectoryStep): AgentState {
    // Implementation would parse step.action and step.observation
    // to update the agent's state (thoughts, context, etc.)
    return {
      ...state,
      thoughts: [...(state.thoughts || []), step.action?.thought || ''],
      lastAction: step.action,
      lastObservation: step.observation
    };
  }
  
  getTrajectory(): TrajectoryStep[] {
    return [...this.trajectory];
  }
  
  reset(): void {
    this.currentStep = 0;
    this.trajectory = [];
  }
}
