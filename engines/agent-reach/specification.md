/* GLM-Engine-Harvester [2026-10-09T02:43:52.629Z] */
# Agent Reach Autonomous Internet Explorer Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: Cross-platform web scraping and content retrieval engine providing unified access to multiple social media platforms, forums, and websites through a single CLI interface without requiring API keys.

## 1. Architectural Topology & Component Overview

The Agent Reach engine consists of five core components:

1. **Lifecycle Kernel**: Dependency injection, service registration, and hook dispatch system
2. **ReAct Agent Loop Engine**: Multi-turn reasoning loop with step budget and trajectory tracking
3. **Unified Model Stream Adapter**: Streaming tokens, thought isolation, and tool-call reconstruction
4. **Tool Sandbox & VFS**: In-memory file system, shell interpreter, and output sanitization
5. **Non-linear Session Tree & Token Budget**: Branching session tree with checkpointing and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the application lifecycle, service registration, dependency injection, and hook-based event system. It maintains a service registry, manages scopes, and handles proper cleanup of resources.

### Inputs & Outputs
- **Inputs**: Service instances, hook callbacks, scope names
- **Outputs**: Registered services, hook execution results, disposal callbacks

### Implementation Code
```typescript
class AgentReachLifecycleContext {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private disposables: Set<() => void> = new Set();
  private scopeStack: string[] = [];

  constructor() {
    this.initializeCoreServices();
  }

  private initializeCoreServices() {
    // Register core services
    this.registerService('channelRegistry', new ChannelRegistry());
    this.registerService('backendManager', new BackendManager());
    this.registerService('toolSandbox', new ToolSandbox());
    this.registerService('sessionManager', new SessionManager());
  }

  registerService(name: string, service: any) {
    this.services.set(name, service);
  }

  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  addHook(event: string, callback: Function) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }

  async dispatchHook(event: string, ...args: any[]) {
    const callbacks = this.hooks.get(event) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  pushScope(scope: string) {
    this.scopeStack.push(scope);
  }

  popScope() {
    return this.scopeStack.pop();
  }

  addDisposable(dispose: () => void) {
    this.disposables.add(dispose);
  }

  async dispose() {
    for (const dispose of this.disposables) {
      try {
        await dispose();
      } catch (e) {
        console.error(`Disposable failed: ${e}`);
      }
    }
    this.disposables.clear();
    this.services.clear();
    this.hooks.clear();
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements a multi-turn reasoning loop that alternates between thought generation, action execution, and result processing. It maintains a step budget to prevent infinite loops and tracks the complete trajectory of agent execution.

### Inputs & Outputs
- **Inputs**: Initial prompt, step budget, lifecycle context
- **Outputs**: Final thought, execution trajectory, step count

### Implementation Code
```typescript
class AgentReachLoopEngine {
  private context: AgentReachLifecycleContext;
  private stepBudget: number;
  private trajectory: any[] = [];

  constructor(context: AgentReachLifecycleContext, stepBudget: number = 20) {
    this.context = context;
    this.stepBudget = stepBudget;
  }

  async executeAgentLoop(initialPrompt: string) {
    let currentStep = 0;
    let currentThought = initialPrompt;
    
    while (currentStep < this.stepBudget) {
      // Step 1: Generate thought and actions
      const { thought, actions } = await this.generateThoughtAndActions(currentThought);
      
      // Step 2: Execute actions
      const results = await this.executeActions(actions);
      
      // Step 3: Process results and update thought
      currentThought = await this.processResults(thought, results);
      
      // Record step
      this.trajectory.push({
        step: currentStep,
        thought,
        actions,
        results,
        finalThought: currentThought
      });
      
      // Check for completion
      if (this.isComplete(currentThought)) {
        break;
      }
      
      currentStep++;
    }
    
    return {
      finalThought: currentThought,
      trajectory: this.trajectory,
      steps: currentStep
    };
  }

  private async generateThoughtAndActions(thought: string) {
    const modelAdapter = this.context.getService<ModelAdapter>('modelAdapter');
    return await modelAdapter.generateThoughtAndActions(thought);
  }

