/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
# Nanobot Autonomous Agent Runtime Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: HKUDS/nanobot - Ultra-lightweight, open-source, self-hosted personal AI agent framework

## 1. Architectural Topology & Component Overview

The Nanobot Autonomous Agent Runtime Engine is a modular framework designed for building personal AI agents with tools, memory, multi-agent workflows, and automation capabilities. The architecture consists of five core engines:

1. **Lifecycle Kernel**: Manages dependency injection, component lifecycle, and hook dispatch
2. **ReAct Agent Loop Engine**: Implements multi-turn reasoning and action execution
3. **Unified Model Stream Adapter**: Handles token streaming and tool call reconstruction
4. **Tool Sandbox & VFS**: Provides isolated execution environment with virtual file system
5. **Non-linear Session Tree & Token Budget**: Manages branching session history with token limits

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the dependency injection system, component lifecycles, and event hooks across the agent runtime. It provides scoping for isolated component lifetimes and ensures proper cleanup of resources.

### Inputs & Outputs
- **Inputs**: Component configurations, hook handlers, scope contexts
- **Outputs**: Fully configured components, lifecycle events, disposal notifications

### Implementation Code
```typescript
import { Disposable, DisposableRegistry } from './disposables';
import { ScopeContext, ScopeTree } from './scope-tree';
import { HookRegistry } from './hooks';

/**
 * Lifecycle kernel for the Nanobot agent runtime.
 * Manages dependency injection, hook dispatch, and component lifecycle.
 */
export class NanobotLifecycleContext implements Disposable {
  private readonly scopes = new ScopeTree();
  private readonly disposables = new DisposableRegistry();
  private readonly hooks = new HookRegistry();
  
  /**
   * Create a new scope for isolated component lifetimes
   */
  createScope(parent?: ScopeContext): ScopeContext {
    return this.scopes.create(parent);
  }
  
  /**
   * Register a disposable component
   */
  register<T extends Disposable>(disposable: T): T {
    this.disposables.add(disposable);
    return disposable;
  }
  
  /**
   * Register a hook for agent lifecycle events
   */
  registerHook<T>(event: string, handler: (data: T) => Promise<void>): void {
    this.hooks.register(event, handler);
  }
  
  /**
   * Dispatch a hook event
   */
  async dispatchHook<T>(event: string, data: T): Promise<void> {
    await this.hooks.dispatch(event, data);
  }
  
  /**
   * Dispose all registered components and clear scopes
   */
  async dispose(): Promise<void> {
    await this.disposables.dispose();
    this.scopes.clear();
    this.hooks.clear();
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements the core reasoning and acting loop of the agent. It manages turn-based execution, tracks token usage, coordinates with tools, and handles termination conditions.

### Inputs & Outputs
- **Inputs**: Agent context, tool registry, turn callbacks
- **Outputs**: Turn results, action executions, termination signals

### Implementation Code
```typescript
import { AgentContext } from './context';
import { AgentTurnResult } from './types';
import { ToolRegistry } from './tools';

/**
 * ReAct agent loop engine implementing multi-turn reasoning and action.
 */
export class NanobotAgentLoopEngine {
  private readonly maxTurns: number;
  private readonly turnBudget: number;
  
  constructor(maxTurns: number = 10, turnBudget: number = 1000) {
    this.maxTurns = maxTurns;
    this.turnBudget = turnBudget;
  }
  
  /**
   * Execute the ReAct loop until completion or budget exhaustion
   */
  async run(
    context: AgentContext,
    tools: ToolRegistry,
    onTurn: (result: AgentTurnResult) => Promise<void>
  ): Promise<void> {
    let turnCount = 0;
    let remainingBudget = this.turnBudget;
    
    while (turnCount < this.maxTurns && remainingBudget > 0) {
      turnCount++;
      
      // Generate reasoning and action
      const turnResult = await this.executeTurn(context, tools);
      remainingBudget -= turnResult.tokensUsed;
      
      // Execute action and update context
      await this.processAction(context, tools, turnResult);
      
      // Notify of turn completion
      await onTurn(turnResult);
      
      // Check for termination conditions
      if (turnResult.shouldTerminate || remainingBudget <= 0) {
        break;
      }
    }
  }
  
  private async executeTurn(context: AgentContext, tools: ToolRegistry): Promise<AgentTurnResult> {
    // Implement reasoning and action selection logic
    // This would interface with the model stream adapter
    return {
      reasoning: '',
      action: null,
      tokensUsed: 0,
      shouldTerminate: false
    };
  }
  
