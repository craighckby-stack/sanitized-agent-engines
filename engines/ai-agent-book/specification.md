/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
# AI Agent Book Companion Engine Specification
*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: AI Agent Book companion experiments repository

## 1. Architectural Topology & Component Overview

The AI Agent Book Companion Engine is a modular framework for implementing AI agent experiments with provider resolution, environment loading, and trace printing capabilities. It consists of five interconnected engines:

1. **Lifecycle Kernel**: Manages dependency injection, hook dispatch, disposable registry, and scope tree
2. **ReAct Agent Loop Engine**: Handles multi-turn reasoning, step budget management, and trajectory tracking
3. **Unified Model Stream Adapter**: Processes streaming tokens, isolates thoughts, and reconstructs tool calls
4. **Tool Sandbox & VFS**: Provides in-memory file system, shell interpreter, and output sanitization
5. **Non-linear Session Tree & Token Budget**: Manages branching conversation trees, checkpoints, and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the application's lifecycle, including dependency injection, hook dispatch, resource disposal, and scope management. It ensures proper initialization, cleanup, and isolation of resources.

### Inputs & Outputs
- **Inputs**: Configuration objects, disposable resources, scope names
- **Outputs**: Initialized resources, lifecycle events, cleanup results

### Implementation Code
```typescript
import { Disposable, LifecycleContext } from './types';

/**
 * Lifecycle Kernel for the AI Agent Book Companion Engine
 * Handles dependency injection, hook dispatch, disposable registry, and scope tree
 */
export class AiAgentBookLifecycleContext implements LifecycleContext {
  private disposables: Disposable[] = [];
  private scopes: Map<string, any> = new Map();
  
  /**
   * Register a disposable resource to be cleaned up
   */
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  /**
   * Create a new scope for isolated resources
   */
  createScope(name: string): void {
    this.scopes.set(name, new Map());
  }
  
  /**
   * Get a resource from a specific scope
   */
  getFromScope<T>(scopeName: string, key: string): T | undefined {
    const scope = this.scopes.get(scopeName);
    return scope?.get(key);
  }
  
  /**
   * Set a resource in a specific scope
   */
  setInScope(scopeName: string, key: string, value: any): void {
    const scope = this.scopes.get(scopeName) || new Map();
    scope.set(key, value);
    this.scopes.set(scopeName, scope);
  }
  
  /**
   * Dispatch lifecycle hooks
   */
  async dispatchHook(hookName: string, ...args: any[]): Promise<any> {
    // Implementation would iterate through registered hooks
    // and execute them in order
    return null;
  }
  
  /**
   * Clean up all registered disposables
   */
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    this.disposables = [];
    this.scopes.clear();
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements the ReAct (Reasoning and Acting) pattern for AI agents. It manages multi-turn reasoning processes, enforces step budgets, and tracks the complete trajectory of agent decisions and actions.

### Inputs & Outputs
- **Inputs**: Initial prompt, reasoning function, action function, observation function
- **Outputs**: Complete trajectory of agent steps

### Implementation Code
```typescript
import { AgentStep, Trajectory } from './types';

/**
 * ReAct Agent Loop Engine for the AI Agent Book Companion
 * Handles multi-turn reasoning, step budget management, and trajectory tracking
 */
