/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Career Ops Autonomous Agent Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: career-ops-hq/career-ops
 */

interface SessionNode {
  id: string;
  timestamp: number;
  content: any;
  children: SessionNode[];
  tokenCount: number;
}

class CareerOpsSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxTokens: number;
  private lruSize: number;
  private nodeMap: Map<string, SessionNode> = new Map();
  
  constructor(maxTokens: number = 100000, lruSize: number = 50) {
    this.maxTokens = maxTokens;
    this.lruSize = lruSize;
    
    this.root = {
      id: 'root',
      timestamp: Date.now(),
      content: null,
      children: [],
      tokenCount: 0
    };
    
    this.current = this.root;
    this.nodeMap.set(this.root.id, this.root);
  }
  
  /** Add a new node to the current branch */
  addNode(content: any, tokenCount: number): string {
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNode: SessionNode = {
      id: nodeId,
      timestamp: Date.now(),
      content,
      children: [],
      tokenCount
    };
    
    this.current.children.push(newNode);
    this.nodeMap.set(nodeId, newNode);
    
    // Update token counts
    this.updateTokenCounts(this.current, tokenCount);
    
    // Check if we need to prune
    this.pruneIfNeeded();
    
    return nodeId;
  }
  
  /** Branch to a new child node */
  branch(content: any, tokenCount: number): string {
    const nodeId = this.addNode(content, tokenCount);
    this.current = this.nodeMap.get(nodeId)!;
    return nodeId;
  }
  
  /** Move to a specific node */
  moveToNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    this.current = node;
  }
  
  /** Get the current node */
  getCurrentNode(): SessionNode {
    return { ...this.current };
  }
  
  /** Get the path from root to current node */
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.current;
    
    while (node && node.id !== 'root') {
      path.unshift(node);
      // Find parent by checking which node has this node as child
      node = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === node!.id)
      );
    }
    
    return path;
  }
  
  /** Update token counts recursively */
  private updateTokenCounts(node: SessionNode, delta: number): void {
    let current: SessionNode | undefined = node;
    
    while (current) {
      current.tokenCount += delta;
      // Find parent
      current = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === current!.id)
      );
    }
  }
  
  /** Prune least recently used nodes if needed */
  private pruneIfNeeded(): void {
    if (this.root.tokenCount <= this.maxTokens) {
      return;
    }
    
    // Get all nodes except root
    const allNodes = Array.from(this.nodeMap.values()).filter(n => n.id !== 'root');
    
    // Sort by last access time (we'll approximate with timestamp)
    allNodes.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate how many tokens we need to free
    const tokensToFree = this.root.tokenCount - this.maxTokens;
    let freedTokens = 0;
    const nodesToRemove: string[] = [];
    
    for (const node of allNodes) {
      if (freedTokens >= tokensToFree) break;
      
      freedTokens += node.tokenCount;
      nodesToRemove.push(node.id);
    }
    
    // Remove nodes and update references
    for (const nodeId of nodesToRemove) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;
      
      // Remove from parent's children
      const parent = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === nodeId)
      );
      
      if (parent) {
        parent.children = parent.children.filter(child => child.id !== nodeId);
      }
      
      // Remove from map
      this.nodeMap.delete(nodeId);
    }
    
    // Recalculate token counts
    this.root.tokenCount = this.calculateTokenCount(this.root);
  }
  
  /** Recursively calculate token count for a node */
  private calculateTokenCount(node: SessionNode): number {
    return node.children.reduce((sum, child) => {
      return sum + child.tokenCount + this.calculateTokenCount(child);
    }, 0);
  }
  
  /** Get session statistics */
  getStats(): {
    totalNodes: number;
    totalTokens: number;
    depth: number;
    branchCount: number;
  } {
    const allNodes = Array.from(this.nodeMap.values()).filter(n => n.id !== 'root');
    const depth = this.getCurrentPath().length;
    const branchCount = allNodes.filter(n => n.children.length > 0).length;
    
    return {
      totalNodes: allNodes.length,
      totalTokens: this.root.tokenCount,
      depth,
      branchCount
    };
  }
}
