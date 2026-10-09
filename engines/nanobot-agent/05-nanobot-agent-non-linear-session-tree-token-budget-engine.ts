/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 5: Nanobot Autonomous Agent Framework Engine — Non-Linear Session Tree & Token Budget
 * Source Origin: HKUDS/nanobot
 */

import { LRUCache } from 'lru-cache';
import { nanoid } from 'nanoid';
import { Session } from '../session';
import { SessionSummary } from '../session/summary';

export interface SessionNode {
  id: string;
  session: Session;
  parent?: string;
  children: string[];
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
}

export interface SessionBranch {
  root: string;
  nodes: Map<string, SessionNode>;
}

export class NanobotSessionTree {
  private branches: Map<string, SessionBranch>;
  private nodeCache: LRUCache<string, SessionNode>;
  private maxBranches: number;
  private maxNodesPerBranch: number;

  constructor(maxBranches: number = 10, maxNodesPerBranch: number = 100) {
    this.branches = new Map();
    this.nodeCache = new LRUCache({
      max: maxNodesPerBranch * maxBranches,
      ttl: 1000 * 60 * 60 // 1 hour
    });
    this.maxBranches = maxBranches;
    this.maxNodesPerBranch = maxNodesPerBranch;
  }

  async initialize(): Promise<void> {
    // Initialize with a default branch
    await this.createBranch('default');
  }

  async createBranch(branchId: string, parentId?: string): Promise<string> {
    if (this.branches.size >= this.maxBranches) {
      // Remove the least recently used branch
      const oldestBranch = this.findOldestBranch();
      if (oldestBranch) {
        this.branches.delete(oldestBranch);
      }
    }

    const branch: SessionBranch = {
      root: parentId || nanoid(),
      nodes: new Map()
    };

    // Create root node
    const rootNode: SessionNode = {
      id: branch.root,
      session: await this.createSession(branch.root),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenCount: 0,
      children: []
    };

    branch.nodes.set(branch.root, rootNode);
    this.branches.set(branchId, branch);
    this.nodeCache.set(branch.root, rootNode);

    return branch.root;
  }

  async createNode(branchId: string, parentId?: string): Promise<string> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Check if we need to prune nodes
    if (branch.nodes.size >= this.maxNodesPerBranch) {
      await this.pruneBranch(branchId);
    }

    const nodeId = nanoid();
    const parentSession = parentId ? branch.nodes.get(parentId)?.session : branch.nodes.get(branch.root)?.session;
    
    if (!parentSession) {
      throw new Error(`Parent node not found: ${parentId || branch.root}`);
    }

    // Create new session based on parent
    const newSession = await this.createSession(nodeId, parentSession);
    
    const node: SessionNode = {
      id: nodeId,
      session: newSession,
      parent: parentId || branch.root,
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenCount: 0
    };

    // Add to parent's children
    if (parentId) {
      const parentNode = branch.nodes.get(parentId);
      if (parentNode) {
        parentNode.children.push(nodeId);
        parentNode.updatedAt = Date.now();
      }
    } else {
      // If no parent, add to root's children
      const rootNode = branch.nodes.get(branch.root);
      if (rootNode) {
        rootNode.children.push(nodeId);
        rootNode.updatedAt = Date.now();
      }
    }

    branch.nodes.set(nodeId, node);
    this.nodeCache.set(nodeId, node);

    return nodeId;
  }

  async getNode(branchId: string, nodeId: string): Promise<SessionNode | null> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return null;
    }

    // Check cache first
    let node = this.nodeCache.get(nodeId);
    if (!node) {
      node = branch.nodes.get(nodeId) || null;
      if (node) {
        this.nodeCache.set(nodeId, node);
      }
    }

    return node || null;
  }

  async updateNode(branchId: string, nodeId: string, updates: Partial<SessionNode>): Promise<void> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    const node = branch.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Update node
    Object.assign(node, updates, { updatedAt: Date.now() });
    this.nodeCache.set(nodeId, node);
  }

  async pruneBranch(branchId: string): Promise<void> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Find least recently used nodes (excluding root)
    const nodes = Array.from(branch.nodes.values()).filter(node => node.id !== branch.root);
    nodes.sort((a, b) => a.updatedAt - b.updatedAt);
    
    // Remove oldest nodes
    const nodesToRemove = nodes.slice(0, Math.floor(nodes.length * 0.3));
    for (const node of nodesToRemove) {
      branch.nodes.delete(node.id);
      this.nodeCache.delete(node.id);
    }
  }

  async summarizeBranch(branchId: string): Promise<SessionSummary> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Collect all messages in the branch
    const allMessages = [];
    for (const node of branch.nodes.values()) {
      allMessages.push(...node.session.messages);
    }

    // Create summary
    return {
      id: branchId,
      createdAt: Date.now(),
      tokenCount: allMessages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0),
      summary: 'Branch summary would be generated here',
      checkpointMessages: []
    };
  }

  private async createSession(id: string, parent?: Session): Promise<Session> {
    // In a real implementation, this would create a new session
    // with appropriate initialization based on the parent
    return {
      id,
      key: id,
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private findOldestBranch(): string | null {
    let oldestBranch: string | null = null;
    let oldestTime = Infinity;
    
    for (const [id, branch] of this.branches) {
      const root = branch.nodes.get(branch.root);
      if (root && root.createdAt < oldestTime) {
        oldestTime = root.createdAt;
        oldestBranch = id;
      }
    }
    
    return oldestBranch;
  }

  private estimateMessageTokens(message: any): number {
    // Simple token estimation - in a real implementation,
    // this would use a proper tokenizer
    return JSON.stringify(message).length / 4;
  }
}
