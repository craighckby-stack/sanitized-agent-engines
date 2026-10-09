/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
# Autonomous Agent Runtime Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: Extracted from a general-purpose autonomous agent runtime with session management, tool sandboxing, and multi-turn reasoning capabilities.

## 1. Architectural Topology & Component Overview

The Autonomous Agent Runtime Engine is a comprehensive framework for building intelligent agents with multi-turn reasoning, tool execution, and session management capabilities. The architecture consists of five core engines:

1. **Lifecycle Kernel**: Dependency injection, hook dispatch, and disposable registry
2. **ReAct Agent Loop Engine**: Multi-turn reasoning with step budget and trajectory tracking
3. **Unified Model Stream Adapter**: Streaming tokens with thought isolation and tool-call reconstruction
4. **Tool Sandbox & VFS**: In-memory file system with shell interpreter and output sanitization
5. **Non-linear Session Tree & Token Budget**: Branching tree with checkpointing and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the application lifecycle, dependency injection, service registration, and resource cleanup. It provides a centralized mechanism for managing services, scopes, and hooks throughout the agent's execution.

### Inputs & Outputs
- **Inputs**: Service instances, scope configurations, hook callbacks
- **Outputs**: Resolved services, execution scopes, triggered hooks

### Implementation Code
```typescript
import { Disposable, Scope } from './types';

/**
 * Lifecycle Kernel - Dependency injection, hook dispatch, and disposable registry
 */
export class AutonomousAgentLifecycleContext implements Disposable {
  private services = new Map<string, any>();
  private disposables: Disposable[] = [];
  private scopes = new Map<string, Scope>();
  private hooks = new Map<string, Function[]>();

  /** Register a service instance */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
    if (service instanceof Disposable) {
      this.disposables.push(service);
    }
  }

  /** Retrieve a registered service */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  /** Create a new scope for isolated execution */
  createScope(name: string): Scope {
    const scope = new Scope(name);
    this.scopes.set(name, scope);
    return scope;
  }

  /** Get or create a scope */
  getOrCreateScope(name: string): Scope {
    return this.scopes.get(name) || this.createScope(name);
  }

  /** Register a lifecycle hook */
  onHook(name: string, callback: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(callback);
  }

  /** Execute all hooks for an event */
  async triggerHook(name: string, ...args: any[]): Promise<void> {
    const callbacks = this.hooks.get(name) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  /** Dispose all resources */
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    this.services.clear();
    this.disposables = [];
    this.scopes.clear();
    this.hooks.clear();
  }
}

/** Scope for isolated execution contexts */
export class Scope {
  constructor(public name: string) {}

  private variables = new Map<string, any>();

  set<T>(key: string, value: T): void {
    this.variables.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.variables.get(key) as T | undefined;
  }

  clear(): void {
    this.variables.clear();
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements the ReAct (Reasoning and Acting) pattern, enabling multi-turn reasoning with a configurable step budget. It tracks the agent's trajectory through reasoning, action, and observation steps.

### Inputs & Outputs
- **Inputs**: Initial agent state, reasoning function, action function, observation function
- **Outputs**: Final agent state, complete reasoning trajectory

### Implementation Code
```typescript
import { AgentState, Thought, Action, Observation } from './types';

/**
 * ReAct Agent Loop Engine - Multi-turn reasoning with step budget and trajectory tracking
 */