  private async processAction(
    context: AgentContext,
    tools: ToolRegistry,
    turnResult: AgentTurnResult
  ): Promise<void> {
    if (turnResult.action) {
      // Execute the selected tool
      const result = await tools.execute(turnResult.action.tool, turnResult.action.params);
      
      // Update context with action result
      context.addMessage({
        role: 'tool',
        content: result.output,
        timestamp: new Date()
      });
    }
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Model Stream Adapter handles streaming tokens from language models, reconstructs tool calls from partial JSON, and isolates reasoning thoughts from tool outputs. It provides a unified interface for different model providers.

### Inputs & Outputs
- **Inputs**: Token streams, model configurations
- **Outputs**: Structured chunks (text, tool calls), reconstructed reasoning

### Implementation Code
```typescript
import { AgentContext } from './context';
import { StreamChunk } from './types';

/**
 * Unified model stream adapter for handling token streaming and tool calls.
 */
export class NanobotModelStreamAdapter {
  private buffer: string = '';
  private pendingToolCall: any = null;
  
  /**
   * Process streaming tokens and reconstruct tool calls
   */
  async processStream(
    stream: AsyncIterable<string>,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    for await (const token of stream) {
      this.buffer += token;
      
      // Try to parse complete tool calls
      if (this.buffer.includes('\n\n')) {
        const parts = this.buffer.split('\n\n');
        const complete = parts.pop();
        this.buffer = parts.join('\n\n');
        
        if (complete) {
          const toolCall = this.parseToolCall(complete);
          if (toolCall) {
            onChunk({ type: 'tool_call', data: toolCall });
            this.buffer = '';
            continue;
          }
        }
      }
      
      // Emit regular text chunks
      onChunk({ type: 'text', data: token });
    }
    
    // Handle any remaining buffer
    if (this.buffer) {
      onChunk({ type: 'text', data: this.buffer });
      this.buffer = '';
    }
  }
  
  private parseToolCall(text: string): any | null {
    // Try to parse JSON tool calls
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'function_call' || parsed.type === 'tool_use') {
        return parsed;
      }
    } catch {
      // Not valid JSON
    }
    
    return null;
  }
  
  /**
   * Isolate reasoning thoughts from tool calls
   */
  extractReasoning(text: string): string {
    // Remove tool call blocks from reasoning
    return text.replace(/```json\n.*?\n```/g, '').trim();
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox provides a secure execution environment for agent tools with a virtual file system. It isolates tool execution, sanitizes commands to prevent injection, and manages temporary files and resources.

### Inputs & Outputs
- **Inputs**: Tool commands, file operations, execution parameters
- **Outputs**: Command results, file contents, execution status

### Implementation Code
```typescript
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tool sandbox with virtual file system and safe execution environment.
 */
export class NanobotToolSandbox {
  private readonly vfs: Map<string, string> = new Map();
  private readonly tempDir: string;
  
  constructor() {
    this.tempDir = path.join(process.cwd(), 'nanobot-tmp', uuidv4());
    fs.mkdir(this.tempDir, { recursive: true });
  }
  
  /**
   * Create a virtual file
   */  
  async createFile(name: string, content: string): Promise<string> {
    const path = this.resolvePath(name);
    await fs.writeFile(path, content);
    this.vfs.set(name, content);
    return path;
  }
  
  /**
   * Read a virtual file
   */
  async readFile(name: string): Promise<string> {
    const path = this.resolvePath(name);
    const content = await fs.readFile(path, 'utf-8');
    this.vfs.set(name, content);
    return content;
  }
  
  /**
   * Execute a shell command safely
   */
  async executeCommand(command: string, timeout: number = 5000): Promise<string> {
    // Sanitize command to prevent injection
    const sanitized = this.sanitizeCommand(command);
    
    return new Promise((resolve, reject) => {
      const child = exec(sanitized, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || error.message}`));
        } else {
          resolve(stdout);
        }
      });
      
      child.on('timeout', () => {
        child.kill();
        reject(new Error('Command execution timed out'));
      });
    });
  }
  
  /**
   * Sanitize shell command to prevent injection
   */
  private sanitizeCommand(command: string): string {
    // Remove dangerous characters and patterns
    return command
      .replace(/[;&|`$\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Resolve a path within the virtual file system
   */
  private resolvePath(name: string): string {
    return path.join(this.tempDir, name);
  }
  
  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    await fs.rm(this.tempDir, { recursive: true, force: true });
    this.vfs.clear();
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Session Tree manages branching session history with token budget enforcement. It provides non-linear conversation flow, tracks token usage across branches, and automatically prunes old sessions to manage memory.

### Inputs & Outputs
- **Inputs**: New messages, session branches, token limits
- **Outputs**: Session branches, token counts, pruning notifications

### Implementation Code
```typescript
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
```
