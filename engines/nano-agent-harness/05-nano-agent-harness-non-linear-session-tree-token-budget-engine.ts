/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Nano Agent Harness Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: shareAI-lab/learn-claude-code
 */

export class NanoSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxNodes: number;
  private nodeCounter = 0;
  
  constructor(
    private config: TreeConfig = {}
  ) {
    this.maxNodes = config.maxNodes || 100;
    this.root = this.createNode('root', null);
    this.current = this.root;
  }
  
  createCheckpoint(message: Message, parent?: SessionNode): SessionNode {
    const node = this.createNode('checkpoint', parent || this.current);
    node.message = message;
    this.current = node;
    this.pruneTree();
    return node;
  }
  
  createBranch(message: Message, parent?: SessionNode): SessionNode {
    const node = this.createNode('branch', parent || this.current);
    node.message = message;
    this.current = node;
    this.pruneTree();
    return node;
  }
  
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.current;
    
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    
    return path;
  }
  
  getBranches(node: SessionNode): SessionNode[] {
    return node.children.filter(child => child.type === 'branch');
  }
  
  getCheckpoints(node: SessionNode): SessionNode[] {
    return node.children.filter(child => child.type === 'checkpoint');
  }
  
  calculateTokenBudget(modelContext: number): number {
    const path = this.getCurrentPath();
    const usedTokens = path.reduce((sum, node) => {
      return sum + this.estimateMessageTokens(node.message);
    }, 0);
    
    return Math.max(0, modelContext - usedTokens);
  }
  
  private createNode(type: 'root' | 'checkpoint' | 'branch', parent: SessionNode): SessionNode {
    const node: SessionNode = {
      id: `node-${++this.nodeCounter}`,
      type,
      parent,
      children: [],
      message: null,
      createdAt: new Date()
    };
    
    if (parent) {
      parent.children.push(node);
    }
    
    return node;
  }
  
  private pruneTree(): void {
    if (this.countNodes() > this.maxNodes) {
      // Remove least recently accessed branches
      const branches = this.collectAllBranches(this.root);
      branches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const toRemove = branches.slice(this.maxNodes / 2);
      for (const branch of toRemove) {
        this.removeNode(branch);
      }
    }
  }
  
  private countNodes(): number {
    return this.collectAllNodes(this.root).length;
  }
  
  private collectAllNodes(node: SessionNode): SessionNode[] {
    let nodes = [node];
    for (const child of node.children) {
      nodes = nodes.concat(this.collectAllNodes(child));
    }
    return nodes;
  }
  
  private collectAllBranches(node: SessionNode): SessionNode[] {
    let branches = node.type === 'branch' ? [node] : [];
    for (const child of node.children) {
      branches = branches.concat(this.collectAllBranches(child));
    }
    return branches;
  }
  
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
  }
  
  private estimateMessageTokens(message: Message | null): number {
    if (!message) return 0;
    // Simple estimation - in a real implementation, this would be more accurate
    return message.content.length / 4;
  }
}

interface SessionNode {
  id: string;
  type: 'root' | 'checkpoint' | 'branch';
  parent: SessionNode | null;
  children: SessionNode[];
  message: Message | null;
  createdAt: Date;
}

interface TreeConfig {
  maxNodes?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}
