/* GLM-Engine-Harvester [2026-10-09T02:52:52.183Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Hermes Autonomous Agent Runtime Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: NousResearch/hermes-agent
 */

import { SessionNode, TokenBudget, SessionCheckpoint } from './types';

class HermesSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private tokenBudget: TokenBudget;
  private maxNodes: number = 100; // LRU pruning limit
  private nodeCount: number = 0;
  
  constructor(maxContextTokens: number = 100000) {
    this.tokenBudget = {
      maxContextTokens,
      usedTokens: 0,
      reservedTokens: 0,
      nodeBudgets: new Map()
    };
    
    // Create root node
    this.root = {
      id: 'root',
      parent: null,
      children: new Set(),
      content: '',
      tokenCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      checkpoint: null
    };
    
    this.current = this.root;
    this.nodeCount = 1;
  }
  
  // Node operations
  createNode(
    content: string,
    parent: SessionNode | null = null,
    checkpoint?: SessionCheckpoint
  ): SessionNode {
    const parentNode = parent || this.current;
    
    const newNode: SessionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parent: parentNode,
      children: new Set(),
      content,
      tokenCount: this.estimateTokenCount(content),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      checkpoint
    };
    
    // Add to parent
    parentNode.children.add(newNode);
    
    // Update current node
    this.current = newNode;
    
    // Update token budget
    this.updateTokenBudget(newNode, 'add');
    
    // Update node count and prune if needed
    this.nodeCount++;
    if (this.nodeCount > this.maxNodes) {
      this.pruneLeastRecentlyUsed();
    }
    
    return newNode;
  }
  
  private estimateTokenCount(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }
  
  private updateTokenBudget(node: SessionNode, operation: 'add' | 'remove'): void {
    const tokenCount = node.tokenCount;
    
    if (operation === 'add') {
      this.tokenBudget.usedTokens += tokenCount;
      
      // Reserve tokens for this node
      if (!this.tokenBudget.nodeBudgets.has(node.id)) {
        this.tokenBudget.nodeBudgets.set(node.id, 0);
      }
      this.tokenBudget.nodeBudgets.set(
        node.id, 
        (this.tokenBudget.nodeBudgets.get(node.id) || 0) + tokenCount
      );
      
      // Check if we're over budget
      if (this.tokenBudget.usedTokens > this.tokenBudget.maxContextTokens) {
        this.pruneOldestNodes();
      }
    } else {
      this.tokenBudget.usedTokens -= tokenCount;
      this.tokenBudget.nodeBudgets.delete(node.id);
    }
  }
  
  private pruneLeastRecentlyUsed(): void {
    // Find all nodes except root
    const allNodes = this.getAllNodes().filter(n => n.id !== 'root');
    
    // Sort by last accessed time
    allNodes.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest nodes until we're under the limit
    const nodesToRemove = allNodes.slice(0, this.nodeCount - this.maxNodes);
    
    for (const node of nodesToRemove) {
      this.removeNode(node);
    }
  }
  
  private pruneOldestNodes(): void {
    // Find all nodes except root
    const allNodes = this.getAllNodes().filter(n => n.id !== 'root');
    
    // Sort by creation time
    allNodes.sort((a, b) => a.createdAt - b.createdAt);
    
    // Remove oldest nodes until we're under budget
    while (this.tokenBudget.usedTokens > this.tokenBudget.maxContextTokens && allNodes.length > 0) {
      const node = allNodes.shift()!;
      this.removeNode(node);
    }
  }
  
  private removeNode(node: SessionNode): void {
    // Remove from parent
    if (node.parent) {
      node.parent.children.delete(node);
    }
    
    // Recursively remove children
    for (const child of node.children) {
      this.removeNode(child);
    }
    
    // Update token budget
    this.updateTokenBudget(node, 'remove');
    
    // Update node count
    this.nodeCount--;
    
    // Update current if we're removing it
    if (this.current.id === node.id) {
      this.current = node.parent || this.root;
    }
  }
  
  // Navigation
  getCurrentNode(): SessionNode {
    return this.current;
  }
  
  setCurrentNode(nodeId: string): boolean {
    const node = this.findNode(nodeId);
    if (node) {
      this.current = node;
      this.current.lastAccessed = Date.now();
      return true;
    }
    return false;
  }
  
  // Tree traversal
  getAllNodes(): SessionNode[] {
    const nodes: SessionNode[] = [];
    
    const traverse = (node: SessionNode) => {
      nodes.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    };
    
    traverse(this.root);
    return nodes;
  }
  
  findNode(nodeId: string): SessionNode | null {
    const allNodes = this.getAllNodes();
    return allNodes.find(n => n.id === nodeId) || null;
  }
  
  // Checkpointing
  createCheckpoint(nodeId: string, data: any): boolean {
    const node = this.findNode(nodeId);
    if (node) {
      node.checkpoint = {
        id: `checkpoint_${Date.now()}`,
        nodeId,
        data,
        createdAt: Date.now()
      };
      return true;
    }
    return false;
  }
  
  getCheckpoint(nodeId: string): SessionCheckpoint | null {
    const node = this.findNode(nodeId);
    return node?.checkpoint || null;
  }
  
  // Token budget
  getTokenBudget(): TokenBudget {
    return { ...this.tokenBudget };
  }
  
  updateTokenBudget(maxContextTokens: number): void {
    this.tokenBudget.maxContextTokens = maxContextTokens;
    
    // If we're over the new budget, prune nodes
    if (this.tokenBudget.usedTokens > maxContextTokens) {
      this.pruneOldestNodes();
    }
  }
}