export class AutonomousAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Thought[] = [];

  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }

  /** Execute the ReAct loop until completion or step limit */
  async run(
    initialState: AgentState,
    reason: (state: AgentState) => Promise<Thought>,
    act: (thought: Thought) => Promise<Action>,
    observe: (action: Action) => Promise<Observation>
  ): Promise<{ finalState: AgentState; trajectory: Thought[] }> {
    let state = initialState;
    this.trajectory = [];
    
    for (let step = 0; step < this.maxSteps; step++) {
      // Reason step
      const thought = await reason(state);
      this.trajectory.push(thought);
      
      // Act step
      const action = await act(thought);
      
      // Observe step
      const observation = await observe(action);
      
      // Update state
      state = {
        ...state,
        step: step + 1,
        lastAction: action,
        lastObservation: observation,
        thoughts: [...state.thoughts, thought]
      };
      
      // Check for completion
      if (this.isComplete(state)) {
        break;
      }
    }
    
    return { finalState: state, trajectory: this.trajectory };
  }

  /** Check if the agent should stop reasoning */
  private isComplete(state: AgentState): boolean {
    // Check for explicit completion signals
    if (state.lastObservation?.type === 'final_answer') {
      return true;
    }
    
    // Check for terminal errors
    if (state.lastObservation?.type === 'error') {
      return true;
    }
    
    // Check for max steps reached
    if (state.step >= this.maxSteps) {
      return true;
    }
    
    return false;
  }

  /** Get the reasoning trajectory */
  getTrajectory(): Thought[] {
    return [...this.trajectory];
  }

  /** Reset the engine state */
  reset(): void {
    this.trajectory = [];
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter handles streaming responses from language models, including partial JSON tool-call reconstruction. It isolates reasoning thoughts from tool calls and provides a consistent interface for different model providers.

### Inputs & Outputs
- **Inputs**: Model request, stream chunks, token callback, tool call callback
- **Outputs**: Complete model response with reconstructed tool calls

### Implementation Code
```typescript
import { ModelRequest, ModelResponse, StreamChunk } from './types';

/**
 * Unified Model Stream Adapter - Streaming tokens with thought isolation and tool-call reconstruction
 */
export class AutonomousAgentModelStream {
  private buffer: string = '';
  private toolCalls: any[] = [];
  private currentTool: any = null;
  private isProcessingTool: boolean = false;

  /** Process a stream of model response chunks */
  async processStream(
    request: ModelRequest,
    stream: AsyncIterable<StreamChunk>,
    onToken: (token: string) => void,
    onToolCall: (toolCall: any) => void
  ): Promise<ModelResponse> {
    let fullResponse = '';
    let isComplete = false;
    
    for await (const chunk of stream) {
      const content = chunk.content || '';
      fullResponse += content;
      
      // Process tool calls if present
      if (chunk.tool_calls) {
        for (const toolCall of chunk.tool_calls) {
          await this.processToolCall(toolCall, onToolCall);
        }
      }
      
      // Emit tokens for display
      onToken(content);
      
      // Check for completion
      if (chunk.finish_reason) {
        isComplete = true;
      }
    }
    
    return {
      request,
      content: fullResponse,
      tool_calls: this.toolCalls,
      finish_reason: isComplete ? 'stop' : null
    };
  }

  /** Process a tool call from the stream */
  private async processToolCall(toolCall: any, onToolCall: (toolCall: any) => void): Promise<void> {
    if (!this.isProcessingTool) {
      // Start new tool call
      this.currentTool = {
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function.name,
          arguments: ''
        }
      };
      this.isProcessingTool = true;
      onToolCall(this.currentTool);
    }
    
    // Append arguments
    if (this.currentTool && toolCall.function.arguments) {
      this.currentTool.function.arguments += toolCall.function.arguments;
      
      // Update the existing tool call in the callback
      onToolCall(this.currentTool);
    }
    
    // Check for tool completion
    if (toolCall.finish_reason === 'stop') {
      if (this.currentTool) {
        this.toolCalls.push(this.currentTool);
        this.currentTool = null;
        this.isProcessingTool = false;
      }
    }
  }

  /** Reset the stream state */
  reset(): void {
    this.buffer = '';
    this.toolCalls = [];
    this.currentTool = null;
    this.isProcessingTool = false;
  }

  /** Extract partial JSON from the buffer */
  extractPartialJSON(): any | null {
    try {
      // Try to parse as complete JSON first
      return JSON.parse(this.buffer);
    } catch {
      // If that fails, try to extract partial JSON
      const start = this.buffer.indexOf('{');
      if (start === -1) return null;
      
      const end = this.buffer.lastIndexOf('}');
      if (end === -1) return null;
      
      const partial = this.buffer.substring(start, end + 1);
      return JSON.parse(partial);
    }
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a secure execution environment for tools with an in-memory file system. It includes a shell interpreter with output sanitization to prevent security vulnerabilities.

### Inputs & Outputs
- **Inputs**: Tool calls with parameters
- **Outputs**: Tool execution results with success status and content

### Implementation Code
```typescript
import { FileSystem, ToolCall, ToolResult } from './types';

/**
 * Tool Sandbox & VFS - In-memory file system with shell interpreter and output sanitization
 */
export class AutonomousAgentToolSandbox {
  private fileSystem: FileSystem;
  private workingDirectory: string = '/';
  private environment: Record<string, string> = {};
  private maxOutputSize: number = 100000; // 100KB

  constructor() {
    this.fileSystem = this.createEmptyFileSystem();
  }

  /** Create an empty file system */
  private createEmptyFileSystem(): FileSystem {
    return {
      '/': {
        type: 'directory',
        children: {}
      }
    };
  }

  /** Execute a tool call in the sandbox */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = toolCall;
    
    try {
      switch (name) {
        case 'read_file':
          return this.readFile(args.path);
        case 'write_file':
          return this.writeFile(args.path, args.content);
        case 'list_directory':
          return this.listDirectory(args.path);
        case 'execute_command':
          return this.executeCommand(args.command);
        default:
          return {
            success: false,
            content: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /** Read a file from the virtual file system */
  private readFile(path: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    let current: any = this.fileSystem['/'];
    
    for (const part of parts) {
      if (!current.children || !current.children[part]) {
        return {
          success: false,
          content: `File not found: ${path}`
        };
      }
      current = current.children[part];
    }
    
    if (current.type !== 'file') {
      return {
        success: false,
        content: `Path is not a file: ${path}`
      };
    }
    
    return {
      success: true,
      content: current.content || ''
    };
  }

  /** Write a file to the virtual file system */
  private writeFile(path: string, content: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    // Ensure directory exists
    let current: any = this.fileSystem['/'];
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = {
          type: 'directory',
          children: {}
        };
      }
      current = current.children[part];
    }
    
    // Create or update file
    const fileName = parts[parts.length - 1];
    current.children[fileName] = {
      type: 'file',
      content: content
    };
    
    return {
      success: true,
      content: `File written: ${path}`
    };
  }

  /** List directory contents */
  private listDirectory(path: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    let current: any = this.fileSystem['/'];
    
    for (const part of parts) {
      if (!current.children || !current.children[part]) {
        return {
          success: false,
          content: `Directory not found: ${path}`
        };
      }
      current = current.children[part];
    }
    
    if (current.type !== 'directory') {
      return {
        success: false,
        content: `Path is not a directory: ${path}`
      };
    }
    
    const contents = Object.keys(current.children || {});
    return {
      success: true,
      content: contents.join('\n')
    };
  }

  /** Execute a shell command */
  private executeCommand(command: string): ToolResult {
    // In a real implementation, this would use a safe shell interpreter
    // For this example, we'll simulate command execution
    
    // Sanitize command to prevent injection
    const sanitized = command.replace(/[^a-zA-Z0-9 _\-\.,]/g, '');
    
    // Simulate command output
    let output = '';
    
    if (sanitized.startsWith('ls')) {
      output = 'file1.txt\nfile2.txt\ndirectory1\n';
    } else if (sanitized.startsWith('echo')) {
      output = sanitized.substring(4).trim() + '\n';
    } else {
      output = `Command executed: ${sanitized}\n`;
    }
    
    // Truncate output if too large
    if (output.length > this.maxOutputSize) {
      output = output.substring(0, this.maxOutputSize) + '\n... (output truncated)';
    }
    
    return {
      success: true,
      content: output
    };
  }

  /** Normalize a file path */
  private normalizePath(path: string): string {
    // Resolve relative paths
    if (path.startsWith('./')) {
      path = this.workingDirectory + '/' + path.substring(2);
    } else if (path.startsWith('../')) {
      // Handle parent directory navigation
      const parts = this.workingDirectory.split('/').filter(p => p);
      while (path.startsWith('../')) {
        if (parts.length > 0) {
          parts.pop();
        }
        path = path.substring(3);
      }
      path = '/' + parts.join('/') + '/' + path;
    } else if (!path.startsWith('/')) {
      path = this.workingDirectory + '/' + path;
    }
    
    // Remove duplicate slashes
    path = path.replace(/\/+/g, '/');
    
    // Remove trailing slash (except for root)
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    return path;
  }

  /** Get the current working directory */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /** Change the working directory */
  setWorkingDirectory(path: string): void {
    this.workingDirectory = this.normalizePath(path);
  }

  /** Get the virtual file system state */
  getFileSystem(): FileSystem {
    return JSON.parse(JSON.stringify(this.fileSystem));
  }

  /** Reset the sandbox state */
  reset(): void {
    this.fileSystem = this.createEmptyFileSystem();
    this.workingDirectory = '/';
    this.environment = {};
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages branching conversation sessions with checkpointing. It tracks token usage across branches and implements LRU pruning to manage memory efficiently.

### Inputs & Outputs
- **Inputs**: Branch IDs, token counts, navigation requests
- **Outputs**: Current session path, token budget status, session tree state

### Implementation Code
```typescript
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
```
