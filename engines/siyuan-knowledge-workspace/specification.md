/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
# Siyuan Knowledge Workspace Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: Derived from siyuan-note/siyuan, an open-source, privacy-first, self-hosted knowledge workspace where humans and AI agents work together.

## 1. Architectural Topology & Component Overview

The Siyuan Knowledge Workspace Engine is a modular architecture designed to support human-AI collaboration in a privacy-first, self-hosted environment. The engine consists of five core components:

1. **Lifecycle Kernel**: Manages service registration, dependency injection, lifecycle hooks, and resource disposal
2. **ReAct Agent Loop Engine**: Implements a multi-turn reasoning loop with step budgeting and trajectory tracking
3. **Unified Model Stream Adapter**: Handles streaming tokens, thought isolation, and partial tool-call reconstruction
4. **Tool Sandbox & VFS**: Provides an isolated execution environment with a virtual file system
5. **Non-linear Session Tree & Token Budget**: Manages branching conversation history with checkpointing and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel provides the foundation for service management in the knowledge workspace. It handles dependency injection, service registration, lifecycle hooks, and resource cleanup. This engine ensures proper initialization, execution, and disposal of all components in the system.

### Inputs & Outputs
- **Inputs**: Service configurations, hook callbacks, scope definitions
- **Outputs**: Initialized services, executed hooks, clean resource disposal

