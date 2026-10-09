/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: AI Agent Book Companion Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: bojieli/ai-agent-book
 */

import { SessionNode, TokenBudget } from './types';

/**
 * Non-linear Session Tree & Token Budget for the AI Agent Book Companion
 * Manages branching conversation trees, checkpoints, and LRU pruning
 */
export class AiAgentBookSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private tokenBudget: TokenBudget;
  private nodeCounter: number = 0;
  
  constructor(maxTokens: number = 4096) {
    this.root = {
      id: this.generateId(),
      parent: null,
      children: [],
      content: '',
      tokens: 0,
      createdAt: new Date(),
      visited: 0
    };
    
    this.current = this.root;
    this.tokenBudget = {
      maxTokens,
      usedTokens: 0,
      reservedTokens: 0
    };
  }
  
  /**
   * Add a new node to the current branch
   */
  addNode(content: string, tokens: number): SessionNode {
    const newNode: SessionNode = {
      id: this.generateId(),
      parent: this.current,
      children: [],
      content,
      tokens,
      createdAt: new Date(),
      visited: 0
    };
    
    this.current.children.push(newNode);
    this.current = newNode;
    
    // Update token budget
    this.tokenBudget.usedTokens += tokens;
    
    // Prune if necessary
    this.pruneTree();
    
    return newNode;
  }
  
  /**
   * Create a checkpoint at the current node
   */
  createCheckpoint(): string {
    // In a real implementation, this would serialize the relevant part of the tree
    return this.current.id;
  }
  
  /**
   * Restore from a checkpoint
   */
  restoreFromCheckpoint(checkpointId: string): boolean {
    // Find the node with the given ID
    const node = this.findNodeById(checkpointId);
    
    if (node) {
      this.current = node;
      return true;
    }
    
    return false;
  }
  
  /**
   * Branch the conversation at the current node
   */
  branch(content: string, tokens: number): SessionNode {
    const newNode: SessionNode = {
      id: this.generateId(),
      parent: this.current,
      children: [],
      content,
      tokens,
      createdAt: new Date(),
      visited: 0
    };
    
    this.current.children.push(newNode);
    this.current = newNode;
    
    // Update token budget
    this.tokenBudget.usedTokens += tokens;
    
    // Prune if necessary
    this.pruneTree();
    
    return newNode;
  }
  
  /**
   * Get the current token usage
   */
  getTokenUsage(): TokenBudget {
    return { ...this.tokenBudget };
  }
  
  /**
   * Reserve tokens for a future operation
   */
  reserveTokens(tokens: number): boolean {
    if (this.tokenBudget.usedTokens + tokens > this.tokenBudget.maxTokens) {
      return false;
    }
    
    this.tokenBudget.reservedTokens += tokens;
    return true;
  }
  
  /**
   * Release reserved tokens
   */
  releaseTokens(tokens: number): void {
    this.tokenBudget.reservedTokens = Math.max(0, this.tokenBudget.reservedTokens - tokens);
  }
  
  /**
   * Prune the tree using LRU strategy
   */
  private pruneTree(): void {
    // Simple LRU pruning - in a real implementation this would be more sophisticated
    while (this.tokenBudget.usedTokens > this.tokenBudget.maxTokens * 0.9) {
      const lruNode = this.findLRUNode(this.root);
      if (lruNode && lruNode !== this.root) {
        this.removeNode(lruNode);
      } else {
        break; // Can't prune root
      }
    }
  }
  
  /**
   * Find the least recently used node
   */
  private findLRUNode(node: SessionNode): SessionNode | null {
    let lruNode: SessionNode | null = null;
    let minVisits = Infinity;
    
    const traverse = (n: SessionNode) => {
      if (n.visited < minVisits) {
        minVisits = n.visited;
        lruNode = n;
      }
      
      for (const child of n.children) {
        traverse(child);
      }
    };
    
    traverse(node);
    return lruNode;
  }
  
  /**
   * Remove a node from the tree
   */
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
    
    // Subtract tokens from budget
    this.tokenBudget.usedTokens -= node.tokens;
  }
  
  /**
   * Find a node by ID
   */
  private findNodeById(id: string, node: SessionNode = this.root): SessionNode | null {
    if (node.id === id) {
      return node;
    }
    
    for (const child of node.children) {
      const found = this.findNodeById(id, child);
      if (found) {
        return found;
      }
    }
    
    return null;
  }
  
  /**
   * Generate a unique node ID
   */
  private generateId(): string {
    return `node_${++this.nodeCounter}`;
  }
}
