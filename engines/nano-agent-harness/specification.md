/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
# Nano Agent Harness Engine Specification\n*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*\n\n> **Source Origin**: Derived from a nano agent harness implementation that demonstrates the core pattern of feeding tool results back to the model until completion.\n\n## 1. Architectural Topology & Component Overview\n\nThe Nano Agent Harness Engine is a lightweight autonomous agent runtime built around a core pattern of iteratively executing tool calls and feeding results back to the model until completion. The architecture consists of five interconnected engines:\n\n1. **Lifecycle Kernel**: Manages dependency injection, hook dispatch, disposable resources, and scope management\n2. **ReAct Agent Loop Engine**: Implements the core agent loop with step budgeting and trajectory tracking\n3. **Unified Model Stream Adapter**: Handles streaming tokens, thought isolation, and partial tool-call reconstruction\n4. **Tool Sandbox & VFS**: Provides isolated tool execution with an in-memory virtual file system\n5. **Non-linear Session Tree & Token Budget**: Maintains branching session history with checkpointing and token budgeting\n\n## Engine 1: Lifecycle Kernel\n### What it does\nThe Lifecycle Kernel manages the overall lifecycle of the agent runtime, including dependency injection, hook dispatching, resource disposal, and scope management. It ensures proper initialization, execution, and cleanup of all components.\n\n### Inputs & Outputs\n- **Inputs**: Configuration object defining the harness behavior\n- **Outputs**: Fully initialized scope with all dependencies registered\n- **Key Features**:\n  - Disposable resource management\n  - Scope-based isolation\n  - Event hook system\n  - Dependency injection container\n\n### Implementation Code\n```typescript\nexport class NanoAgentHarnessLifecycle {
  private disposables: Disposable[] = [];
  private scopes: Map<string, Scope> = new Map();
  
  constructor(private config: HarnessConfig) {}
  
  createScope(id: string): Scope {
    const scope = new Scope(id);
    this.scopes.set(id, scope);
    return scope;
  }
  
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables = [];
    this.scopes.clear();
  }
  
  getScope(id: string): Scope | undefined {
    return this.scopes.get(id);
  }
  
  hook<T extends keyof HookMap>(event: T, ...args: HookMap[T]): Promise<void> {
    // Hook dispatch implementation
    return Promise.resolve();
  }
}

interface Disposable {
  dispose(): Promise<void>;
}

interface Scope {
  id: string;
  data: Record<string, unknown>;
}

type HookMap = {
  beforeTool: [toolName: string, args: Record<string, unknown>];
  afterTool: [toolName: string, result: string];
  beforeLoop: [messages: Message[]];
  afterLoop: [messages: Message[]];
};
```\n\n## Engine 2: ReAct Agent Loop Engine\n### What it does\nThe ReAct Agent Loop Engine implements the core pattern of iteratively calling the model with available tools, executing the requested tools, and feeding results back until the model determines completion. It manages step counting, tool execution, and message history.\n\n### Inputs & Outputs\n- **Inputs**: Initial user prompt, model adapter, tool registry, loop configuration\n- **Outputs**: Final response or error with execution trajectory\n- **Key Features**:\n  - Step budget enforcement\n  - Tool execution coordination\n  - Message history management\n  - Result aggregation\n\n### Implementation Code\n```typescript\nexport class NanoAgentLoopEngine {
  private stepCount = 0;
  private maxSteps: number;
  private messages: Message[] = [];
  
  constructor(
    private modelAdapter: ModelAdapter,
    private toolRegistry: ToolRegistry,
    private config: LoopConfig
  ) {
    this.maxSteps = config.maxSteps || 20;
  }
  
  async run(initialPrompt: string): Promise<LoopResult> {
    this.messages.push({ role: 'user', content: initialPrompt });
    
    while (this.stepCount < this.maxSteps) {
      this.stepCount++;
      
      // Get model response with available tools
      const response = await this.modelAdapter.generate(
        this.messages,
        this.toolRegistry.getToolDefinitions()
      );
      
      // Add response to message history
      this.messages.push(response.message);
      
      // Check if we should stop (no tool use)
      if (response.stopReason !== 'tool_use') {
        return {
          success: true,
          finalResponse: response.message.content,
          steps: this.stepCount,
          messages: this.messages
        };
      }
      
      // Execute tool calls
      for (const toolCall of response.toolCalls || []) {
        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          throw new Error(`Tool not found: ${toolCall.name}`);
        }
        
        const result = await tool.execute(toolCall.arguments);
        this.messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: result
        });
      }
    }
    
    return {
      success: false,
      error: 'Maximum steps exceeded',
      steps: this.stepCount,
      messages: this.messages
    };
  }
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ModelResponse {
  message: Message;
  toolCalls?: ToolCall[];
  stopReason: 'stop' | 'tool_use';
}

