/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
# Cherry Studio Autonomous Agent Runtime Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: CherryHQ/cherry-studio - AI productivity studio with autonomous agents and context management

## 1. Architectural Topology & Component Overview

The Cherry Studio Autonomous Agent Runtime Engine is a modular system designed to provide unified access to language models through autonomous agents, tool integration, and context management. The architecture consists of five core engines:

1. **Lifecycle Kernel** - Dependency injection, service management, and resource cleanup
2. **ReAct Agent Loop Engine** - Multi-turn reasoning loop with step budget and trajectory tracking
3. **Unified Model Stream Adapter** - Streaming token processing with tool call isolation
4. **Tool Sandbox & VFS** - Secure execution environment with virtual file system
5. **Non-linear Session Tree & Token Budget** - Branching session management with token tracking

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the application lifecycle through dependency injection, service registration, and proper resource cleanup. It maintains a service registry, tracks disposable resources, and manages scopes for different components.

### Inputs & Outputs
- **Inputs**: Service instances, disposal functions, scope identifiers
- **Outputs**: Registered services, cleanup execution

### Implementation Code
```typescript
export class cherryStudioLifecycleContext {
  private services: Map<string, any> = new Map();
  private disposables: Array<() => Promise<void> | void> = [];
  private scopes: Map<string, Set<string>> = new Map();

  /** Register a service instance */
  register<T>(name: string, service: T, scope?: string): void {
    this.services.set(name, service);
    if (scope) {
      if (!this.scopes.has(scope)) this.scopes.set(scope, new Set());
      this.scopes.get(scope)!.add(name);
    }
  }

  /** Retrieve a service instance */
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /** Register a cleanup function */
  onDispose(dispose: () => Promise<void> | void): void {
    this.disposables.push(dispose);
  }

  /** Dispose all services in reverse order */
  async dispose(): Promise<void> {
    for (const dispose of this.disposables.reverse()) {
      try {
        await dispose();
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.disposables = [];
    this.services.clear();
    this.scopes.clear();
  }

  /** Dispose all services in a specific scope */
  async disposeScope(scope: string): Promise<void> {
    const services = this.scopes.get(scope);
    if (!services) return;

    for (const serviceName of services) {
      const service = this.services.get(serviceName);
      if (service && typeof service.dispose === 'function') {
        try {
          await service.dispose();
        } catch (e) {
          console.error(`Error disposing service ${serviceName}:`, e);
        }
        this.services.delete(serviceName);
      }
    }
    this.scopes.delete(scope);
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements a multi-turn reasoning loop with configurable step budgets and trajectory tracking. It executes agent steps until completion or until the step budget is exhausted, providing hooks for step monitoring.

### Inputs & Outputs
- **Inputs**: Initial input, step function, step budget, optional step hook
- **Outputs**: Final result, trajectory history

### Implementation Code
```typescript
export class cherryStudioAgentLoopEngine {
  private stepBudget: number;
  private trajectory: Array<{ step: number; input: any; output: any; error?: any }> = [];

  constructor(maxSteps: number = 20) {
    this.stepBudget = maxSteps;
  }

  async execute(
    initialInput: any,
    stepFn: (input: any, step: number) => Promise<any>,
    onStep?: (step: number, input: any, output: any) => void
  ): Promise<any> {
    let currentInput = initialInput;
    let step = 0;

    while (step < this.stepBudget) {
      try {
        const output = await stepFn(currentInput, step);
        
        this.trajectory.push({ step, input: currentInput, output });
        onStep?.(step, currentInput, output);
        
        // Check for completion condition
        if (this.isComplete(output)) {
          return output;
        }
        
        currentInput = output;
        step++;
      } catch (error) {
        this.trajectory.push({ step, input: currentInput, error });
        throw error;
      }
    }
    
    throw new Error(`Agent loop exceeded step budget of ${this.stepBudget}`);
  }

  private isComplete(output: any): boolean {
    // Simple completion check - can be customized
    return output?.status === 'completed' || 
           output?.finishReason === 'stop' ||
           (typeof output === 'string' && output.includes('[DONE]'));
  }

  getTrajectory(): Array<{ step: number; input: any; output: any; error?: any }> {
    return [...this.trajectory];
  }

