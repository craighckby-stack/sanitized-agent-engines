/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Siyuan Knowledge Workspace Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: siyuan-note/siyuan
 */

export class siyuanSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private nodeMap: Map<string, SessionNode> = new Map();
  private maxNodes: number;

  constructor(maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.root = this.createNode('root', null, 0);
    this.current = this.root;
  }

  /**
   * Create a new session node
   */
  private createNode(id: string, parent: SessionNode | null, depth: number): SessionNode {
    const node: SessionNode = {
      id,
      parent,
      children: [],
      depth,
      content: '',
      tokenCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.nodeMap.set(id, node);
    return node;
  }

  /**
   * Add a new branch to the current node
   */
  addBranch(id: string, content: string, tokenCount: number): SessionNode {
    // Prune least recently used nodes if we're at capacity
    if (this.nodeMap.size >= this.maxNodes) {
      this.pruneNodes();
    }
    
    const newNode = this.createNode(id, this.current, this.current.depth + 1);
    newNode.content = content;
    newNode.tokenCount = tokenCount;
    
    this.current.children.push(newNode);
    this.current = newNode;
    
    return newNode;
  }

  /**
   * Navigate to a specific node
   */
  navigateTo(id: string): boolean {
    const node = this.nodeMap.get(id);
    if (node) {
      this.current = node;
      node.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get the current node
   */
  getCurrent(): SessionNode {
    return this.current;
  }

  /**
   * Get the path from root to current node
   */
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | null = this.current;
    
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    
    return path;
  }

  /**
   * Get total token count in the current path
   */
  getCurrentTokenCount(): number {
    return this.getCurrentPath().reduce((sum, node) => sum + node.tokenCount, 0);
  }

  /**
   * Prune least recently used nodes
   */
  private pruneNodes(): void {
    const nodes = Array.from(this.nodeMap.values())
      .filter(node => node !== this.root)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest 20% of nodes
    const pruneCount = Math.ceil(nodes.length * 0.2);
    for (let i = 0; i < pruneCount; i++) {
      const node = nodes[i];
      this.removeNode(node);
    }
  }

  /**
   * Remove a node and its children
   */
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
    
    // Remove children recursively
    for (const child of node.children) {
      this.removeNode(child);
    }
    
    this.nodeMap.delete(node.id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): SessionNode[] {
    return Array.from(this.nodeMap.values());
  }
}

interface SessionNode {
  id: string;
  parent: SessionNode | null;
  children: SessionNode[];
  depth: number;
  content: string;
  tokenCount: number;
  createdAt: number;
  lastAccessed: number;
}
