/**
 * @license
 * SPDX-License-Identifier: CC-BY-4.0
 *
 * autogen Non-Linear Session Tree & Token Budget Engine
 * Source Origin: microsoft/autogen
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

/**
 * Manages a non-linear conversation session tree supporting branching,
 * backtracking, linear history reconstruction, and strict token budget tracking.
 */
export class autogenSessionTreeEngine {
  private readonly nodes = new Map<string, SessionTreeNode>();
  private activeLeafId: string | null = null;
  private rootId: string | null = null;

  /**
   * Initializes or resets the session tree root with a system prompt.
   */
  public initRoot(systemPrompt: string): string {
    this.nodes.clear();
    const timestamp = Date.now();
    
    const rootMessage: SessionMessage = {
      id: 'msg_root',
      role: 'system',
      content: systemPrompt,
      timestamp,
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

  /**
   * Appends a new message as a child of the current active leaf node.
   */
  public appendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): string {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const id = `msg_${randomSuffix}`;
    const nodeId = `node_${randomSuffix}`;
    const parentId = this.activeLeafId;
    const timestamp = Date.now();

    const fullMsg: SessionMessage = {
      ...msg,
      id,
      timestamp,
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

  /**
   * Reconstructs the linear message sequence from the current active leaf back to root.
   */
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

  /**
   * Forks a new branch by pointing the active leaf ID to a specified node.
   */
  public forkBranch(fromNodeId: string): void {
    if (!this.nodes.has(fromNodeId)) {
      throw new Error(`Cannot fork from non-existent node: '${fromNodeId}'`);
    }
    this.activeLeafId = fromNodeId;
  }

  /**
   * Computes the current token consumption based on the active linear path.
   */
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