/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Autonomous Agent Runtime Engine — ReAct Agent Loop
 * Source Origin: NousResearch/hermes-agent
 */

import { AgentState, Thought, Action, Observation } from './types';

/**
 * ReAct Agent Loop Engine - Multi-turn reasoning with step budget and trajectory tracking
 */
export class AutonomousAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Thought[] = [];

  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }

  /** Execute the ReAct loop until completion or step limit */
  async run(
    initialState: AgentState,
    reason: (state: AgentState) => Promise<Thought>,
    act: (thought: Thought) => Promise<Action>,
    observe: (action: Action) => Promise<Observation>
  ): Promise<{ finalState: AgentState; trajectory: Thought[] }> {
    let state = initialState;
    this.trajectory = [];
    
    for (let step = 0; step < this.maxSteps; step++) {
      // Reason step
      const thought = await reason(state);
      this.trajectory.push(thought);
      
      // Act step
      const action = await act(thought);
      
      // Observe step
      const observation = await observe(action);
      
      // Update state
      state = {
        ...state,
        step: step + 1,
        lastAction: action,
        lastObservation: observation,
        thoughts: [...state.thoughts, thought]
      };
      
      // Check for completion
      if (this.isComplete(state)) {
        break;
      }
    }
    
    return { finalState: state, trajectory: this.trajectory };
  }

  /** Check if the agent should stop reasoning */
  private isComplete(state: AgentState): boolean {
    // Check for explicit completion signals
    if (state.lastObservation?.type === 'final_answer') {
      return true;
    }
    
    // Check for terminal errors
    if (state.lastObservation?.type === 'error') {
      return true;
    }
    
    // Check for max steps reached
    if (state.step >= this.maxSteps) {
      return true;
    }
    
    return false;
  }

  /** Get the reasoning trajectory */
  getTrajectory(): Thought[] {
    return [...this.trajectory];
  }

  /** Reset the engine state */
  reset(): void {
    this.trajectory = [];
  }
}