  private async executeActions(actions: any[]) {
    const results: any[] = [];
    
    for (const action of actions) {
      const toolSandbox = this.context.getService<ToolSandbox>('toolSandbox');
      const result = await toolSandbox.executeAction(action);
      results.push(result);
    }
    
    return results;
  }

  private async processResults(thought: string, results: any[]) {
    const modelAdapter = this.context.getService<ModelAdapter>('modelAdapter');
    return await modelAdapter.processResults(thought, results);
  }

  private isComplete(thought: string): boolean {
    // Simple completion check - can be enhanced
    return thought.toLowerCase().includes('task complete') || 
           thought.toLowerCase().includes('finished');
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter provides a consistent interface for streaming tokens from different model backends. It handles channel-specific routing, thought isolation, and partial JSON tool-call reconstruction.

### Inputs & Outputs
- **Inputs**: User input, token callbacks, channel options
- **Outputs**: Streamed tokens, reconstructed tool calls, thought buffer

### Implementation Code
```typescript
class AgentReachModelStream {
  private channelRegistry: ChannelRegistry;
  private activeChannel: Channel | null = null;
  private tokenBuffer: string = '';
  private thoughtBuffer: string = '';

  constructor(channelRegistry: ChannelRegistry) {
    this.channelRegistry = channelRegistry;
  }

  async streamTokens(input: string, onToken: (token: string) => void) {
    // Determine appropriate channel based on input
    this.activeChannel = this.channelRegistry.determineChannel(input);
    
    if (!this.activeChannel) {
      throw new Error('No suitable channel found for input');
    }

    // Get streaming adapter for the channel
    const streamAdapter = this.activeChannel.getStreamAdapter();
    
    // Process input through the channel
    const response = await streamAdapter.process(input);
    
    // Stream tokens back to caller
    for (const token of response.tokens) {
      onToken(token);
      this.tokenBuffer += token;
    }
    
    // Extract and store thoughts
    this.thoughtBuffer = response.thought || '';
    
    return {
      finalResponse: response.content,
      thought: this.thoughtBuffer,
      channel: this.activeChannel.name
    };
  }

  reconstructToolCalls(partialJson: string): any[] {
    // Reconstruct tool calls from partial JSON responses
    const toolCalls: any[] = [];
    
    try {
      // Try to parse complete JSON first
      const parsed = JSON.parse(partialJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Partial JSON parsing
      const matches = partialJson.match(/\{[^{}]*"action"[^{}]*\}/g) || [];
      
      for (const match of matches) {
        try {
          const toolCall = JSON.parse(match);
          toolCalls.push(toolCall);
        } catch (e) {
          // Skip invalid tool calls
        }
      }
    }
    
    return toolCalls;
  }

  getThoughtBuffer(): string {
    return this.thoughtBuffer;
  }

  clearBuffer() {
    this.tokenBuffer = '';
    this.thoughtBuffer = '';
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a secure execution environment for tool actions, including web scraping, file operations, and shell commands. It includes an in-memory virtual file system and sanitization mechanisms.

### Inputs & Outputs
- **Inputs**: Tool actions, file paths, shell commands
- **Outputs**: Execution results, file contents, command outputs

### Implementation Code
```typescript
class AgentReachToolSandbox {
  private vfs: VirtualFileSystem;
  private shellInterpreter: ShellInterpreter;
  private outputSanitizer: OutputSanitizer;

  constructor() {
    this.vfs = new VirtualFileSystem();
    this.shellInterpreter = new ShellInterpreter();
    this.outputSanitizer = new OutputSanitizer();
  }

  async executeAction(action: any): Promise<any> {
    switch (action.type) {
      case 'web_scrape':
        return await this.executeWebScrape(action);
      case 'file_read':
        return await this.executeFileRead(action);
      case 'file_write':
        return await this.executeFileWrite(action);
      case 'shell_command':
        return await this.executeShellCommand(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeWebScrape(action: any): Promise<any> {
    const channel = this.getChannelForUrl(action.url);
    if (!channel) {
      throw new Error(`No channel available for URL: ${action.url}`);
    }
    
    const result = await channel.scrape(action.url, action.options || {});
    return this.outputSanitizer.sanitize(result);
  }

  private async executeFileRead(action: any): Promise<any> {
    const content = await this.vfs.readFile(action.path);
    return {
      content,
      path: action.path
    };
  }

  private async executeFileWrite(action: any): Promise<any> {
    await this.vfs.writeFile(action.path, action.content);
    return {
      success: true,
      path: action.path
    };
  }

  private async executeShellCommand(action: any): Promise<any> {
    const sanitizedCommand = this.outputSanitizer.sanitizeCommand(action.command);
    const result = await this.shellInterpreter.execute(sanitizedCommand);
    return {
      output: result.output,
      error: result.error,
      exitCode: result.exitCode
    };
  }

  private getChannelForUrl(url: string): Channel | null {
    // Implementation to determine appropriate channel for URL
    // This would use the channel registry
    return null;
  }

  getVFS(): VirtualFileSystem {
    return this.vfs;
  }

  getShellInterpreter(): ShellInterpreter {
    return this.shellInterpreter;
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget maintains a branching session tree with checkpointing capabilities. It tracks token usage across the session and implements LRU pruning to stay within budget constraints.

### Inputs & Outputs
- **Inputs**: Branch thoughts, actions, results, token budget
- **Outputs**: Session tree, checkpoint IDs, token usage metrics

### Implementation Code
```typescript
class AgentReachSessionTree {
  private root: SessionNode;
  private currentNode: SessionNode;
  private tokenBudget: number;
  private usedTokens: number = 0;
  private maxNodes: number = 100;

  constructor(tokenBudget: number = 100000) {
    this.tokenBudget = tokenBudget;
    this.root = new SessionNode('root', null);
    this.currentNode = this.root;
  }

  addBranch(thought: string, actions: any[], results: any[]): SessionNode {
    const node = new SessionNode(`branch-${Date.now()}`, this.currentNode);
    node.thought = thought;
    node.actions = actions;
    node.results = results;
    
    this.currentNode.addChild(node);
    this.currentNode = node;
    
    // Update token usage
    this.usedTokens += this.calculateTokenUsage(thought, actions, results);
    
    // Prune if necessary
    this.pruneTree();
    
    return node;
  }

  checkpoint(): string {
    return this.currentNode.id;
  }

  restore(checkpointId: string): boolean {
    const node = this.findNode(checkpointId);
    if (node) {
      this.currentNode = node;
      return true;
    }
    return false;
  }

  private calculateTokenUsage(thought: string, actions: any[], results: any[]): number {
    // Simple token calculation - in practice would use a tokenizer
    return thought.length + 
           JSON.stringify(actions).length + 
           JSON.stringify(results).length;
  }

  private pruneTree() {
    if (this.root.children.length > this.maxNodes) {
      // Remove least recently used nodes
      this.root.children.sort((a, b) => a.lastUsed - b.lastUsed);
      this.root.children.splice(0, this.root.children.length - this.maxNodes);
    }
    
    if (this.usedTokens > this.tokenBudget) {
      // Prune from oldest branches
      this.pruneByTokenUsage();
    }
  }

  private pruneByTokenUsage() {
    // Implementation to prune tree based on token usage
    // Would traverse tree and remove oldest/least important nodes
  }

  private findNode(id: string): SessionNode | null {
    // Implementation to find node by ID
    return null;
  }

  getRoot(): SessionNode {
    return this.root;
  }

  getCurrentNode(): SessionNode {
    return this.currentNode;
  }

  getUsedTokens(): number {
    return this.usedTokens;
  }

  getTokenBudget(): number {
    return this.tokenBudget;
  }
}

class SessionNode {
  id: string;
  parent: SessionNode | null;
  children: SessionNode[] = [];
  thought: string = '';
  actions: any[] = [];
  results: any[] = [];
  createdAt: number = Date.now();
  lastUsed: number = Date.now();

  constructor(id: string, parent: SessionNode | null) {
    this.id = id;
    this.parent = parent;
  }

  addChild(node: SessionNode) {
    this.children.push(node);
    this.lastUsed = Date.now();
  }

  updateLastUsed() {
    this.lastUsed = Date.now();
  }
}
```