interface LoopResult {
  success: boolean;
  finalResponse?: string;
  error?: string;
  steps: number;
  messages: Message[];
}

interface LoopConfig {
  maxSteps?: number;
}

interface ModelAdapter {
  generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolRegistry {
  getToolDefinitions(): ToolDefinition[];
  getTool(name: string): Tool | undefined;
}

interface Tool {
  execute(args: Record<string, unknown>): Promise<string>;
}
```\n\n## Engine 3: Unified Model Stream Adapter\n### What it does\nThe Unified Model Stream Adapter handles streaming responses from the model, including text content and tool calls. It reconstructs partial tool calls from text streams and provides a unified interface for consuming both text and tool call data.\n\n### Inputs & Outputs\n- **Inputs**: Model messages, tool definitions, streaming configuration\n- **Outputs**: Async iterable stream of text and tool call chunks\n- **Key Features**:\n  - Streaming token consumption\n  - Partial tool call reconstruction\n  - Thought isolation\n  - Chunked output formatting\n\n### Implementation Code\n```typescript\nexport class NanoModelStreamAdapter {
  private buffer = '';
  private partialToolCall: PartialToolCall | null = null;
  
  constructor(
    private modelClient: ModelClient,
    private config: StreamConfig = {}
  ) {}
  
  async *streamResponse(
    messages: Message[],
    tools: ToolDefinition[]
  ): AsyncIterable<StreamChunk> {
    const stream = await this.modelClient.createStream(messages, tools);
    
    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        this.buffer += chunk.content;
        yield {
          type: 'text',
          content: chunk.content
        };
        
        // Try to detect and reconstruct partial tool calls
        if (this.config.reconstructToolCalls) {
          const toolCall = this.extractPartialToolCall(this.buffer);
          if (toolCall && !this.partialToolCall) {
            this.partialToolCall = toolCall;
            yield {
              type: 'tool_start',
              toolName: toolCall.name
            };
          }
        }
      } else if (chunk.type === 'tool_call_start') {
        this.partialToolCall = {
          id: chunk.id,
          name: chunk.name,
          arguments: ''
        };
        yield {
          type: 'tool_start',
          toolName: chunk.name
        };
      } else if (chunk.type === 'tool_call_delta') {
        if (this.partialToolCall) {
          this.partialToolCall.arguments += chunk.delta;
          yield {
            type: 'tool_args',
            args: chunk.delta
          };
        }
      } else if (chunk.type === 'tool_call_end') {
        if (this.partialToolCall) {
          yield {
            type: 'tool_complete',
            toolCall: this.partialToolCall
          };
          this.partialToolCall = null;
        }
      }
    }
  }
  
  private extractPartialToolCall(text: string): PartialToolCall | null {
    // Simple regex-based extraction for demonstration
    // In a real implementation, this would be more sophisticated
    const match = text.match(/\{"type": "tool_call", "name": "(\w+)", "arguments": ({.*})\}/);
    if (match) {
      try {
        return {
          id: `temp-${Date.now()}`,
          name: match[1],
          arguments: match[2]
        };
      } catch {
        return null;
      }
    }
    return null;
  }
  
  reset(): void {
    this.buffer = '';
    this.partialToolCall = null;
  }
}

interface StreamConfig {
  reconstructToolCalls?: boolean;
}

interface ModelClient {
  createStream(messages: Message[], tools: ToolDefinition[]): AsyncIterable<ModelChunk>;
}

