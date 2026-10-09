/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Autonomous Agent Harness Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: zhayujie/CowAgent
 */

import { LRUCache } from 'lru-cache';

/**
 * Non-linear Session Tree & Token Budget - Branching tree, checkpoint, and LRU pruning
 */
export class autonomousAgentHarnessSessionTree {
  private root: SessionNode;
  private currentNode: SessionNode;
  private tokenBudget: number;
  private usedTokens: number;
  private checkpointInterval: number;
  private nodeCache: LRUCache<string, SessionNode>;

  constructor(tokenBudget: number = 4000, checkpointInterval: number = 5) {
    this.tokenBudget = tokenBudget;
    this.usedTokens = 0;
    this.checkpointInterval = checkpointInterval;
    
    // Initialize LRU cache with 1000 nodes
    this.nodeCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
    
    // Create root node
    this.root = new SessionNode('root', null);
    this.currentNode = this.root;
    this.nodeCache.set('root', this.root);
  }

  /**
   * Add a new message to the current node
   */
  addMessage(role: 'user' | 'assistant' | 'tool', content: string, toolCallId?: string): void {
    const message = { role, content, ...(toolCallId ? { toolCallId } : {}) };
    this.currentNode.addMessage(message);
    this.updateTokenUsage(content);
  }

  /**
   * Create a branch from the current node
   */
  createBranch(branchId: string): SessionNode {
    const branch = new SessionNode(branchId, this.currentNode);
    this.currentNode.addChild(branch);
    this.nodeCache.set(branch.id, branch);
    return branch;
  }

  /**
   * Switch to a different branch
   */
  switchToBranch(branchId: string): boolean {
    const node = this.nodeCache.get(branchId);
    if (node && node.parent) {
      this.currentNode = node;
      return true;
    }
    return false;
  }

  /**
   * Get the current conversation path
   */
  getCurrentPath(): string[] {
    const path: string[] = [];
    let node: SessionNode | null = this.currentNode;
    
    while (node && node.id !== 'root') {
      path.unshift(node.id);
      node = node.parent;
    }
    
    return path;
  }

  /**
   * Get messages from the current branch
   */
  getMessages(): any[] {
    return this.currentNode.getMessages();
  }

  /**
   * Check if we need to create a checkpoint
   */
  shouldCreateCheckpoint(): boolean {
    return this.currentNode.messageCount % this.checkpointInterval === 0;
  }

  /**
   * Create a checkpoint at the current node
   */
  createCheckpoint(): string {
    const checkpointId = `checkpoint_${Date.now()}`;
    this.currentNode.createCheckpoint(checkpointId);
    return checkpointId;
  }

  /**
   * Restore from a checkpoint
   */
  restoreFromCheckpoint(checkpointId: string): boolean {
    const node = this.nodeCache.get(checkpointId);
    if (node) {
      this.currentNode = node;
      return true;
    }
    return false;
  }

  /**
   * Prune old branches to save memory
   */
  prune(maxNodes: number = 100): void {
    if (this.nodeCache.size > maxNodes) {
      // Get all node IDs sorted by last access time
      const allNodes = Array.from(this.nodeCache.entries()).map(([id, node]) => ({
        id,
        node,
        lastAccess: node.lastAccess,
      }));
      
      // Sort by last access time (oldest first)
      allNodes.sort((a, b) => a.lastAccess - b.lastAccess);
      
      // Remove oldest nodes until we're under the limit
      // Keep root node and current node
      const nodesToRemove = allNodes.slice(0, allNodes.length - maxNodes + 2);
      
      for (const { id } of nodesToRemove) {
        if (id !== 'root' && id !== this.currentNode.id) {
          this.nodeCache.delete(id);
        }
      }
    }
  }

  /**
   * Get token usage statistics
   */
  getTokenUsage(): { used: number; budget: number; percentage: number } {
    return {
      used: this.usedTokens,
      budget: this.tokenBudget,
      percentage: Math.round((this.usedTokens / this.tokenBudget) * 100),
    };
  }

  /**
   * Update token usage
   */
  private updateTokenUsage(content: string): void {
    // Simple token estimation (4 chars per token)
    const tokens = Math.ceil(content.length / 4);
    this.usedTokens += tokens;
    
    // Update last access time for current node
    this.currentNode.updateLastAccess();
  }

  /**
   * Reset the session tree
   */
  reset(): void {
    this.root = new SessionNode('root', null);
    this.currentNode = this.root;
    this.usedTokens = 0;
    this.nodeCache.clear();
    this.nodeCache.set('root', this.root);
  }
}

/**
 * Session node representing a point in the conversation tree
 */
class SessionNode {
  id: string;
  parent: SessionNode | null;
  children: SessionNode[] = [];
  messages: any[] = [];
  checkpoints: Set<string> = new Set();
  messageCount: number = 0;
  lastAccess: number = Date.now();

  constructor(id: string, parent: SessionNode | null) {
    this.id = id;
    this.parent = parent;
  }

  addMessage(message: any): void {
    this.messages.push(message);
    this.messageCount++;
    this.updateLastAccess();
  }

  addChild(child: SessionNode): void {
    this.children.push(child);
    this.updateLastAccess();
  }

  getMessages(): any[] {
    this.updateLastAccess();
    return [...this.messages];
  }

  createCheckpoint(checkpointId: string): void {
    this.checkpoints.add(checkpointId);
    this.updateLastAccess();
  }

  updateLastAccess(): void {
    this.lastAccess = Date.now();
  }
}