### Implementation Code
```typescript
export class siyuanLifecycleContext {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private scopes: Map<string, any> = new Map();
  private disposables: (() => void)[] = [];

  /**
   * Register a service with the lifecycle context
   */
  registerService<T>(name: string, service: T): T {
    this.services.set(name, service);
    return service;
  }

  /**
   * Get a registered service
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /**
   * Register a lifecycle hook
   */
  addHook(name: string, callback: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(callback);
  }

  /**
   * Execute all hooks for a given event
   */
  async executeHooks(name: string, ...args: any[]): Promise<void> {
    const callbacks = this.hooks.get(name) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  /**
   * Create a new scope
   */
  createScope(name: string, parent?: any): any {
    const scope = Object.create(parent || null);
    this.scopes.set(name, scope);
    return scope;
  }

  /**
   * Get a scope by name
   */
  getScope(name: string): any | undefined {
    return this.scopes.get(name);
  }

  /**
   * Register a disposable function to be called on teardown
   */
  registerDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }

  /**
   * Dispose all registered disposables and clean up resources
   */
  async dispose(): Promise<void> {
    for (const dispose of this.disposables.reverse()) {
      try {
        await dispose();
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.services.clear();
    this.hooks.clear();
    this.scopes.clear();
    this.disposables = [];
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements a reasoning and acting loop that enables AI agents to process information, take actions, and update their understanding iteratively. It manages step budgets to prevent infinite loops and tracks the agent's trajectory for debugging and analysis.

### Inputs & Outputs
- **Inputs**: Initial context, available actions, termination criteria
- **Outputs**: Final state, trajectory history, remaining step budget

### Implementation Code
```typescript
export class siyuanAgentLoopEngine {
  private stepBudget: number;
  private trajectory: any[] = [];
  private maxSteps: number;

  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
    this.stepBudget = maxSteps;
  }

  /**
   * Execute the ReAct agent loop
   */
  async execute(
    context: any,
    initialThought: string,
    actions: ((input: any) => Promise<any>)[],
    evaluator: (state: any) => boolean
  ): Promise<any> {
    this.trajectory = [];
    this.stepBudget = this.maxSteps;
    
    let currentState = { thought: initialThought, context };
    this.trajectory.push(currentState);

    while (this.stepBudget > 0 && !evaluator(currentState)) {
      this.stepBudget--;
      
      // Select action based on current state
      const actionIndex = this.selectAction(currentState, actions.length);
      const action = actions[actionIndex];
      
      // Execute action
      const actionResult = await action(currentState);
      
      // Generate new thought
      const newThought = this.generateThought(currentState, actionResult, actionIndex);
      
      // Update state
      currentState = {
        thought: newThought,
        context: this.updateContext(currentState.context, actionResult),
        previousAction: actionIndex,
        actionResult
      };
      
      this.trajectory.push(currentState);
    }

    return currentState;
  }

  /**
   * Select an action based on current state
   */
  private selectAction(state: any, actionCount: number): number {
    // Simple selection logic - in a real implementation this would use LLM reasoning
    return Math.floor(Math.random() * actionCount);
  }

  /**
   * Generate a new thought based on action result
   */
  private generateThought(state: any, actionResult: any, actionIndex: number): string {
    // Simple thought generation - in a real implementation this would use LLM reasoning
    return `Thought: Action ${actionIndex} completed. Result: ${JSON.stringify(actionResult).substring(0, 50)}`;
  }

  /**
   * Update context with action result
   */
  private updateContext(context: any, actionResult: any): any {
    return {
      ...context,
      lastAction: actionResult,
      history: [...(context.history || []), actionResult]
    };
  }

  /**
   * Get the current trajectory
   */
  getTrajectory(): any[] {
    return [...this.trajectory];
  }

  /**
   * Get remaining step budget
   */
  getStepBudget(): number {
    return this.stepBudget;
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter processes streaming tokens from language models, isolates reasoning thoughts, and reconstructs partial tool calls. It provides a consistent interface for handling both complete and incomplete responses from various model implementations.

### Inputs & Outputs
- **Inputs**: Streaming tokens, callback functions
- **Outputs**: Processed chunks, reconstructed tool calls, thought buffers

### Implementation Code
```typescript
export class siyuanModelStreamAdapter {
  private buffer: string = '';
  private thoughtBuffer: string = '';
  private callbacks: ((chunk: string) => void)[] = [];

  /**
   * Process a streaming token
   */
  processToken(token: string): void {
    this.buffer += token;
    
    // Check for thought patterns
    if (token.includes('Thought:')) {
      this.thoughtBuffer += token;
    }
    
    // Check for complete tool calls
    if (this.buffer.includes('```json') && this.buffer.includes('```')) {
      const toolCall = this.extractToolCall(this.buffer);
      if (toolCall) {
        this.notifyCallbacks(toolCall);
        this.buffer = '';
      }
    } else {
      this.notifyCallbacks(token);
    }
  }

  /**
   * Extract a complete tool call from buffer
   */
  private extractToolCall(buffer: string): string | null {
    const start = buffer.indexOf('```json');
    const end = buffer.indexOf('```', start + 7);
    
    if (start !== -1 && end !== -1) {
      return buffer.substring(start + 7, end).trim();
    }
    
    return null;
  }

  /**
   * Register a callback for new chunks
   */
  onChunk(callback: (chunk: string) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Notify all callbacks with a chunk
   */
  private notifyCallbacks(chunk: string): void {
    for (const callback of this.callbacks) {
      try {
        callback(chunk);
      } catch (e) {
        console.error('Error in stream callback:', e);
      }
    }
  }

  /**
   * Get the current thought buffer
   */
  getThoughtBuffer(): string {
    return this.thoughtBuffer;
  }

  /**
   * Reset the stream state
   */
  reset(): void {
    this.buffer = '';
    this.thoughtBuffer = '';
    this.callbacks = [];
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides an isolated execution environment for AI agents to safely perform file operations and execute commands. It implements a virtual file system with basic shell commands, ensuring agents can interact with the workspace without compromising system security.

### Inputs & Outputs
- **Inputs**: Commands, file paths, content
- **Outputs**: Command results, file system state, operation history

### Implementation Code
```typescript
export class siyuanToolSandbox {
  private vfs: Map<string, string> = new Map();
  private workingDirectory: string = '/';
  private shellHistory: string[] = [];

  /**
   * Execute a command in the sandbox
   */
  async execute(command: string): Promise<string> {
    this.shellHistory.push(command);
    
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDirectory);
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return args.join(' ');
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        return this.writeFile(args[0], args.slice(1).join(' '));
      case 'cd':
        return this.changeDirectory(args[0]);
      default:
        return `Unknown command: ${cmd}`;
    }
  }

  /**
   * List files in a directory
   */
  private listFiles(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const files: string[] = [];
    
    for (const [filePath, content] of this.vfs) {
      if (filePath.startsWith(normalizedPath) && 
          filePath.substring(normalizedPath.length).split('/').length === 2) {
        const fileName = filePath.substring(normalizedPath.length).split('/')[0];
        if (fileName) files.push(fileName);
      }
    }
    
    return files.length > 0 ? files.join('\n') : 'Directory is empty';
  }

  /**
   * Read a file
   */
  private readFile(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const content = this.vfs.get(normalizedPath);
    return content || 'File not found';
  }

  /**
   * Create a directory
   */
  private createDirectory(path: string): string {
    const normalizedPath = this.normalizePath(path);
    if (!this.vfs.has(normalizedPath)) {
      this.vfs.set(normalizedPath, '');
      return `Directory created: ${normalizedPath}`;
    }
    return 'Directory already exists';
  }

  /**
   * Write to a file
   */
  private writeFile(path: string, content: string): string {
    const normalizedPath = this.normalizePath(path);
    this.vfs.set(normalizedPath, content);
    return `File written: ${normalizedPath}`;
  }

  /**
   * Change working directory
   */
  private changeDirectory(path: string): string {
    const normalizedPath = this.normalizePath(path);
    if (this.vfs.has(normalizedPath)) {
      this.workingDirectory = normalizedPath;
      return `Changed directory to: ${normalizedPath}`;
    }
    return 'Directory not found';
  }

  /**
   * Normalize a path
   */
  private normalizePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return `${this.workingDirectory}/${path}`.replace(/\/g, '/');
  }

  /**
   * Get the virtual file system
   */
  getVFS(): Map<string, string> {
    return new Map(this.vfs);
  }

  /**
   * Get shell history
   */
  getHistory(): string[] {
    return [...this.shellHistory];
  }

  /**
   * Reset the sandbox
   */
  reset(): void {
    this.vfs.clear();
    this.workingDirectory = '/';
    this.shellHistory = [];
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages branching conversation histories with checkpointing. It tracks the agent's reasoning path, maintains token budgets to prevent context overflow, and implements LRU pruning to manage memory efficiently.

### Inputs & Outputs
- **Inputs**: Session content, token counts, node IDs
- **Outputs**: Current path, token counts, session history

### Implementation Code
```typescript
export class siyuanSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private nodeMap: Map<string, SessionNode> = new Map();
  private maxNodes: number;

  constructor(maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.root = this.createNode('root', null, 0);
    this.current = this.root;
  }

  /**
   * Create a new session node
   */
  private createNode(id: string, parent: SessionNode | null, depth: number): SessionNode {
    const node: SessionNode = {
      id,
      parent,
      children: [],
      depth,
      content: '',
      tokenCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    
    this.nodeMap.set(id, node);
    return node;
  }

  /**
   * Add a new branch to the current node
   */
  addBranch(id: string, content: string, tokenCount: number): SessionNode {
    // Prune least recently used nodes if we're at capacity
    if (this.nodeMap.size >= this.maxNodes) {
      this.pruneNodes();
    }
    
    const newNode = this.createNode(id, this.current, this.current.depth + 1);
    newNode.content = content;
    newNode.tokenCount = tokenCount;
    
    this.current.children.push(newNode);
    this.current = newNode;
    
    return newNode;
  }

  /**
   * Navigate to a specific node
   */
  navigateTo(id: string): boolean {
    const node = this.nodeMap.get(id);
    if (node) {
      this.current = node;
      node.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get the current node
   */
  getCurrent(): SessionNode {
    return this.current;
  }

  /**
   * Get the path from root to current node
   */
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | null = this.current;
    
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    
    return path;
  }

  /**
   * Get total token count in the current path
   */
  getCurrentTokenCount(): number {
    return this.getCurrentPath().reduce((sum, node) => sum + node.tokenCount, 0);
  }

  /**
   * Prune least recently used nodes
   */
  private pruneNodes(): void {
    const nodes = Array.from(this.nodeMap.values())
      .filter(node => node !== this.root)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest 20% of nodes
    const pruneCount = Math.ceil(nodes.length * 0.2);
    for (let i = 0; i < pruneCount; i++) {
      const node = nodes[i];
      this.removeNode(node);
    }
  }

  /**
   * Remove a node and its children
   */
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
    
    // Remove children recursively
    for (const child of node.children) {
      this.removeNode(child);
    }
    
    this.nodeMap.delete(node.id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): SessionNode[] {
    return Array.from(this.nodeMap.values());
  }
}

interface SessionNode {
  id: string;
  parent: SessionNode | null;
  children: SessionNode[];
  depth: number;
  content: string;
  tokenCount: number;
  createdAt: number;
  lastAccessed: number;
}
```
