/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Cherry Studio Autonomous Agent Runtime Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: CherryHQ/cherry-studio
 */

export class cherryStudioSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private nodeMap: Map<string, SessionNode> = new Map();
  private maxNodes: number;

  constructor(maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.root = this.createNode('root', null);
    this.current = this.root;
  }

  /** Create a new session node */
  createNode(id: string, parentId: string | null, content?: any): SessionNode {
    // Check if we need to prune old nodes
    if (this.nodeMap.size >= this.maxNodes) {
      this.pruneOldestNode();
    }

    const parent = parentId ? this.nodeMap.get(parentId) : null;
    const node: SessionNode = {
      id,
      parentId,
      content: content || {},
      children: [],
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      tokenCount: this.estimateTokenCount(content)
    };

    this.nodeMap.set(id, node);
    if (parent) {
      parent.children.push(id);
    }

    return node;
  }

  /** Switch to a session node */
  switchToNode(nodeId: string): boolean {
    const node = this.nodeMap.get(nodeId);
    if (!node) return false;

    this.current = node;
    node.lastAccessed = Date.now();
    return true;
  }

  /** Add a child node to the current node */
  addChildNode(id: string, content: any): SessionNode {
    const node = this.createNode(id, this.current.id, content);
    this.current = node;
    return node;
  }

  /** Get the current node */
  getCurrentNode(): SessionNode {
    return this.current;
  }

  /** Get a node by ID */
  getNode(id: string): SessionNode | undefined {
    return this.nodeMap.get(id);
  }

  /** Get the path from root to a node */
  getNodePath(id: string): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.nodeMap.get(id);
    
    while (node) {
      path.unshift(node);
      node = node.parentId ? this.nodeMap.get(node.parentId) : undefined;
    }
    
    return path;
  }

  /** Get all nodes in a depth-first order */
  getAllNodes(): SessionNode[] {
    const nodes: SessionNode[] = [];
    const visit = (nodeId: string) => {
      const node = this.nodeMap.get(nodeId);
      if (!node) return;
      
      nodes.push(node);
      for (const childId of node.children) {
        visit(childId);
      }
    };
    
    visit(this.root.id);
    return nodes;
  }

  /** Calculate total token usage */
  getTotalTokenCount(): number {
    return Array.from(this.nodeMap.values())
      .reduce((sum, node) => sum + node.tokenCount, 0);
  }

  /** Prune the oldest node that's not the root */
  private pruneOldestNode(): void {
    const nodes = Array.from(this.nodeMap.values())
      .filter(node => node.id !== this.root.id)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    if (nodes.length > 0) {
      const oldest = nodes[0];
      this.removeNode(oldest.id);
    }
  }

  /** Remove a node and all its descendants */
  private removeNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;
    
    // Remove children first
    for (const childId of [...node.children]) {
      this.removeNode(childId);
    }
    
    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodeMap.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    }
    
    // Remove from map
    this.nodeMap.delete(nodeId);
    
    // Update current if needed
    if (this.current.id === nodeId) {
      this.current = this.root;
    }
  }

  /** Estimate token count for content */
  private estimateTokenCount(content: any): number {
    // Simple approximation - in a real implementation, this would use a tokenizer
    const text = JSON.stringify(content);
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }
}

interface SessionNode {
  id: string;
  parentId: string | null;
  content: any;
  children: string[];
  createdAt: number;
  lastAccessed: number;
  tokenCount: number;
}
