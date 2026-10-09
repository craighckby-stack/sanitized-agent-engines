/* GLM-Engine-Harvester [2026-10-09T04:38:32.866Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Frontend Checklist Autonomous Agent Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private nodeMap: Map<string, SessionNode> = new Map();
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.root = this.createNode('root', 'Initial state');
    this.current = this.root;
    this.nodeMap.set(this.root.id, this.root);
  }
  
  /**
   * Create a new checkpoint in the session
   */
  createCheckpoint(
    id: string,
    data: SessionData,
    parent?: string
  ): SessionNode {
    const parentNode = parent ? this.nodeMap.get(parent) : this.current;
    if (!parentNode) {
      throw new Error(`Parent node not found: ${parent}`);
    }
    
    const node = this.createNode(id, data, parentNode);
    parentNode.children.push(node);
    this.current = node;
    this.nodeMap.set(id, node);
    
    // Enforce size limit
    this.enforceSizeLimit();
    
    return node;
  }
  
  /**
   * Navigate to a specific checkpoint
   */
  navigateTo(id: string): boolean {
    const node = this.nodeMap.get(id);
    if (node) {
      this.current = node;
      return true;
    }
    return false;
  }
  
  /**
   * Get the current session data
   */
  getCurrentData(): SessionData | null {
    return this.current.data;
  }
  
  /**
   * Get the path from root to current node
   */
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.current;
    
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    
    return path;
  }
  
  /**
   * Calculate token usage for current branch
   */
  calculateTokenUsage(): number {
    const path = this.getCurrentPath();
    return path.reduce((total, node) => total + (node.data.tokenCount || 0), 0);
  }
  
  /**
   * Prune old nodes to stay within budget
   */
  enforceTokenBudget(maxTokens: number): void {
    const currentUsage = this.calculateTokenUsage();
    if (currentUsage <= maxTokens) return;
    
    const excess = currentUsage - maxTokens;
    this.pruneNodes(excess);
  }
  
  private createNode(
    id: string,
    data: SessionData,
    parent?: SessionNode
  ): SessionNode {
    return {
      id,
      data,
      parent: parent || null,
      children: [],
      createdAt: new Date(),
      tokenCount: data.tokenCount || 0
    };
  }
  
  private enforceSizeLimit(): void {
    while (this.nodeMap.size > this.maxSize) {
      // Find the least recently used node that's not the root or current
      const lruNode = this.findLRUNode();
      if (lruNode && lruNode.id !== 'root' && lruNode !== this.current) {
        this.removeNode(lruNode);
      } else {
        break;
      }
    }
  }
  
  private findLRUNode(): SessionNode | null {
    let lruNode: SessionNode | null = null;
    let oldestTime = new Date();
    
    for (const node of this.nodeMap.values()) {
      if (node.id !== 'root' && node !== this.current && node.createdAt < oldestTime) {
        oldestTime = node.createdAt;
        lruNode = node;
      }
    }
    
    return lruNode;
  }
  
  private removeNode(node: SessionNode): void {
    // Remove from parent's children
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
    
    // Remove from map and recursively remove children
    this.nodeMap.delete(node.id);
    for (const child of node.children) {
      this.removeNode(child);
    }
  }
  
  private pruneNodes(excessTokens: number): void {
    let pruned = 0;
    
    // Start from the oldest nodes that aren't on the current path
    const nodesToPrune = Array.from(this.nodeMap.values())
      .filter(node => !this.isOnCurrentPath(node))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const node of nodesToPrune) {
      if (pruned >= excessTokens) break;
      
      pruned += node.tokenCount || 0;
      this.removeNode(node);
    }
  }
  
  private isOnCurrentPath(node: SessionNode): boolean {
    let current: SessionNode | undefined = this.current;
    while (current) {
      if (current === node) return true;
      current = current.parent;
    }
    return false;
  }
}

interface SessionNode {
  id: string;
  data: SessionData;
  parent: SessionNode | null;
  children: SessionNode[];
  createdAt: Date;
  tokenCount?: number;
}

interface SessionData {
  content: string;
  metadata?: Record<string, any>;
  tokenCount?: number;
}
