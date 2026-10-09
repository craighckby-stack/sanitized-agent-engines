/* GLM-Engine-Harvester [2026-10-09T02:43:52.629Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Agent Reach Autonomous Internet Explorer Engine — ReAct Agent Loop
 * Source Origin: Panniantong/Agent-Reach
 */

class AgentReachLoopEngine {
  private context: AgentReachLifecycleContext;
  private stepBudget: number;
  private trajectory: any[] = [];

  constructor(context: AgentReachLifecycleContext, stepBudget: number = 20) {
    this.context = context;
    this.stepBudget = stepBudget;
  }

  async executeAgentLoop(initialPrompt: string) {
    let currentStep = 0;
    let currentThought = initialPrompt;
    
    while (currentStep < this.stepBudget) {
      // Step 1: Generate thought and actions
      const { thought, actions } = await this.generateThoughtAndActions(currentThought);
      
      // Step 2: Execute actions
      const results = await this.executeActions(actions);
      
      // Step 3: Process results and update thought
      currentThought = await this.processResults(thought, results);
      
      // Record step
      this.trajectory.push({
        step: currentStep,
        thought,
        actions,
        results,
        finalThought: currentThought
      });
      
      // Check for completion
      if (this.isComplete(currentThought)) {
        break;
      }
      
      currentStep++;
    }
    
    return {
      finalThought: currentThought,
      trajectory: this.trajectory,
      steps: currentStep
    };
  }

  private async generateThoughtAndActions(thought: string) {
    const modelAdapter = this.context.getService<ModelAdapter>('modelAdapter');
    return await modelAdapter.generateThoughtAndActions(thought);
  }

  private async executeActions(actions: any[]) {
    const results: any[] = [];
    
    for (const action of actions) {
      const toolSandbox = this.context.getService<ToolSandbox>('toolSandbox');
      const result = await toolSandbox.executeAction(action);
      results.push(result);
    }
    
    return results;
  }

  private async processResults(thought: string, results: any[]) {
    const modelAdapter = this.context.getService<ModelAdapter>('modelAdapter');
    return await modelAdapter.processResults(thought, results);
  }

  private isComplete(thought: string): boolean {
    // Simple completion check - can be enhanced
    return thought.toLowerCase().includes('task complete') || 
           thought.toLowerCase().includes('finished');
  }
}
