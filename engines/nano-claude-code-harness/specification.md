/* GLM-Engine-Harvester [2026-10-09T03:29:13.889Z] */
# Nano Claude Code Harness Engine Specification
*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> **Source Origin**: This specification is derived from the "learn-claude-code" repository, a nano implementation of an agent harness built from 0 to 1.

## 1. Architectural Topology & Component Overview

The Nano Claude Code Harness Engine consists of five core components:

1. **Lifecycle Kernel**: Manages dependency injection, hook dispatch, and resource lifecycle
2. **ReAct Agent Loop Engine**: Implements the core agent loop pattern for multi-turn interactions
3. **Unified Model Stream Adapter**: Handles streaming responses and partial JSON reconstruction
4. **Tool Sandbox & VFS**: Provides safe execution environment for tools with virtual file system
5. **Non-linear Session Tree & Token Budget**: Manages conversation state with branching and token limits

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the overall lifecycle of the agent system, including dependency injection, hook-based event handling, and proper resource cleanup. It ensures that all components are properly initialized and disposed of when needed.

### Inputs & Outputs
- **Inputs**: Work directory path
- **Outputs**: Fully configured lifecycle context with hook system

### Implementation Code
```typescript
class NanoClaudeCodeLifecycleContext {
  private disposables: Disposable[] = [];
  private hooks: Map<string, Function[]> = new Map();
  
  constructor(private workdir: string) {}
  
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  addHook(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }
  
  async dispatchHook(event: string, ...args: any[]): Promise<any[]> {
    const results: any[] = [];
    if (this.hooks.has(event)) {
      for (const callback of this.hooks.get(event)!) {
        try {
          results.push(await callback(...args));
        } catch (e) {
          console.error(`Hook ${event} failed:`, e);
        }
      }
    }
    return results;
  }
  
  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        if (typeof disposable === 'function') {
          disposable();
        } else if (disposable && typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.disposables = [];
    this.hooks.clear();
  }
}

type Disposable = () => void | { dispose: () => void };
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements the core pattern of AI coding agents: a loop that feeds tool results back to the model until it decides to stop. It manages the conversation state, tool execution, and step limits.

### Inputs & Outputs
- **Inputs**: Model client, model ID, system prompt, tools, initial messages
- **Outputs**: Complete conversation history with tool results

### Implementation Code
```typescript
class NanoClaudeCodeAgentLoopEngine {
  private stopReason = 'tool_use';
  private stepCount = 0;
  private maxSteps = 50;
  
  constructor(
    private client: any,
    private modelId: string,
    private systemPrompt: string,
    private tools: any[],
    private messages: any[] = []
  ) {}
  
  async run(userPrompt: string): Promise<any> {
    this.messages.push({ role: 'user', content: userPrompt });
    
    while (this.stopReason === 'tool_use' && this.stepCount < this.maxSteps) {
      this.stepCount++;
      
      // Get response from model
      const response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: 4000,
        system: this.systemPrompt,
        messages: this.messages,
        tools: this.tools
      });
      
      // Process response
      const content = response.content[0];
      