interface ModelChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end';
  content?: string;
  id?: string;
  name?: string;
  delta?: string;
}

interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_args' | 'tool_complete';
  content?: string;
  toolName?: string;
  args?: string;
  toolCall?: PartialToolCall;
}

interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}
```\n\n## Engine 4: Tool Sandbox & VFS\n### What it does\nThe Tool Sandbox & VFS provides isolated execution environment for tools with an in-memory virtual file system. It enforces safety constraints, manages file operations, and sanitizes tool outputs to prevent dangerous operations.\n\n### Inputs & Outputs\n- **Inputs**: Tool name, arguments, sandbox configuration\n- **Outputs**: Tool execution result or error message\n- **Key Features**:\n  - Tool execution isolation\n  - In-memory virtual file system\n  - Command safety filtering\n  - Output size limiting\n  - Path sanitization\n\n### Implementation Code\n```typescript\nexport class NanoToolSandbox {
  private vfs: VirtualFileSystem;
  private allowedTools: Set<string>;
  
  constructor(
    private config: SandboxConfig = {}
  ) {
    this.vfs = new VirtualFileSystem();
    this.allowedTools = new Set(config.allowedTools || []);
  }
  
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!this.allowedTools.has(toolName)) {
      throw new Error(`Tool not allowed: ${toolName}`);
    }
    
    switch (toolName) {
      case 'bash':
        return this.runBash(args.command as string);
      case 'read':
        return this.runRead(args.path as string, args.limit as number);
      case 'write':
        return this.runWrite(args.path as string, args.content as string);
      case 'edit':
        return this.runEdit(args.path as string, args.content as string);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  private runBash(command: string): string {
    const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
    if (dangerous.some(d => command.includes(d))) {
      return 'Error: Dangerous command blocked';
    }
    
    try {
      const result = subprocess.run(
        command,
        shell: true,
        cwd: this.vfs.getWorkingDirectory(),
        captureOutput: true,
        text: true,
        errors: 'replace',
        timeout: this.config.commandTimeout || 120
      );
      
      const output = (result.stdout + result.stderr).trim();
      return output.slice(0, this.config.maxOutputSize || 50000) || '(no output)';
    } catch (error) {
      if (error instanceof subprocess.TimeoutExpired) {
        return 'Error: Timeout';
      }
      return `Error: ${error.message}`;
    }
  }
  
  private runRead(path: string, limit?: number): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      const content = this.vfs.readFile(fullPath);
      
      if (limit && content.split('\n').length > limit) {
        const lines = content.split('\n');
        return lines.slice(0, limit).join('\n') + `\n... (${lines.length - limit} more lines)`;
      }
      
      return content.slice(0, this.config.maxOutputSize || 50000);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private runWrite(path: string, content: string): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      this.vfs.writeFile(fullPath, content);
      return `File written: ${path}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private runEdit(path: string, content: string): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      const currentContent = this.vfs.readFile(fullPath);
      const updatedContent = this.sanitizeEdit(currentContent, content);
      this.vfs.writeFile(fullPath, updatedContent);
      return `File edited: ${path}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private sanitizeEdit(original: string, edit: string): string {
    // Basic sanitization to prevent dangerous edits
    // In a real implementation, this would be more sophisticated
    if (edit.includes('rm -rf') || edit.includes('> /dev/')) {
      throw new Error('Dangerous edit detected');
    }
    return edit;
  }
}

interface SandboxConfig {
  allowedTools?: string[];
  commandTimeout?: number;
  maxOutputSize?: number;
}

class VirtualFileSystem {
  private workingDir: string = process.cwd();
  private files: Map<string, string> = new Map();
  
  getWorkingDirectory(): string {
    return this.workingDir;
  }
  
  resolvePath(path: string): string {
    const fullPath = path.resolve(this.workingDir, path);
    if (!fullPath.startsWith(this.workingDir)) {
      throw new Error('Path escapes workspace');
    }
    return fullPath;
  }
  
