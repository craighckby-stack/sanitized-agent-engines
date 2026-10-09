/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Autonomous Agent Runtime Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: NousResearch/hermes-agent
 */

import { SessionNode, TokenBudget } from './types';

/**
 * Non-linear Session Tree & Token Budget - Branching tree with checkpointing and LRU pruning
 */
export class AutonomousAgentSessionTree {
  private root: SessionNode;
  private currentNode: SessionNode;
  private tokenBudget: TokenBudget;
  private maxNodes: number;
  private nodeCount: number = 0;

  constructor(maxTokens: number = 100000, maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.tokenBudget = {
      maxTokens,
      usedTokens: 0,
      reservedTokens: 0
    };
    
    // Create root node
    this.root = this.createNode('root', null);
    this.currentNode = this.root;
  }

  /** Create a new session node */
  private createNode(id: string, parent: SessionNode | null): SessionNode {
    const node: SessionNode = {
      id,
      parent,
      children: [],
      metadata: {},
      tokenCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.nodeCount++;
    
    // Add to parent's children
    if (parent) {
      parent.children.push(node);
    }
    
    // Prune if we exceed max nodes
    if (this.nodeCount > this.maxNodes) {
      this.pruneLeastRecentlyUsed();
    }
    
    return node;
  }

  /** Add a new branch to the current node */
  addBranch(branchId: string, tokenCount: number): SessionNode {
    // Check token budget
    if (!this.canAllocateTokens(tokenCount)) {
      throw new Error('Token budget exceeded');
    }
    
    // Create new node
    const newNode = this.createNode(branchId, this.currentNode);
    newNode.tokenCount = tokenCount;
    
    // Update token budget
    this.tokenBudget.usedTokens += tokenCount;
    
    // Set as current node
    this.currentNode = newNode;
    
    return newNode;
  }

  /** Navigate to a specific node */
  navigateTo(nodeId: string): boolean {
    const node = this.findNode(nodeId);
    if (node) {
      this.currentNode = node;
      node.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  /** Find a node by ID */
  private findNode(nodeId: string, startNode: SessionNode = this.root): SessionNode | null {
    if (startNode.id === nodeId) {
      return startNode;
    }
    
    for (const child of startNode.children) {
      const found = this.findNode(nodeId, child);
      if (found) {
        return found;
      }
    }
    
    return null;
  }

  /** Check if we can allocate more tokens */
  private canAllocateTokens(tokens: number): boolean {
    const available = this.tokenBudget.maxTokens - this.tokenBudget.usedTokens - this.tokenBudget.reservedTokens;
    return available >= tokens;
  }

  /** Reserve tokens for future use */
  reserveTokens(tokens: number): void {
    if (!this.canAllocateTokens(tokens)) {
      throw new Error('Cannot reserve tokens: budget exceeded');
    }
    this.tokenBudget.reservedTokens += tokens;
  }

  /** Release reserved tokens */
  releaseTokens(tokens: number): void {
    this.tokenBudget.reservedTokens = Math.max(0, this.tokenBudget.reservedTokens - tokens);
  }

  /** Get current token budget status */
  getTokenBudget(): TokenBudget {
    return {
      ...this.tokenBudget,
      availableTokens: this.tokenBudget.maxTokens - this.tokenBudget.usedTokens - this.tokenBudget.reservedTokens
    };
  }

  /** Prune least recently used nodes */
  private pruneLeastRecentlyUsed(): void {
    // Find all nodes except root
    const allNodes = this.collectAllNodes(this.root);
    allNodes.shift(); // Remove root
    
    // Sort by last accessed time
    allNodes.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest nodes until we're under the limit
    while (this.nodeCount > this.maxNodes && allNodes.length > 0) {
      const nodeToRemove = allNodes.shift()!;
      this.removeNode(nodeToRemove);
    }
  }

  /** Collect all nodes in the tree */
  private collectAllNodes(startNode: SessionNode): SessionNode[] {
    const nodes = [startNode];
    
    for (const child of startNode.children) {
      nodes.push(...this.collectAllNodes(child));
    }
    
    return nodes;
  }

  /** Remove a node and its children */
  private removeNode(node: SessionNode): void {
    // Remove from parent's children
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
    
    // Free tokens
    this.tokenBudget.usedTokens -= node.tokenCount;
    
    // Decrement node count
    this.nodeCount--;
    
    // If we're removing the current node, navigate to parent
    if (node === this.currentNode) {
      this.currentNode = node.parent || this.root;
    }
  }

  /** Get the current session path */
  getCurrentPath(): string[] {
    const path: string[] = [];
    let node: SessionNode | null = this.currentNode;
    
    while (node && node.id !== 'root') {
      path.unshift(node.id);
      node = node.parent;
    }
    
    return path;
  }

  /** Get the current node */
  getCurrentNode(): SessionNode {
    return this.currentNode;
  }

  /** Reset the session tree */
  reset(): void {
    this.root = this.createNode('root', null);
    this.currentNode = this.root;
    this.tokenBudget.usedTokens = 0;
    this.tokenBudget.reservedTokens = 0;
    this.nodeCount = 1;
  }
}