      if (content.type === 'text') {
        this.messages.push({ role: 'assistant', content: content.text });
      } else if (content.type === 'tool_use') {
        // Execute tool
        const toolResult = await this.executeTool(content);
        
        // Add tool result to messages
        this.messages.push({
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: content.id, content: toolResult }
          ]
        });
      }
      
      // Check if we should stop
      if (response.stop_reason !== 'tool_use') {
        this.stopReason = response.stop_reason;
      }
    }
    
    return this.messages;
  }
  
  private async executeTool(toolCall: any): Promise<string> {
    const { name, input } = toolCall;
    
    switch (name) {
      case 'bash':
        return this.runBash(input.command);
      case 'read':
        return this.runRead(input.path, input.limit);
      case 'write':
        return this.runWrite(input.path, input.content);
      case 'edit':
        return this.runEdit(input.path, input.old_content, input.new_content);
      case 'todo':
        return this.runTodo(input.items);
      case 'task':
        return this.runTask(input.prompt, input.description);
      default:
        return `Error: Unknown tool ${name}`;
    }
  }
  
  private runBash(command: string): string {
    // Implementation would go here
    return `Bash command executed: ${command}`;
  }
  
  private runRead(path: string, limit?: number): string {
    // Implementation would go here
    return `File read: ${path}${limit ? ` (limit: ${limit})` : ''}`;
  }
  
  private runWrite(path: string, content: string): string {
    // Implementation would go here
    return `File written: ${path} (${content.length} chars)`;
  }
  
  private runEdit(path: string, oldContent: string, newContent: string): string {
    // Implementation would go here
    return `File edited: ${path}`;
  }
  
  private runTodo(items: any[]): string {
    // Implementation would go here
    return `Todo updated with ${items.length} items`;
  }
  
  private runTask(prompt: string, description: string): string {
    // Implementation would go here
    return `Task delegated: ${prompt}`;
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter handles streaming responses from the model, including partial JSON reconstruction for tool calls and extraction of thoughts from the model's output. It provides a clean interface for consuming streaming responses.

### Inputs & Outputs
- **Inputs**: Model client, model ID, messages, system prompt, tools
- **Outputs**: Async generator of response chunks

### Implementation Code
```typescript
class NanoClaudeCodeModelStreamAdapter {
  private buffer = '';
  private partialJson: any = null;
  
  constructor(private client: any, private modelId: string) {}
  
  async *streamResponse(messages: any[], system: string, tools: any[]): AsyncGenerator<string> {
    const stream = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 4000,
      system,
      messages,
      tools,
      stream: true
    });
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta?.text || '';
        this.buffer += text;
        
        // Try to extract complete tool calls from partial JSON
        if (chunk.delta?.type === 'tool_use') {
          this.partialJson = {
            ...this.partialJson,
            ...chunk.delta
          };
          
          if (chunk.delta.partial_json) {
            try {
              const complete = JSON.parse(this.partialJson.partial_json);
              yield JSON.stringify(complete);
              this.partialJson = null;
            } catch {
              // Incomplete JSON, continue buffering
            }
          }
        } else {
          // Regular text output
          yield text;
        }
      }
    }
  }
  
  extractThoughts(content: string): { thoughts: string[], output: string } {
    const thoughtMarker = '<thinking>';
    const endMarker = '</thinking>';
    
    const thoughts: string[] = [];
    let output = content;
    
    while (true) {
      const startIdx = output.indexOf(thoughtMarker);
      if (startIdx === -1) break;
      
      const endIdx = output.indexOf(endMarker, startIdx + thoughtMarker.length);
      if (endIdx === -1) break;
      
      const thought = output.slice(startIdx + thoughtMarker.length, endIdx);
      thoughts.push(thought);
      
      output = output.slice(0, startIdx) + output.slice(endIdx + endMarker.length);
    }
    
    return { thoughts, output };
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a safe execution environment for tools, including a virtual file system with path isolation, dangerous command filtering, and output sanitization. It ensures that tool execution is contained and secure.

### Inputs & Outputs
- **Inputs**: Working directory path
- **Outputs**: Safe tool execution with file system access

### Implementation Code
```typescript
class NanoClaudeCodeToolSandbox {
  private workdir: string;
  private dangerousCommands = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
  
  constructor(workdir: string) {
    this.workdir = workdir;
  }
  
  runBash(command: string): string {
    if (this.dangerousCommands.some(d => command.includes(d))) {
      return 'Error: Dangerous command blocked';
    }
    
    try {
      // In a real implementation, this would use subprocess.run
      // For this example, we'll simulate execution
      return `Command executed: ${command}`;
    } catch (e) {
      return `Error: ${e}`;
    }
  }
  
  runRead(path: string, limit?: number): string {
    try {
      const fullPath = this.resolvePath(path);
      // In a real implementation, this would read the file
      const content = `Content of ${path}`;
      
      if (limit && content.length > limit) {
        return content.substring(0, limit) + `... (${content.length - limit} more chars)`;
      }
      
      return content;
    } catch (e) {
      return `Error: ${e}`;
    }
  }
  
  runWrite(path: string, content: string): string {
    try {
      const fullPath = this.resolvePath(path);
      // In a real implementation, this would write to the file
      return `File written: ${path} (${content.length} chars)`;
    } catch (e) {
      return `Error: ${e}`;
    }
  }
  
  runEdit(path: string, oldContent: string, newContent: string): string {
    try {
      const fullPath = this.resolvePath(path);
      // In a real implementation, this would edit the file
      return `File edited: ${path}`;
    } catch (e) {
      return `Error: ${e}`;
    }
  }
  
  private resolvePath(path: string): string {
    const fullPath = require('path').join(this.workdir, path);
    const resolved = require('path').resolve(fullPath);
    
    if (!resolved.startsWith(this.workdir)) {
      throw new Error(`Path escapes workspace: ${path}`);
    }
    
    return resolved;
  }
  
  sanitizeOutput(output: string): string {
    // Remove sensitive information
    return output
      .replace(/password=[^\s]*/g, 'password=***')
      .replace(/token=[^\s]*/g, 'token=***')
      .replace(/secret=[^\s]*/g, 'secret=***')
      .substring(0, 50000); // Limit output size
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages conversation state with branching paths, checkpoints, and token limits. It allows the agent to explore different approaches while maintaining a coherent conversation history and respecting token budgets.

### Inputs & Outputs
- **Inputs**: Working directory path
- **Outputs**: Session tree with conversation history and token tracking

### Implementation Code
```typescript
class NanoClaudeCodeSessionTree {
  private root: SessionNode;
  private current: SessionNode;
  private maxNodes = 100;
  private nodeCounter = 0;
  
  constructor(private workdir: string) {
    this.root = this.createNode('root', 'Initial session');
    this.current = this.root;
  }
  
  createNode(id: string, description: string, parent?: SessionNode): SessionNode {
    const node: SessionNode = {
      id: id || `node-${++this.nodeCounter}`,
      description,
      parent: parent || this.current,
      children: [],
      messages: [],
      createdAt: new Date(),
      tokenCount: 0
    };
    
    if (parent) {
      parent.children.push(node);
    }
    
    // Enforce max nodes
    if (this.nodeCounter > this.maxNodes) {
      this.pruneOldest();
    }
    
    return node;
  }
  
  getCurrent(): SessionNode {
    return this.current;
  }
  
  setCurrent(node: SessionNode): void {
    this.current = node;
  }
  
  addMessage(role: string, content: string): void {
    this.current.messages.push({ role, content, timestamp: new Date() });
    this.current.tokenCount += this.estimateTokens(content);
  }
  
  checkpoint(description: string): SessionNode {
    const newNode = this.createNode(undefined, description);
    this.current = newNode;
    return newNode;
  }
  
  branch(description: string): SessionNode {
    const branchNode = this.createNode(undefined, description);
    this.current = branchNode;
    return branchNode;
  }
  
  pruneOldest(): void {
    // Find the oldest leaf node (excluding root)
    const oldestLeaf = this.findOldestLeaf(this.root);
    if (oldestLeaf && oldestLeaf !== this.root) {
      this.removeNode(oldestLeaf);
    }
  }
  
  private findOldestLeaf(node: SessionNode): SessionNode | null {
    if (node.children.length === 0) {
      return node;
    }
    
    let oldest: SessionNode | null = null;
    let oldestTime = node.createdAt;
    
    for (const child of node.children) {
      const childOldest = this.findOldestLeaf(child);
      if (childOldest && childOldest.createdAt < oldestTime) {
        oldest = childOldest;
        oldestTime = childOldest.createdAt;
      }
    }
    
    return oldest;
  }
  
  private removeNode(node: SessionNode): void {
    if (node.parent) {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        node.parent.children.splice(index, 1);
      }
    }
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  getBudget(): { used: number, total: number } {
    const totalTokens = this.estimateTreeTokens(this.root);
    return {
      used: totalTokens,
      total: this.maxNodes * 1000 // Arbitrary max budget
    };
  }
  
  private estimateTreeTokens(node: SessionNode): number {
    let total = node.tokenCount;
    for (const child of node.children) {
      total += this.estimateTreeTokens(child);
    }
    return total;
  }
}

interface SessionNode {
  id: string;
  description: string;
  parent: SessionNode;
  children: SessionNode[];
  messages: { role: string; content: string; timestamp: Date }[];
  createdAt: Date;
  tokenCount: number;
}
```