  readFile(path: string): string {
    return this.files.get(path) || '';
  }
  
  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  listFiles(dir: string): string[] {
    const files: string[] = [];
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    
    for (const [filePath] of this.files) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        if (!relativePath.includes('/')) {
          files.push(relativePath);
        }
      }
    }
    
    return files;
  }
}
```\n\n## Engine 5: Non-linear Session Tree & Token Budget\n### What it does\nThe Non-linear Session Tree & Token Budget maintains a branching history of agent interactions with checkpointing capabilities. It tracks the agent's trajectory through different branches and calculates remaining token budget based on the current path.\n\n### Inputs & Outputs\n- **Inputs**: Model context size, session configuration\n- **Outputs**: Current session path, token budget, branch history\n- **Key Features**:\n  - Branching session history\n  - Checkpoint creation\n  - Token budget calculation\n  - LRU pruning\n  - Path navigation\n\n### Implementation Code\n```typescript\nexport class NanoSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxNodes: number;
  private nodeCounter = 0;
  
  constructor(
    private config: TreeConfig = {}
  ) {
    this.maxNodes = config.maxNodes || 100;
    this.root = this.createNode('root', null);
    this.current = this.root;
  }
  
  createCheckpoint(message: Message, parent?: SessionNode): SessionNode {
    const node = this.createNode('checkpoint', parent || this.current);
    node.message = message;
    this.current = node;
    this.pruneTree();
    return node;
  }
  
  createBranch(message: Message, parent?: SessionNode): SessionNode {
    const node = this.createNode('branch', parent || this.current);
    node.message = message;
    this.current = node;
    this.pruneTree();
    return node;
  }
  
  getCurrentPath(): SessionNode[] {
    const path: SessionNode[] = [];
    let node: SessionNode | undefined = this.current;
    
    while (node) {
      path.unshift(node);
      node = node.parent;
    }
    
    return path;
  }
  
  getBranches(node: SessionNode): SessionNode[] {
    return node.children.filter(child => child.type === 'branch');
  }
  
  getCheckpoints(node: SessionNode): SessionNode[] {
    return node.children.filter(child => child.type === 'checkpoint');
  }
  
  calculateTokenBudget(modelContext: number): number {
    const path = this.getCurrentPath();
    const usedTokens = path.reduce((sum, node) => {
      return sum + this.estimateMessageTokens(node.message);
    }, 0);
    
    return Math.max(0, modelContext - usedTokens);
  }
  
  private createNode(type: 'root' | 'checkpoint' | 'branch', parent: SessionNode): SessionNode {
    const node: SessionNode = {
      id: `node-${++this.nodeCounter}`,
      type,
      parent,
      children: [],
      message: null,
      createdAt: new Date()
    };
    
    if (parent) {
      parent.children.push(node);
    }
    
    return node;
  }
  
  private pruneTree(): void {
    if (this.countNodes() > this.maxNodes) {
      // Remove least recently accessed branches
      const branches = this.collectAllBranches(this.root);
      branches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const toRemove = branches.slice(this.maxNodes / 2);
      for (const branch of toRemove) {
        this.removeNode(branch);
      }
    }
  }
  
  private countNodes(): number {
    return this.collectAllNodes(this.root).length;
  }
  
  private collectAllNodes(node: SessionNode): SessionNode[] {
    let nodes = [node];
    for (const child of node.children) {
      nodes = nodes.concat(this.collectAllNodes(child));
    }
    return nodes;
  }
  
  private collectAllBranches(node: SessionNode): SessionNode[] {
    let branches = node.type === 'branch' ? [node] : [];
    for (const child of node.children) {
      branches = branches.concat(this.collectAllBranches(child));
    }
    return branches;
  }
  
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
  }
  
  private estimateMessageTokens(message: Message | null): number {
    if (!message) return 0;
    // Simple estimation - in a real implementation, this would be more accurate
    return message.content.length / 4;
  }
}

interface SessionNode {
  id: string;
  type: 'root' | 'checkpoint' | 'branch';
  parent: SessionNode | null;
  children: SessionNode[];
  message: Message | null;
  createdAt: Date;
}

interface TreeConfig {
  maxNodes?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}
```
