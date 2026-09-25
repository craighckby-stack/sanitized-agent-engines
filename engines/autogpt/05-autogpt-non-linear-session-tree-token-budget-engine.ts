/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * AutoGPT Non-Linear Session Tree & Token Budget Engine
 * Source Origin: Significant-Gravitas/AutoGPT
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface SessionMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'tool' | 'system';
  readonly content: string;
  readonly thought?: string;
  readonly toolCallId?: string;
  readonly timestamp: number;
}

export interface SessionTreeNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly message: SessionMessage;
  readonly children: string[];
}

export interface TokenBudgetSummary {
  readonly currentTokens: number;
  readonly remainingTokens: number;
  readonly isWithinBudget: boolean;
}

export class AutoGPTSessionTreeEngine {
  private readonly nodes = new Map<string, SessionTreeNode>();
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
    const randomHash = Math.random().toString(36).substring(2, 9);
    const id = `msg_${randomHash}`;
    const nodeId = `node_${randomHash}`;
    const parentId = this.activeLeafId;

    const fullMsg: SessionMessage = {
      ...msg,
      id,
      timestamp: Date.now(),
    };

    const node: SessionTreeNode = {
      id: nodeId,
      parentId,
      message: fullMsg,
      children: [],
    };

    if (parentId !== null) {
      const parentNode = this.nodes.get(parentId);
      if (parentNode) {
        parentNode.children.push(nodeId);
      }
    }

    this.nodes.set(nodeId, node);
    this.activeLeafId = nodeId;
    return nodeId;
  }

  public getLinearHistory(): SessionMessage[] {
    const history: SessionMessage[] = [];
    let currentId = this.activeLeafId;

    while (currentId !== null) {
      const node = this.nodes.get(currentId);
      if (!node) {
        break;
      }
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

  public computeTokenBudget(maxTokens = 8192): TokenBudgetSummary {
    const history = this.getLinearHistory();
    let totalChars = 0;

    for (const message of history) {
      totalChars += message.content.length;
      if (message.thought) {
        totalChars += message.thought.length;
      }
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