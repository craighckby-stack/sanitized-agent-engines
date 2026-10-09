/* GLM-Engine-Harvester [2026-10-09T03:30:29.651Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Frontend Checklist Agent Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistSessionTree {
  private nodes: Map<string, {data: any, children: string[], parent: string | null}> = new Map();
  private currentPath: string[] = [];
  private tokenBudget: number;
  private nodeCounter: number = 0;

  constructor(maxTokens: number = 10000) {
    this.tokenBudget = maxTokens;
    this.createNode('root', null);
  }

  /** Create a new node in the session tree */
  private createNode(data: any, parentId: string | null): string {
    const id = `node-${this.nodeCounter++}`;
    this.nodes.set(id, {
      data,
      children: [],
      parent: parentId
    });
    
    if (parentId && this.nodes.has(parentId)) {
      this.nodes.get(parentId)!.children.push(id);
    }
    
    return id;
  }

  /** Add a new checkpoint to the current path */
  addCheckpoint(data: any): string {
    const parentId = this.currentPath.length > 0 
      ? this.currentPath[this.currentPath.length - 1] 
      : 'root';
    
    const nodeId = this.createNode(data, parentId);
    this.currentPath.push(nodeId);
    
    // Estimate token usage and prune if necessary
    this.pruneTree();
    
    return nodeId;
  }

  /** Navigate to a specific checkpoint */
  navigateTo(nodeId: string) {
    if (!this.nodes.has(nodeId)) return;
    
    // Rebuild path to node
    this.currentPath = [];
    let current: string | null = nodeId;
    
    while (current !== null && current !== 'root') {
      this.currentPath.unshift(current);
      current = this.nodes.get(current)!.parent;
    }
    
    if (current === 'root') {
      this.currentPath.unshift('root');
    }
  }

  /** Estimate token usage and prune least recently used branches */
  private pruneTree() {
    // Simple LRU pruning - in a real implementation, this would be more sophisticated
    if (this.nodes.size > 100) {
      const oldestNode = this.currentPath[1]; // Skip root
      if (oldestNode && this.nodes.has(oldestNode)) {
        this.removeNode(oldestNode);
      }
    }
  }

  /** Remove a node and its children */
  private removeNode(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // Recursively remove children
    node.children.forEach(childId => this.removeNode(childId));
    
    // Remove from parent's children
    if (node.parent && this.nodes.has(node.parent)) {
      const parent = this.nodes.get(node.parent)!;
      parent.children = parent.children.filter(id => id !== nodeId);
    }
    
    this.nodes.delete(nodeId);
    
    // Remove from current path if present
    this.currentPath = this.currentPath.filter(id => id !== nodeId);
  }

  /** Get the current session path */
  getCurrentPath(): string[] {
    return [...this.currentPath];
  }

  /** Get data for a specific node */
  getNodeData(nodeId: string): any | null {
    return this.nodes.has(nodeId) ? this.nodes.get(nodeId)!.data : null;
  }

  /** Reset the session tree */
  reset() {
    this.nodes.clear();
    this.currentPath = [];
    this.nodeCounter = 0;
    this.createNode('root', null);
  }
}