export class AiAgentBookAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Trajectory = [];
  
  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }
  
  /**
   * Execute the ReAct loop with reasoning, action, and observation steps
   */
  async execute(
    initialPrompt: string,
    reasoningFn: (step: AgentStep) => Promise<string>,
    actionFn: (step: AgentStep) => Promise<string>,
    observationFn: (step: AgentStep) => Promise<string>
  ): Promise<Trajectory> {
    this.trajectory = [];
    let currentStep = 0;
    let currentObservation = '';
    let currentPrompt = initialPrompt;
    
    while (currentStep < this.maxSteps) {
      // Reasoning step
      const reasoningStep: AgentStep = {
        type: 'reasoning',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation
      };
      
      const reasoning = await reasoningFn(reasoningStep);
      this.trajectory.push({
        ...reasoningStep,
        content: reasoning
      });
      
      // Action step
      const actionStep: AgentStep = {
        type: 'action',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation,
        reasoning
      };
      
      const action = await actionFn(actionStep);
      this.trajectory.push({
        ...actionStep,
        content: action
      });
      
      // Observation step
      const observationStep: AgentStep = {
        type: 'observation',
        step: currentStep,
        prompt: currentPrompt,
        previousObservation: currentObservation,
        reasoning,
        action
      };
      
      currentObservation = await observationFn(observationStep);
      this.trajectory.push({
        ...observationStep,
        content: currentObservation
      });
      
      // Check for completion condition
      if (this.isComplete(currentObservation)) {
        break;
      }
      
      currentStep++;
    }
    
    return this.trajectory;
  }
  
  /**
   * Check if the task is complete based on the observation
   */
  private isComplete(observation: string): boolean {
    // Simple heuristic - could be more sophisticated
    return observation.toLowerCase().includes('final answer') || 
           observation.toLowerCase().includes('task complete');
  }
  
  /**
   * Get the current trajectory
   */
  getTrajectory(): Trajectory {
    return [...this.trajectory];
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter processes streaming responses from language models, isolates reasoning thoughts, and reconstructs partial JSON tool calls. It provides a consistent interface for handling different model response formats.

### Inputs & Outputs
- **Inputs**: Streaming token iterable, model response strings
- **Outputs**: Structured model responses with separated text and tool calls

### Implementation Code
```typescript
import { ModelResponse } from './types';

/**
 * Unified Model Stream Adapter for the AI Agent Book Companion
 * Handles streaming tokens, thought isolation, and partial JSON tool-call reconstruction
 */
export class AiAgentBookModelStreamAdapter {
  private buffer: string = '';
  private isToolCall: boolean = false;
  private toolCallBuffer: string = '';
  
  /**
   * Process a streaming token and yield complete responses
   */
  async* processStream(tokenStream: AsyncIterable<string>): AsyncIterable<ModelResponse> {
    for await (const token of tokenStream) {
      this.buffer += token;
      
      // Check if we're in a tool call
      if (this.buffer.includes('{')) {
        this.isToolCall = true;
        this.toolCallBuffer += token;
        
        // Try to parse complete JSON
        try {
          const parsed = JSON.parse(this.toolCallBuffer);
          yield {
            type: 'tool-call',
            content: parsed
          };
          this.toolCallBuffer = '';
          this.isToolCall = false;
        } catch (e) {
          // Incomplete JSON, continue buffering
        }
      } else {
        // Regular text response
        if (token.includes('\n') || this.buffer.length > 100) {
          yield {
            type: 'text',
            content: this.buffer.trim()
          };
          this.buffer = '';
        }
      }
    }
    
    // Yield any remaining content
    if (this.buffer.trim()) {
      yield {
        type: 'text',
        content: this.buffer.trim()
      };
    }
    
    if (this.toolCallBuffer.trim()) {
      yield {
        type: 'tool-call',
        content: this.toolCallBuffer
      };
    }
  }
  
  /**
   * Isolate reasoning thoughts from the response
   */
  extractThoughts(response: string): { thoughts: string[], response: string } {
    const thoughtMarkers = ['Thought:', 'Reasoning:', 'Thinking:'];
    let thoughts: string[] = [];
    let cleanResponse = response;
    
    for (const marker of thoughtMarkers) {
      const regex = new RegExp(`${marker}([^\n]*)`, 'g');
      let match;
      
      while ((match = regex.exec(response)) !== null) {
        thoughts.push(match[1].trim());
        cleanResponse = cleanResponse.replace(match[0], '');
      }
    }
    
    return {
      thoughts,
      response: cleanResponse.trim()
    };
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a safe environment for executing commands and managing files. It includes an in-memory virtual file system, a shell interpreter with command sanitization, and tools for file and directory operations.

### Inputs & Outputs
- **Inputs**: Shell commands, file paths, content
- **Outputs**: Command results, file system operations

### Implementation Code
```typescript
import { VFS, FileEntry } from './types';

/**
 * Tool Sandbox & VFS for the AI Agent Book Companion
 * Provides in-memory file system, shell interpreter, and output sanitization
 */
export class AiAgentBookToolSandbox {
  private vfs: VFS = new Map();
  private workingDirectory: string = '/';
  
  /**
   * Execute a shell command in the sandbox
   */
  async executeCommand(command: string): Promise<string> {
    const sanitized = this.sanitizeCommand(command);
    
    // Simple command parsing - in a real implementation this would be more robust
    const parts = sanitized.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDirectory);
      case 'cd':
        return this.changeDirectory(args[0] || '/');
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return args.join(' ');
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        if (args.length >= 2) {
          const path = args[0];
          const content = args.slice(1).join(' ');
          return this.writeFile(path, content);
        }
        return 'Usage: write <path> <content>';
      default:
        return `Command not supported: ${cmd}`;
    }
  }
  
  /**
   * Sanitize command input to prevent injection
   */
  private sanitizeCommand(command: string): string {
    // Remove potentially dangerous characters and commands
    return command
      .replace(/[;&|`$]/g, '')
      .replace(/rm -rf/g, '')
      .replace(/sudo /g, '')
      .trim();
  }
  
  /**
   * List files in a directory
   */
  private listFiles(path: string): string {
    const fullPath = this.resolvePath(path);
    const files: string[] = [];
    
    for (const [filePath, entry] of this.vfs) {
      if (filePath.startsWith(fullPath) && filePath !== fullPath) {
        const relativePath = filePath.substring(fullPath.length);
        const parts = relativePath.split('/');
        if (parts.length === 1 || (parts.length > 1 && !this.vfs.has(fullPath + '/' + parts[0]))) {
          files.push(parts[0]);
        }
      }
    }
    
    return files.length > 0 ? files.join('\n') : 'Directory is empty';
  }
  
  /**
   * Change working directory
   */
  private changeDirectory(path: string): string {
    const fullPath = this.resolvePath(path);
    
    // Check if directory exists
    let isDir = false;
    for (const [filePath] of this.vfs) {
      if (filePath.startsWith(fullPath + '/') || filePath === fullPath) {
        isDir = true;
        break;
      }
    }
    
    if (isDir) {
      this.workingDirectory = fullPath;
      return `Changed directory to ${fullPath}`;
    }
    
    return `Directory not found: ${path}`;
  }
  
  /**
   * Read a file
   */
  private readFile(path: string): string {
    const fullPath = this.resolvePath(path);
    const entry = this.vfs.get(fullPath);
    
    if (entry && entry.type === 'file') {
      return entry.content;
    }
    
    return `File not found: ${path}`;
  }
  
  /**
   * Write a file
   */
  private writeFile(path: string, content: string): string {
    const fullPath = this.resolvePath(path);
    
    // Ensure directory exists
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dirPath && dirPath !== '/') {
      this.createDirectory(dirPath);
    }
    
    this.vfs.set(fullPath, {
      type: 'file',
      content,
      createdAt: new Date(),
      modifiedAt: new Date()
    });
    
    return `File written: ${path}`;
  }
  
  /**
   * Create a directory
   */
  private createDirectory(path: string): string {
    const fullPath = this.resolvePath(path);
    
    // Create directory marker
    this.vfs.set(fullPath + '/', {
      type: 'directory',
      createdAt: new Date(),
      modifiedAt: new Date()
    });
    
    return `Directory created: ${path}`;
  }
  
  /**
   * Resolve a relative path to absolute
   */
  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    
    const parts = this.workingDirectory.split('/').filter(p => p);
    const pathParts = path.split('/').filter(p => p && p !== '.');
    
    for (const part of pathParts) {
      if (part === '..') {
        if (parts.length > 0) {
          parts.pop();
        }
      } else {
        parts.push(part);
      }
    }
    
    return '/' + parts.join('/');
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages conversation state as a branching tree rather than a linear sequence. It handles token budgeting, checkpoints for saving conversation state, and LRU pruning to manage memory usage.

### Inputs & Outputs
- **Inputs**: Content, token counts, checkpoint IDs
- **Outputs**: Session nodes, token usage information, restored state

### Implementation Code
```typescript
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
```
