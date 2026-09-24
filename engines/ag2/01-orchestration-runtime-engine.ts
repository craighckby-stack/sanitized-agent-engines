/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Orchestration Runtime Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

interface Agent {
  name: string;
  process: (messages: Message[]) => Promise<Message>;
}

class OrchestrationRuntimeEngine {
  private history: Message[] = [];
  private agents: Map<string, Agent> = new Map();

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.name, agent);
  }

  public async executeTurn(senderName: string, recipientName: string, content: string): Promise<Message> {
    const message: Message = { role: 'assistant', content, name: senderName };
    this.history.push(message);

    const recipient = this.agents.get(recipientName);
    if (!recipient) throw new Error(`Agent ${recipientName} not found.`);

    const response = await recipient.process(this.history);
    this.history.push(response);
    return response;
  }

  public getHistory(): Message[] {
    return [...this.history];
  }
}
