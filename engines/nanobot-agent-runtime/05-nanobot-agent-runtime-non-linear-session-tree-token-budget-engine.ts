/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Nanobot Autonomous Agent Runtime Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: HKUDS/nanobot
 */

import { LRUCache } from 'lru-cache';

/**
 * Non-linear session tree with branching history and token budget management.
 */
export class NanobotSessionTree {
  private readonly branches: Map<string, SessionBranch> = new Map();
  private readonly cache: LRUCache<string, SessionBranch>;
  private readonly maxTokens: number;
  
  constructor(maxTokens: number = 100000) {
    this.maxTokens = maxTokens;
    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 60, // 1 hour
      fetchMethod: async (key: string) => {
        return this.branches.get(key) || null;
      },
      dispose: (value) => {
        this.branches.delete(value.id);
      }
    });
  }
  
  /**
   * Create a new session branch
   */
  createBranch(parentId?: string): SessionBranch {
    const branch = new SessionBranch(
      parentId || 'root',
      this.maxTokens
    );
    
    this.branches.set(branch.id, branch);
    this.cache.set(branch.id, branch);
    
    return branch;
  }
  
  /**
   * Get a session branch by ID
   */
  getBranch(id: string): SessionBranch | null {
    return this.cache.get(id) || null;
  }
  
  /**
   * Prune old branches to manage memory
   */
  prune(): void {
    const now = Date.now();
    
    for (const [id, branch] of this.branches) {
      if (now - branch.lastAccessed > 1000 * 60 * 30) { // 30 minutes
        this.branches.delete(id);
        this.cache.delete(id);
      }
    }
  }
}

class SessionBranch {
  id: string;
  parentId: string;
  messages: any[] = [];
  tokenCount: number = 0;
  lastAccessed: number = Date.now();
  
  constructor(parentId: string, private readonly maxTokens: number) {
    this.id = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.parentId = parentId;
  }
  
  /**
   * Add a message to the branch
   */
  addMessage(message: any): void {
    this.messages.push(message);
    this.tokenCount += this.estimateTokens(message);
    this.lastAccessed = Date.now();
    
    // Enforce token budget
    if (this.tokenCount > this.maxTokens) {
      this.compact();
    }
  }
  
  /**
   * Estimate token count for a message
   */
  private estimateTokens(message: any): number {
    // Simple approximation - in real implementation would use tokenizer
    return JSON.stringify(message).length / 4;
  }
  
  /**
   * Compact the branch to stay within token budget
   */
  private compact(): void {
    // Remove oldest messages until under budget
    while (this.tokenCount > this.maxTokens * 0.8 && this.messages.length > 1) {
      const removed = this.messages.shift();
      this.tokenCount -= this.estimateTokens(removed);
    }
  }
}
