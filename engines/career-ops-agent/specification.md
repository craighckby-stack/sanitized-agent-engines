/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
# Career Ops Autonomous Agent Engine Specification\n*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*\n\n> **Source Origin**: Derived from career-ops-hq/career-ops, an open-source AI job search agent that scans job boards, scores jobs against CVs, tailors resumes and cover letters, provides interview prep, and tracks job applications with a local-first approach.\n\n## 1. Architectural Topology & Component Overview\n\nThe Career Ops Autonomous Agent Engine is composed of five interconnected engines that work together to provide a comprehensive job search and application assistance system:\n\n1. **Lifecycle Kernel**: Manages the application lifecycle, dependency injection, and resource cleanup.\n2. **ReAct Agent Loop Engine**: Implements the core reasoning and action loop for job search and application tasks.\n3. **Unified Model Stream Adapter**: Handles streaming responses from language models, extracting thoughts and tool calls.\n4. **Tool Sandbox & VFS**: Provides a secure execution environment for tools and a virtual file system for managing application documents.\n5. **Non-linear Session Tree & Token Budget**: Maintains application state across sessions with branching paths and token management.\n\n## Engine 1: Lifecycle Kernel\n### What it does\nThe Lifecycle Kernel manages the application's lifecycle, including dependency injection, resource cleanup, and scope management. It ensures proper initialization and disposal of all components and maintains a registry of disposable resources.\n\n### Inputs & Outputs\n- **Inputs**: Configuration objects, disposable resources\n- **Outputs**: Initialized components, cleanup notifications\n\n### Implementation Code\n```typescript\nimport { Disposable } from './types';\n\nclass CareerOpsLifecycleContext implements Disposable {\n  private disposables: Disposable[] = [];\n  private scopes: Map<string, any> = new Map();\n  \n  /** Register a disposable to be cleaned up on context disposal */\n  register<T extends Disposable>(disposable: T): T {\n    this.disposables.push(disposable);\n    return disposable;\n  }\n  \n  /** Store and retrieve scoped data */\n  setScope<T>(key: string, value: T): void {\n    this.scopes.set(key, value);\n  }\n  \n  getScope<T>(key: string): T | undefined {\n    return this.scopes.get(key);\n  }\n  \n  /** Execute a callback with proper lifecycle management */\n  async runWithScope<T>(key: string, factory: () => Promise<T>): Promise<T> {\n    const existing = this.getScope<T>(key);\n    if (existing) return existing;\n    \n    const value = await factory();\n    this.setScope(key, value);\n    return value;\n  }\n  \n  /** Clean up all registered disposables */\n  dispose(): void {\n    for (const disposable of this.disposables) {\n      try {\n        disposable.dispose();\n      } catch (error) {\n        console.error('Error during disposal:', error);\n      }\n    }\n    this.disposables = [];\n    this.scopes.clear();\n  }\n}\n```\n\n## Engine 2: ReAct Agent Loop Engine\n### What it does\nThe ReAct Agent Loop Engine implements the core reasoning and action loop for job search and application tasks. It manages step execution, tracks agent trajectories, and enforces step budgets to prevent infinite loops.\n\n### Inputs & Outputs\n- **Inputs**: Agent context, step functions\n- **Outputs**: Agent steps, trajectory data\n\n### Implementation Code\n```typescript\nimport { AgentStep, AgentTrajectory } from './types';\n\nclass CareerOpsAgentLoopEngine {\n  private stepBudget: number;\n  private trajectory: AgentStep[] = [];\n  \n  constructor(stepBudget: number = 50) {\n    this.stepBudget = stepBudget;\n  }\n  \n  /** Execute a single ReAct step */\n  async executeStep(\n    context: any,\n    stepFn: (context: any, step: AgentStep) => Promise<AgentStep>\n  ): Promise<AgentStep> {\n    if (this.trajectory.length >= this.stepBudget) {\n      throw new Error(`Step budget exceeded (${this.stepBudget} steps)`);\n    }\n    \n    const step: AgentStep = {\n      id: this.trajectory.length + 1,\n      timestamp: Date.now(),\n      context: { ...context },\n      input: null,\n      output: null,\n      error: null\n    };\n    \n    try {\n      const result = await stepFn(context, step);\n      step.output = result;\n      this.trajectory.push(step);\n      return result;\n    } catch (error) {\n      step.error = error instanceof Error ? error.message : String(error);\n      this.trajectory.push(step);\n      throw error;\n    }\n  }\n  \n  /** Get the current agent trajectory */\n  getTrajectory(): AgentTrajectory {\n    return {\n      steps: [...this.trajectory],\n      totalSteps: this.trajectory.length,\n      budgetRemaining: this.stepBudget - this.trajectory.length\n    };\n  }\n  \n  /** Reset the agent loop */\n  reset(): void {\n    this.trajectory = [];\n  }\n}\n```\n\n## Engine 3: Unified Model Stream Adapter\n### What it does\nThe Unified Model Stream Adapter processes streaming responses from language models, extracting structured thoughts and tool calls from the raw token stream. It handles partial JSON reconstruction for tool calls.\n\n### Inputs & Outputs\n- **Inputs**: Raw token streams\n- **Outputs**: Structured thoughts, tool calls, text chunks\n\n### Implementation Code\n```typescript\nimport { Readable } from 'stream';\n\nclass CareerOpsModelStreamAdapter {\n  private buffer: string = '';\n  private thoughtDelimiter: string = '### THOUGHT ###';\n  private toolCallDelimiter: string = '### TOOL ###';\n  \n  /** Process a stream of tokens and extract thoughts/tool calls */\n  async *processStream(stream: Readable): AsyncGenerator<{ type: 'thought' | 'tool' | 'text'; content: string }> {\n    for await (const chunk of stream) {\n      this.buffer += chunk.toString();\n      \n      // Extract thoughts\n      const thoughtMatch = this.buffer.match(new RegExp(`${this.thoughtDelimiter}([^${this.thoughtDelimiter}]*)${this.thoughtDelimiter}`));\n      if (thoughtMatch) {\n        yield { type: 'thought', content: thoughtMatch[1].trim() };\n        this.buffer = this.buffer.replace(thoughtMatch[0], '');\n      }\n      \n      // Extract tool calls\n      const toolMatch = this.buffer.match(new RegExp(`${this.toolCallDelimiter}([^${this.toolCallDelimiter}]*)${this.toolCallDelimiter}`));\n      if (toolMatch) {\n        yield { type: 'tool', content: toolMatch[1].trim() };\n        this.buffer = this.buffer.replace(toolMatch[0], '');\n      }\n      \n      // Regular text\n      if (this.buffer.length > 0) {\n        yield { type: 'text', content: this.buffer };\n        this.buffer = '';
      }
    }
  }
  
  /** Reconstruct partial JSON tool calls */
  reconstructToolCall(partial: string): any {
    try {
      // Try to parse as complete JSON first
      return JSON.parse(partial);
    } catch {
      // If incomplete, try to fix common issues
      const fixed = partial
        .replace(/([\w]+):/g, '"$1":') // Add quotes to keys
        .replace(/'([^']+)'/g, '"$1"') // Replace single quotes with double
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']');
      
      try {
        return JSON.parse(fixed);
      } catch {
        return { raw: partial };
      }
    }
  }
}
```

## Engine 4: Tool Sandbox & VFS\n### What it does\nThe Tool Sandbox & VFS provides a secure execution environment for tools and a virtual file system for managing application documents. It isolates tool execution, sanitizes outputs, and maintains a virtual file system structure.

### Inputs & Outputs\n- **Inputs**: Commands, file operations
- **Outputs**: Command results, file system state

### Implementation Code
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

class CareerOpsToolSandbox {
  private vfs: Map<string, { content: string; isDirectory: boolean }> = new Map();
  private workingDirectory: string = '/tmp/sandbox';
  private execAsync = promisify(exec);
  
  constructor() {
    this.initializeVFS();
  }
  
  private initializeVFS(): void {
    // Create basic directory structure
    this.vfs.set('/', { content: '', isDirectory: true });
    this.vfs.set('/tmp', { content: '', isDirectory: true });
    this.vfs.set(this.workingDirectory, { content: '', isDirectory: true });
  }
  
  /** Virtual file system operations */
  async readFile(filePath: string): Promise<string> {
    const normalized = path.normalize(filePath);
    const entry = this.vfs.get(normalized);
    
    if (!entry || entry.isDirectory) {
      throw new Error(`File not found or is directory: ${filePath}`);
    }
    
    return entry.content;
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    const normalized = path.normalize(filePath);
    const dir = path.dirname(normalized);
    
    // Ensure directory exists
    if (!this.vfs.has(dir)) {
      await this.mkdir(dir);
    }
    
    this.vfs.set(normalized, { content, isDirectory: false });
  }
  
  async mkdir(dirPath: string): Promise<void> {
    const normalized = path.normalize(dirPath);
    
    if (this.vfs.has(normalized)) {
      return;
    }
    
    const parent = path.dirname(normalized);
    if (parent !== normalized && !this.vfs.has(parent)) {
      await this.mkdir(parent);
    }
    
    this.vfs.set(normalized, { content: '', isDirectory: true });
  }
  
  /** Sanitize command output */
  private sanitizeOutput(output: string): string {
    // Remove sensitive information
    return output
      .replace(/password=[^\s]*/g, 'password=****')
      .replace(/token=[^\s]*/g, 'token=****')
      .replace(/api_key=[^\s]*/g, 'api_key=****');
  }
  
  /** Execute a shell command in the sandbox */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      // First try to execute in VFS if possible
      if (command.startsWith('cat ') || command.startsWith('ls ') || command.startsWith('echo ')) {
        return this.executeVirtualCommand(command);
      }
      
      // For complex commands, use actual shell with restrictions
      const { stdout, stderr } = await this.execAsync(command, {
        cwd: this.workingDirectory,
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return {
        stdout: this.sanitizeOutput(stdout),
        stderr: this.sanitizeOutput(stderr)
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /** Execute simple commands in virtual file system */
  private async executeVirtualCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    try {
      switch (cmd) {
        case 'cat': {
          const filePath = args[0];
          const content = await this.readFile(filePath);
          return { stdout: content, stderr: '' };
        }
        case 'ls': {
          const dirPath = args[0] || this.workingDirectory;
          const entries = Array.from(this.vfs.entries())
            .filter(([path]) => path.startsWith(dirPath) && path !== dirPath)
            .map(([path]) => path.split('/').pop() || '');
          return { stdout: entries.join('\n'), stderr: '' };
        }
        case 'echo': {
          const text = args.join(' ');
          return { stdout: text, stderr: '' };
        }
        default:
          throw new Error(`Command not supported in VFS: ${cmd}`);
      }
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget\n### What it does\nThe Non-linear Session Tree & Token Budget maintains application state across sessions with branching paths and token management. It allows for non-linear workflows, tracks token usage, and prunes old sessions when approaching token limits.

### Inputs & Outputs\n- **Inputs**: Session content, token counts\n- **Outputs**: Session nodes, path history, statistics

### Implementation Code
```typescript
interface SessionNode {
  id: string;
  timestamp: number;
  content: any;
  children: SessionNode[];
  tokenCount: number;
}

class CareerOpsSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxTokens: number;
  private lruSize: number;
  private nodeMap: Map<string, SessionNode> = new Map();
  
  constructor(maxTokens: number = 100000, lruSize: number = 50) {
    this.maxTokens = maxTokens;
    this.lruSize = lruSize;
    
    this.root = {
      id: 'root',
      timestamp: Date.now(),
      content: null,
      children: [],
      tokenCount: 0
    };
    
    this.current = this.root;
    this.nodeMap.set(this.root.id, this.root);
  }
  
  /** Add a new node to the current branch */
  addNode(content: any, tokenCount: number): string {
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newNode: SessionNode = {
      id: nodeId,
      timestamp: Date.now(),
      content,
      children: [],
      tokenCount
    };
    
    this.current.children.push(newNode);
    this.nodeMap.set(nodeId, newNode);
    
    // Update token counts
    this.updateTokenCounts(this.current, tokenCount);
    
    // Check if we need to prune
    this.pruneIfNeeded();
    
    return nodeId;
  }
  
  /** Branch to a new child node */
  branch(content: any, tokenCount: number): string {
    const nodeId = this.addNode(content, tokenCount);
    this.current = this.nodeMap.get(nodeId)!;
    return nodeId;
  }
  
  /** Move to a specific node */
  moveToNode(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    this.current = node;
  }
  
  /** Get the current node */
  getCurrentNode(): SessionNode {
    return { ...this.current };
  }
  
  /** Get the path from root to current node */
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.current;
    
    while (node && node.id !== 'root') {
      path.unshift(node);
      // Find parent by checking which node has this node as child
      node = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === node!.id)
      );
    }
    
    return path;
  }
  
  /** Update token counts recursively */
  private updateTokenCounts(node: SessionNode, delta: number): void {
    let current: SessionNode | undefined = node;
    
    while (current) {
      current.tokenCount += delta;
      // Find parent
      current = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === current!.id)
      );
    }
  }
  
  /** Prune least recently used nodes if needed */
  private pruneIfNeeded(): void {
    if (this.root.tokenCount <= this.maxTokens) {
      return;
    }
    
    // Get all nodes except root
    const allNodes = Array.from(this.nodeMap.values()).filter(n => n.id !== 'root');
    
    // Sort by last access time (we'll approximate with timestamp)
    allNodes.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate how many tokens we need to free
    const tokensToFree = this.root.tokenCount - this.maxTokens;
    let freedTokens = 0;
    const nodesToRemove: string[] = [];
    
    for (const node of allNodes) {
      if (freedTokens >= tokensToFree) break;
      
      freedTokens += node.tokenCount;
      nodesToRemove.push(node.id);
    }
    
    // Remove nodes and update references
    for (const nodeId of nodesToRemove) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;
      
      // Remove from parent's children
      const parent = Array.from(this.nodeMap.values()).find(
        n => n.children.some(child => child.id === nodeId)
      );
      
      if (parent) {
        parent.children = parent.children.filter(child => child.id !== nodeId);
      }
      
      // Remove from map
      this.nodeMap.delete(nodeId);
    }
    
    // Recalculate token counts
    this.root.tokenCount = this.calculateTokenCount(this.root);
  }
  
  /** Recursively calculate token count for a node */
  private calculateTokenCount(node: SessionNode): number {
    return node.children.reduce((sum, child) => {
      return sum + child.tokenCount + this.calculateTokenCount(child);
    }, 0);
  }
  
  /** Get session statistics */
  getStats(): {
    totalNodes: number;
    totalTokens: number;
    depth: number;
    branchCount: number;
  } {
    const allNodes = Array.from(this.nodeMap.values()).filter(n => n.id !== 'root');
    const depth = this.getCurrentPath().length;
    const branchCount = allNodes.filter(n => n.children.length > 0).length;
    
    return {
      totalNodes: allNodes.length,
      totalTokens: this.root.tokenCount,
      depth,
      branchCount
    };
  }
}
```
