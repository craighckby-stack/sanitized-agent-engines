/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OrchestrationWorkflowEngine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

class OrchestrationWorkflowEngine {
  private agents: Map<string, AgentRuntimeEngine> = new Map();

  public registerAgent(agent: AgentRuntimeEngine, name: string): void {
    this.agents.set(name, agent);
  }

  public async executeTask(
    senderName: string, 
    receiverName: string, 
    task: string, 
    maxTurns: number
  ): Promise<string[]> {
    const results: string[] = [];
    let currentTask = task;

    for (let i = 0; i < maxTurns; i++) {
      const agent = this.agents.get(receiverName);
      if (!agent) throw new Error("Agent not found");

      const response = await agent.process(currentTask);
      results.push(response);
      
      // Workflow logic: pass back to sender
      currentTask = `Review this result: ${response}`;
      receiverName = senderName; 
    }

    return results;
  }
}
