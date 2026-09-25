/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * langgraph Non-Linear Session Tree & Token Budget Engine
 * Source Origin: langchain-ai/langgraph
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  thought?: string;
  toolCallId?: string;
  timestamp: number;
}

export interface SessionTreeNode {
  id: string;
  parentId: string | null;
  message: SessionMessage;
  children: string[];
}

export class langgraphSessionTreeEngine {
  private nodes = new Map<string, SessionTreeNode>();
  private activeLeafId: string | null = null;
  private rootId: string | null = null;

  public initRoot(systemPrompt: string): string {
    this.nodes.clear();
    const rootMessage: SessionMessage = {
      id: 'msg_root',
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    };
    const rootNode: SessionTreeNode = {
      id: 'node_root',
      parentId: null,
      message: rootMessage,
      children: [],
    };
    this.nodes.set(rootNode.id, rootNode);
    this.rootId = rootNode.id;
    this.activeLeafId = rootNode.id;
    return rootNode.id;
  }

  public appendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): string {
    const id = `msg_${Math.random().toString(36).substring(2, 9)}`;
    const fullMsg: SessionMessage = {
      ...msg,
      id,
      timestamp: Date.now(),
    };
    const nodeId = `node_${Math.random().toString(36).substring(2, 9)}`;
    const parentId = this.activeLeafId;

    const node: SessionTreeNode = {
      id: nodeId,
      parentId,
      message: fullMsg,
      children: [],
    };

    if (parentId && this.nodes.has(parentId)) {
      this.nodes.get(parentId)!.children.push(nodeId);
    }

    this.nodes.set(nodeId, node);
    this.activeLeafId = nodeId;
    return nodeId;
  }

  public getLinearHistory(): SessionMessage[] {
    const history: SessionMessage[] = [];
    let currentId = this.activeLeafId;

    while (currentId && this.nodes.has(currentId)) {
      const node = this.nodes.get(currentId)!;
      history.unshift(node.message);
      currentId = node.parentId;
    }

    return history;
  }

  public forkBranch(fromNodeId: string): void {
    if (!this.nodes.has(fromNodeId)) {
      throw new Error(`Cannot fork from non-existent node: '${fromNodeId}'`);
    }
    this.activeLeafId = fromNodeId;
  }

  public computeTokenBudget(maxTokens = 8192): { currentTokens: number; remainingTokens: number; isWithinBudget: boolean } {
    const history = this.getLinearHistory();
    let totalChars = 0;
    for (const m of history) {
      totalChars += m.content.length + (m.thought ? m.thought.length : 0);
    }
    const currentTokens = Math.ceil(totalChars / 4);
    const remainingTokens = Math.max(0, maxTokens - currentTokens);
    return {
      currentTokens,
      remainingTokens,
      isWithinBudget: currentTokens <= maxTokens,
    };
  }
}