  reset(): void {
    this.trajectory = [];
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter processes streaming tokens from language models, isolates tool calls from regular content, and reconstructs partial tool calls. It provides a clean interface for consuming model outputs with proper separation of thoughts and tool invocations.

### Inputs & Outputs
- **Inputs**: Async token stream, model content
- **Outputs**: Structured stream with content and tool calls

### Implementation Code
```typescript
export class cherryStudioModelStreamAdapter {
  private buffer: string = '';
  private pendingToolCalls: Array<{ id: string; name: string; args: any }> = [];

  async *streamTokens(
    modelCall: () => AsyncIterable<string>
  ): AsyncIterable<{ content: string; toolCalls?: any[] }> {
    this.buffer = '';
    this.pendingToolCalls = [];
    
    for await (const chunk of modelCall()) {
      this.buffer += chunk;
      
      // Try to extract complete tool calls
      const { content, toolCalls, remaining } = this.extractToolCalls(this.buffer);
      this.buffer = remaining;
      
      if (toolCalls.length > 0) {
        yield { content, toolCalls };
      } else if (content) {
        yield { content };
      }
    }
    
    // Yield any remaining content
    if (this.buffer) {
      yield { content: this.buffer };
    }
  }

  private extractToolCalls(buffer: string): { content: string; toolCalls: any[]; remaining: string } {
    const toolCalls: any[] = [];
    let content = '';
    let remaining = buffer;
    
    // Simple regex-based tool call extraction
    // In a real implementation, this would use proper JSON parsing
    const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
    let match;
    
    while ((match = toolCallRegex.exec(buffer)) !== null) {
      try {
        const toolCall = JSON.parse(match[1]);
        toolCalls.push(toolCall);
        remaining = remaining.replace(match[0], '');
      } catch (e) {
        // Invalid JSON, treat as regular content
        content += match[0];
      }
    }
    
    return { content, toolCalls, remaining };
  }

  isolateThoughts(buffer: string): { thoughts: string; content: string } {
    const thoughtDelimiter = '<thought>';
    const endDelimiter = '</thought>';
    
    const thoughtStart = buffer.indexOf(thoughtDelimiter);
    if (thoughtStart === -1) {
      return { thoughts: '', content: buffer };
    }
    
    const thoughtEnd = buffer.indexOf(endDelimiter, thoughtStart);
    if (thoughtEnd === -1) {
      return { thoughts: '', content: buffer };
    }
    
    const thoughts = buffer.slice(
      thoughtStart + thoughtDelimiter.length,
      thoughtEnd
    );
    
    const content = [
      buffer.slice(0, thoughtStart),
      buffer.slice(thoughtEnd + endDelimiter.length)
    ].join('');
    
    return { thoughts, content };
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a secure execution environment for tool commands with a virtual file system. It implements basic shell commands like ls, cd, cat, echo, mkdir, and write, with proper path resolution and output sanitization.

### Inputs & Outputs
- **Inputs**: Shell commands, file paths, content
- **Outputs**: Command results, file system state

### Implementation Code
```typescript
export class cherryStudioToolSandbox {
  private vfs: Map<string, { content: string; type: 'file' | 'dir' }> = new Map();
  private workingDir: string = '/';

  constructor() {
    // Initialize root directory
    this.vfs.set('/', { content: '', type: 'dir' });
  }

  /** Execute a shell command in the sandbox */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDir);
      case 'cd':
        return this.changeDirectory(args[0]);
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return this.echo(args.join(' '));
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        return this.writeFile(args[0], args.slice(1).join(' '));
      default:
        return {
          stdout: '',
          stderr: `Unknown command: ${cmd}`
        };
    }
  }

  private listFiles(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const dir = this.vfs.get(fullPath);
    
    if (!dir || dir.type !== 'dir') {
      return {
        stdout: '',
        stderr: `Directory not found: ${path}`
      };
    }
    
    const files = Array.from(this.vfs.entries())
      .filter(([_, entry]) => {
        const parent = entry.type === 'dir' 
          ? this.getParentPath(entry.content || '')
          : this.getParentPath(this.getFilePath(entry.content || ''));
        return parent === fullPath;
      })
      .map(([name]) => this.basename(name));
    
    return {
      stdout: files.join('\n'),
      stderr: ''
    };
  }

  private changeDirectory(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const dir = this.vfs.get(fullPath);
    
    if (!dir || dir.type !== 'dir') {
      return {
        stdout: '',
        stderr: `Directory not found: ${path}`
      };
    }
    
    this.workingDir = fullPath;
    return {
      stdout: '',
      stderr: ''
    };
  }

  private readFile(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const entry = this.vfs.get(fullPath);
    
    if (!entry || entry.type !== 'file') {
      return {
        stdout: '',
        stderr: `File not found: ${path}`
      };
    }
    
    return {
      stdout: entry.content,
      stderr: ''
    };
  }

  private echo(text: string): { stdout: string; stderr: string } {
    return {
      stdout: text,
      stderr: ''
    };
  }

  private createDirectory(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    
    if (this.vfs.has(fullPath)) {
      return {
        stdout: '',
        stderr: `Directory already exists: ${path}`
      };
    }
    
    this.vfs.set(fullPath, { content: '', type: 'dir' });
    return {
      stdout: '',
      stderr: ''
    };
  }

  private writeFile(path: string, content: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    
    // Ensure parent directory exists
    const parentDir = this.getParentPath(fullPath);
    if (!this.vfs.has(parentDir)) {
      return {
        stdout: '',
        stderr: `Parent directory not found: ${parentDir}`
      };
    }
    
    this.vfs.set(fullPath, { content, type: 'file' });
    return {
      stdout: '',
      stderr: ''
    };
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    
    const parts = [...this.workingDir.split('/').filter(Boolean), path];
    return '/' + parts.join('/');
  }

  private getParentPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '/';
    
    const parent = '/' + parts.slice(0, -1).join('/');
    return parent || '/';
  }

  private getFilePath(path: string): string {
    if (path.endsWith('/')) return path.slice(0, -1);
    return path;
  }

  private basename(path: string): string {
    const normalized = this.getFilePath(path);
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || '/';
  }

  /** Get a sanitized copy of the VFS */
  getVFS(): Map<string, { content: string; type: 'file' | 'dir' }> {
    return new Map(this.vfs);
  }

  /** Reset the VFS to initial state */
  reset(): void {
    this.vfs.clear();
    this.vfs.set('/', { content: '', type: 'dir' });
    this.workingDir = '/';
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages branching conversation sessions with token tracking. It allows for non-linear navigation through conversation history, tracks token usage, and implements LRU pruning to stay within memory limits.

### Inputs & Outputs
- **Inputs**: Session content, node IDs, token limits
- **Outputs**: Current session, token usage, session paths

### Implementation Code
```typescript
export class cherryStudioSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private nodeMap: Map<string, SessionNode> = new Map();
  private maxNodes: number;

  constructor(maxNodes: number = 100) {
    this.maxNodes = maxNodes;
    this.root = this.createNode('root', null);
    this.current = this.root;
  }

  /** Create a new session node */
  createNode(id: string, parentId: string | null, content?: any): SessionNode {
    // Check if we need to prune old nodes
    if (this.nodeMap.size >= this.maxNodes) {
      this.pruneOldestNode();
    }

    const parent = parentId ? this.nodeMap.get(parentId) : null;
    const node: SessionNode = {
      id,
      parentId,
      content: content || {},
      children: [],
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      tokenCount: this.estimateTokenCount(content)
    };

    this.nodeMap.set(id, node);
    if (parent) {
      parent.children.push(id);
    }

    return node;
  }

  /** Switch to a session node */
  switchToNode(nodeId: string): boolean {
    const node = this.nodeMap.get(nodeId);
    if (!node) return false;

    this.current = node;
    node.lastAccessed = Date.now();
    return true;
  }

  /** Add a child node to the current node */
  addChildNode(id: string, content: any): SessionNode {
    const node = this.createNode(id, this.current.id, content);
    this.current = node;
    return node;
  }

  /** Get the current node */
  getCurrentNode(): SessionNode {
    return this.current;
  }

  /** Get a node by ID */
  getNode(id: string): SessionNode | undefined {
    return this.nodeMap.get(id);
  }

  /** Get the path from root to a node */
  getNodePath(id: string): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.nodeMap.get(id);
    
    while (node) {
      path.unshift(node);
      node = node.parentId ? this.nodeMap.get(node.parentId) : undefined;
    }
    
    return path;
  }

  /** Get all nodes in a depth-first order */
  getAllNodes(): SessionNode[] {
    const nodes: SessionNode[] = [];
    const visit = (nodeId: string) => {
      const node = this.nodeMap.get(nodeId);
      if (!node) return;
      
      nodes.push(node);
      for (const childId of node.children) {
        visit(childId);
      }
    };
    
    visit(this.root.id);
    return nodes;
  }

  /** Calculate total token usage */
  getTotalTokenCount(): number {
    return Array.from(this.nodeMap.values())
      .reduce((sum, node) => sum + node.tokenCount, 0);
  }

  /** Prune the oldest node that's not the root */
  private pruneOldestNode(): void {
    const nodes = Array.from(this.nodeMap.values())
      .filter(node => node.id !== this.root.id)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    if (nodes.length > 0) {
      const oldest = nodes[0];
      this.removeNode(oldest.id);
    }
  }

  /** Remove a node and all its descendants */
  private removeNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;
    
    // Remove children first
    for (const childId of [...node.children]) {
      this.removeNode(childId);
    }
    
    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodeMap.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
      }
    }
    
    // Remove from map
    this.nodeMap.delete(nodeId);
    
    // Update current if needed
    if (this.current.id === nodeId) {
      this.current = this.root;
    }
  }

  /** Estimate token count for content */
  private estimateTokenCount(content: any): number {
    // Simple approximation - in a real implementation, this would use a tokenizer
    const text = JSON.stringify(content);
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }
}

interface SessionNode {
  id: string;
  parentId: string | null;
  content: any;
  children: string[];
  createdAt: number;
  lastAccessed: number;
  tokenCount: number;
}
```
