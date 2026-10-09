/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: AI Agent Book Companion Engine — ReAct Agent Loop
 * Source Origin: bojieli/ai-agent-book
 */

import { AgentStep, Trajectory } from './types';

/**
 * ReAct Agent Loop Engine for the AI Agent Book Companion
 * Handles multi-turn reasoning, step budget management, and trajectory tracking
 */
export class AiAgentBookAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Trajectory = [];
  
  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }
  
  /**
   * Execute the ReAct loop with reasoning, action, and observation steps
   */
  async execute(
    initialPrompt: string,
    reasoningFn: (step: AgentStep) => Promise<string>,
    actionFn: (step: AgentStep) => Promise<string>,
    observationFn: (step: AgentStep) => Promise<string>
  ): Promise<Trajectory> {
    this.trajectory = [];
    let currentStep = 0;
    let currentObservation = '';
    let currentPrompt = initialPrompt;
    
    while (currentStep < this.maxSteps) {
      // Reasoning step
      const reasoningStep: AgentStep = {
        type: 'reasoning',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation
      };
      
      const reasoning = await reasoningFn(reasoningStep);
      this.trajectory.push({
        ...reasoningStep,
        content: reasoning
      });
      
      // Action step
      const actionStep: AgentStep = {
        type: 'action',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation,
        reasoning
      };
      
      const action = await actionFn(actionStep);
      this.trajectory.push({
        ...actionStep,
        content: action
      });
      
      // Observation step
      const observationStep: AgentStep = {
        type: 'observation',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation,
        reasoning,
        action
      };
      
      currentObservation = await observationFn(observationStep);
      this.trajectory.push({
        ...observationStep,
        content: currentObservation
      });
      
      // Check for completion condition
      if (this.isComplete(currentObservation)) {
        break;
      }
      
      currentStep++;
    }
    
    return this.trajectory;
  }
  
  /**
   * Check if the task is complete based on the observation
   */
  private isComplete(observation: string): boolean {
    // Simple heuristic - could be more sophisticated
    return observation.toLowerCase().includes('final answer') || 
           observation.toLowerCase().includes('task complete');
  }
  
  /**
   * Get the current trajectory
   */
  getTrajectory(): Trajectory {
    return [...this.trajectory];
  }
}
