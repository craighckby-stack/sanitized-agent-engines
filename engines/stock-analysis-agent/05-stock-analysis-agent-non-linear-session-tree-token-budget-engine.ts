/* GLM-Engine-Harvester [2026-10-09T04:26:15.161Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Stock Analysis Agent Runtime Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: ZhuLinsen/daily_stock_analysis
 */

import { EventEmitter } from 'events';
import { stockAnalysisAgentLifecycleContext } from './stockAnalysisAgentLifecycleContext';

/**
 * Non-linear session tree with token budget management
 */
export class stockAnalysisAgentSessionTree extends EventEmitter {
  private context: stockAnalysisAgentLifecycleContext;
  private root: SessionNode;
  private currentNode: SessionNode;
  private tokenBudget: number;
  private usedTokens: number;
  private maxBranches: number;
  
  constructor(context: stockAnalysisAgentLifecycleContext, tokenBudget = 4000, maxBranches = 5) {
    super();
    this.context = context;
    this.tokenBudget = tokenBudget;
    this.usedTokens = 0;
    this.maxBranches = maxBranches;
    
    // Create root node
    this.root = {
      id: 'root',
      parentId: null,
      children: new Set(),
      messages: [],
      metadata: {},
      createdAt: new Date(),
      isLeaf: false
    };
    
    this.currentNode = this.root;
  }
  
  /**
   * Add a message to the current session node
   */
  addMessage(role: string, content: string, metadata?: any): void {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      metadata: metadata || {},
      timestamp: new Date()
    };
    
    this.currentNode.messages.push(message);
    this.usedTokens += this.estimateTokens(content);
    
    this.emit('messageAdded', { node: this.currentNode, message });
  }
  
  /**
   * Create a new branch from the current node
   */
  createBranch(branchId: string, metadata?: any): SessionNode {
    if (this.currentNode.children.size >= this.maxBranches) {
      throw new Error('Maximum number of branches reached');
    }
    
    const newNode: SessionNode = {
      id: branchId,
      parentId: this.currentNode.id,
      children: new Set(),
      messages: [...this.currentNode.messages],
      metadata: metadata || {},
      createdAt: new Date(),
      isLeaf: false
    };
    
    // Add to parent
    this.currentNode.children.add(branchId);
    
    // Add to node registry
    (this.root as any)[branchId] = newNode;
    
    this.emit('branchCreated', { parent: this.currentNode, child: newNode });
    return newNode;
  }
  
  /**
   * Switch to a different node in the session tree
   */
  switchNode(nodeId: string): void {
    const node = (this.root as any)[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    this.currentNode = node;
    this.emit('nodeSwitched', { node });
  }
  
  /**
   * Get the current session node
   */
  getCurrentNode(): SessionNode {
    return this.currentNode;
  }
  
  /**
   * Get the session tree structure
   */
  getTreeStructure(): SessionNode {
    return JSON.parse(JSON.stringify(this.root));
  }
  
  /**
   * Check if token budget is exceeded
   */
  isTokenBudgetExceeded(): boolean {
    return this.usedTokens > this.tokenBudget;
  }
  
  /**
   * Get remaining token budget
   */
  getRemainingTokens(): number {
    return Math.max(0, this.tokenBudget - this.usedTokens);
  }
  
  /**
   * Prune the tree to save memory
   */
  prune(): void {
    this.pruneNode(this.root);
    this.emit('treePruned');
  }
  
  /**
   * Recursively prune nodes
   */
  private pruneNode(node: SessionNode): void {
    if (node.children.size === 0 && node !== this.currentNode && node !== this.root) {
      // Remove leaf node that's not current or root
      const parent = (this.root as any)[node.parentId];
      if (parent) {
        parent.children.delete(node.id);
        delete (this.root as any)[node.id];
      }
    } else {
      // Recursively prune children
      for (const childId of node.children) {
        const child = (this.root as any)[childId];
        if (child) {
          this.pruneNode(child);
        }
      }
    }
  }
  
  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    // Simple approximation: 1 token ≈ 4 characters for English
    return Math.ceil(content.length / 4);
  }
}

/**
 * Session node interface
 */
interface SessionNode {
  id: string;
  parentId: string | null;
  children: Set<string>;
  messages: any[];
  metadata: any;
  createdAt: Date;
  isLeaf: boolean;
}
