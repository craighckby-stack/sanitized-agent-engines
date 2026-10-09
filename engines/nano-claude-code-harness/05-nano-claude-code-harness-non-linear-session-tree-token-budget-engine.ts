/* GLM-Engine-Harvester [2026-10-09T03:29:13.889Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Nano Claude Code Harness Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: shareAI-lab/learn-claude-code
 */

class NanoClaudeCodeSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxNodes = 100;
  private nodeCounter = 0;
  
  constructor(private workdir: string) {
    this.root = this.createNode('root', 'Initial session');
    this.current = this.root;
  }
  
  createNode(id: string, description: string, parent?: SessionNode): SessionNode {
    const node: SessionNode = {
      id: id || `node-${++this.nodeCounter}`,
      description,
      parent: parent || this.current,
      children: [],
      messages: [],
      createdAt: new Date(),
      tokenCount: 0
    };
    
    if (parent) {
      parent.children.push(node);
    }
    
    // Enforce max nodes
    if (this.nodeCounter > this.maxNodes) {
      this.pruneOldest();
    }
    
    return node;
  }
  
  getCurrent(): SessionNode {
    return this.current;
  }
  
  setCurrent(node: SessionNode): void {
    this.current = node;
  }
  
  addMessage(role: string, content: string): void {
    this.current.messages.push({ role, content, timestamp: new Date() });
    this.current.tokenCount += this.estimateTokens(content);
  }
  
  checkpoint(description: string): SessionNode {
    const newNode = this.createNode(undefined, description);
    this.current = newNode;
    return newNode;
  }
  
  branch(description: string): SessionNode {
    const branchNode = this.createNode(undefined, description);
    this.current = branchNode;
    return branchNode;
  }
  
  pruneOldest(): void {
    // Find the oldest leaf node (excluding root)
    const oldestLeaf = this.findOldestLeaf(this.root);
    if (oldestLeaf && oldestLeaf !== this.root) {
      this.removeNode(oldestLeaf);
    }
  }
  
  private findOldestLeaf(node: SessionNode): SessionNode | null {
    if (node.children.length === 0) {
      return node;
    }
    
    let oldest: SessionNode | null = null;
    let oldestTime = node.createdAt;
    
    for (const child of node.children) {
      const childOldest = this.findOldestLeaf(child);
      if (childOldest && childOldest.createdAt < oldestTime) {
        oldest = childOldest;
        oldestTime = childOldest.createdAt;
      }
    }
    
    return oldest;
  }
  
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  getBudget(): { used: number, total: number } {
    const totalTokens = this.estimateTreeTokens(this.root);
    return {
      used: totalTokens,
      total: this.maxNodes * 1000 // Arbitrary max budget
    };
  }
  
  private estimateTreeTokens(node: SessionNode): number {
    let total = node.tokenCount;
    for (const child of node.children) {
      total += this.estimateTreeTokens(child);
    }
    return total;
  }
}

interface SessionNode {
  id: string;
  description: string;
  parent: SessionNode;
  children: SessionNode[];
  messages: { role: string; content: string; timestamp: Date }[];
  createdAt: Date;
  tokenCount: number;
}
