// --- AgentRuntimeEngine ---
type Message = { role: 'user' | 'assistant' | 'system'; content: string };

class AgentRuntimeEngine {
  private history: Message[] = [];
  private name: string;
  private systemPrompt: string;

  constructor(name: string, systemPrompt: string) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.history.push({ role: 'system', content: systemPrompt });
  }

  public async process(input: string): Promise<string> {
    this.history.push({ role: 'user', content: input });
    
    // Simulated LLM inference step
    const response = await this.mockInference(this.history);
    
    this.history.push({ role: 'assistant', content: response });
    return response;
  }

  private async mockInference(history: Message[]): Promise<string> {
    return `Agent ${this.name} processed ${history.length} turns and generated a completion.`;
  }

  public getHistory(): Message[] {
    return [...this.history];
  }
}

// --- OrchestrationWorkflowEngine ---
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

// --- StateSerializationEngine ---
interface SerializedState {
  agentName: string;
  history: { role: string; content: string }[];
}

class StateSerializationEngine {
  public static serialize(agent: AgentRuntimeEngine): string {
    const state: SerializedState = {
      agentName: "AgentInstance",
      history: agent.getHistory()
    };
    return JSON.stringify(state);
  }

  public static deserialize(json: string): SerializedState {
    try {
      return JSON.parse(json) as SerializedState;
    } catch (e) {
      throw new Error("Failed to restore agent state: Invalid format.");
    }
  }
}