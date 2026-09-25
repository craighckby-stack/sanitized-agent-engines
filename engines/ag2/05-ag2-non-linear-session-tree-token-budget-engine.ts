/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ag2 Non-Linear Session Tree & Token Budget Engine
 * Source Origin: ag2ai/ag2
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

export interface SessionTreeSnapshot {
  nodes: [string, SessionTreeNode][];
  activeLeafId: string | null;
  rootId: string | null;
  timestamp: number;
}

export interface TokenBudgetMetrics {
  currentTokens: number;
  remainingTokens: number;
  isWithinBudget: boolean;
  messageCount?: number;
  averageTokensPerMessage?: number;
}

function generateSecureId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }
  const timestampPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestampPart}_${randomPart}`;
}

function sanitizeMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): Omit<SessionMessage, 'id' | 'timestamp'> {
  const allowedRoles: ReadonlyArray<SessionMessage['role']> = ['user', 'assistant', 'tool', 'system'];
  const role = allowedRoles.includes(msg.role) ? msg.role : 'user';
  const content = typeof msg.content === 'string' ? msg.content : String(msg.content ?? '');
  const thought = typeof msg.thought === 'string' ? msg.thought : undefined;
  const toolCallId = typeof msg.toolCallId === 'string' ? msg.toolCallId : undefined;

  return {
    role,
    content,
    ...(thought !== undefined ? { thought } : {}),
    ...(toolCallId !== undefined ? { toolCallId } : {}),
  };
}

export class ag2SessionTreeEngine {
  private nodes = new Map<string, SessionTreeNode>();
  private activeLeafId: string | null = null;
  private rootId: string | null = null;

  public initRoot(systemPrompt: string): string {
    this.nodes.clear();
    const safePrompt = typeof systemPrompt === 'string' ? systemPrompt : String(systemPrompt ?? '');
    const rootMessage: SessionMessage = {
      id: generateSecureId('msg_root'),
      role: 'system',
      content: safePrompt,
      timestamp: Date.now(),
    };
    const rootNode: SessionTreeNode = {
      id: generateSecureId('node_root'),
      parentId: null,
      message: Object.freeze({ ...rootMessage }),
      children: [],
    };
    this.nodes.set(rootNode.id, rootNode);
    this.rootId = rootNode.id;
    this.activeLeafId = rootNode.id;
    return rootNode.id;
  }

  public appendMessage(msg: Omit<SessionMessage, 'id' | 'timestamp'>): string {
    const sanitized = sanitizeMessage(msg);
    const id = generateSecureId('msg');
    const fullMsg: SessionMessage = Object.freeze({
      ...sanitized,
      id,
      timestamp: Date.now(),
    });

    const nodeId = generateSecureId('node');
    const parentId = this.activeLeafId;

    const node: SessionTreeNode = {
      id: nodeId,
      parentId,
      message: fullMsg,
      children: [],
    };

    if (parentId && this.nodes.has(parentId)) {
      const parentNode = this.nodes.get(parentId)!;
      if (!parentNode.children.includes(nodeId)) {
        parentNode.children.push(nodeId);
      }
    } else if (!this.rootId) {
      this.rootId = nodeId;
    }

    this.nodes.set(nodeId, node);
    this.activeLeafId = nodeId;
    return nodeId;
  }

  public getLinearHistory(): SessionMessage[] {
    const history: SessionMessage[] = [];
    const visited = new Set<string>();
    let currentId = this.activeLeafId;

    while (currentId && this.nodes.has(currentId)) {
      if (visited.has(currentId)) {
        // Defensive cycle break if corrupted parent graph encountered
        break;
      }
      visited.add(currentId);
      const node = this.nodes.get(currentId)!;
      history.unshift({ ...node.message });
      currentId = node.parentId;
    }

    return history;
  }

  public forkBranch(fromNodeId: string): void {
    if (typeof fromNodeId !== 'string' || !this.nodes.has(fromNodeId)) {
      throw new Error(`Cannot fork from non-existent node: '${fromNodeId}'`);
    }
    this.activeLeafId = fromNodeId;
  }

  public computeTokenBudget(maxTokens = 8192): { currentTokens: number; remainingTokens: number; isWithinBudget: boolean } {
    const validMax = typeof maxTokens === 'number' && !Number.isNaN(maxTokens) && maxTokens >= 0
      ? Math.floor(maxTokens)
      : 8192;

    const history = this.getLinearHistory();
    let totalChars = 0;
    for (const m of history) {
      const contentLen = m.content ? m.content.length : 0;
      const thoughtLen = m.thought ? m.thought.length : 0;
      const toolCallLen = m.toolCallId ? m.toolCallId.length : 0;
      totalChars += contentLen + thoughtLen + toolCallLen;
    }

    // Defensive heuristic: 4 chars/token approx plus 4 tokens message framing overhead
    const estimatedFramingTokens = history.length * 4;
    const currentTokens = Math.ceil(totalChars / 4) + estimatedFramingTokens;
    const remainingTokens = Math.max(0, validMax - currentTokens);

    return {
      currentTokens,
      remainingTokens,
      isWithinBudget: currentTokens <= validMax,
    };
  }

  public getActiveLeafId(): string | null {
    return this.activeLeafId;
  }

  public getRootId(): string | null {
    return this.rootId;
  }

  public getNode(nodeId: string): Readonly<SessionTreeNode> | undefined {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;
    return {
      id: node.id,
      parentId: node.parentId,
      message: { ...node.message },
      children: [...node.children],
    };
  }

  public getAllNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  public getBranchLeaves(): string[] {
    const leaves: string[] = [];
    for (const [id, node] of this.nodes.entries()) {
      if (!node.children || node.children.length === 0) {
        leaves.push(id);
      }
    }
    return leaves;
  }

  public pruneBranch(nodeId: string): boolean {
    if (!this.nodes.has(nodeId) || nodeId === this.rootId) {
      return false;
    }

    const toDelete = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      toDelete.add(curr);
      const currNode = this.nodes.get(curr);
      if (currNode && Array.isArray(currNode.children)) {
        for (const childId of currNode.children) {
          queue.push(childId);
        }
      }
    }

    const targetNode = this.nodes.get(nodeId);
    if (targetNode && targetNode.parentId && this.nodes.has(targetNode.parentId)) {
      const parentNode = this.nodes.get(targetNode.parentId)!;
      parentNode.children = parentNode.children.filter((id) => id !== nodeId);
    }

    for (const delId of toDelete) {
      this.nodes.delete(delId);
    }

    if (this.activeLeafId && toDelete.has(this.activeLeafId)) {
      this.activeLeafId = targetNode?.parentId ?? this.rootId;
    }

    return true;
  }

  public exportSnapshot(): SessionTreeSnapshot {
    const nodesArray: [string, SessionTreeNode][] = Array.from(this.nodes.entries()).map(([k, v]) => [
      k,
      {
        id: v.id,
        parentId: v.parentId,
        message: { ...v.message },
        children: [...v.children],
      },
    ]);

    return {
      nodes: nodesArray,
      activeLeafId: this.activeLeafId,
      rootId: this.rootId,
      timestamp: Date.now(),
    };
  }

  public importSnapshot(snapshot: SessionTreeSnapshot): boolean {
    if (!snapshot || !Array.isArray(snapshot.nodes)) {
      return false;
    }

    this.nodes.clear();
    for (const [k, v] of snapshot.nodes) {
      if (v && typeof v.id === 'string') {
        this.nodes.set(k, {
          id: v.id,
          parentId: v.parentId ?? null,
          message: Object.freeze({ ...v.message }),
          children: Array.isArray(v.children) ? [...v.children] : [],
        });
      }
    }

    this.rootId = snapshot.rootId && this.nodes.has(snapshot.rootId) ? snapshot.rootId : null;
    this.activeLeafId = snapshot.activeLeafId && this.nodes.has(snapshot.activeLeafId) ? snapshot.activeLeafId : this.rootId;
    return true;
  }
}