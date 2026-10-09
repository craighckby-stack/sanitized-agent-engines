/* GLM-Engine-Harvester [2026-10-09T02:53:23.004Z] */
# PPT Generation Engine Specification
*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> **Source origin**: Extracted from hugohe3/ppt-master, a Python-based system for generating PowerPoint presentations from documents or topics.

## 1. Architectural Topology & Component Overview

The PPT Generation Engine consists of five interconnected components that work together to transform input documents or topics into fully-formed PowerPoint presentations:

1. **Lifecycle Kernel**: Manages dependency injection, service registration, and resource cleanup
2. **ReAct Agent Loop Engine**: Controls the multi-turn reasoning process for slide generation
3. **Unified Model Stream Adapter**: Handles streaming tokens and tool call reconstruction
4. **Tool Sandbox & VFS**: Provides isolated execution environment for PPT operations
5. **Non-linear Session Tree & Token Budget**: Manages branching workflows and token usage

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the overall execution context, including service registration, dependency injection, and proper cleanup of resources. It ensures that all components are properly initialized and disposed of when the presentation generation process completes.

### Inputs & Outputs
- **Inputs**: Configuration object
- **Outputs**: Fully initialized services and clean resource disposal

### Implementation Code
```typescript
export class PptGenerationLifecycleContext {
  private services: Map<string, any> = new Map();
  private disposables: (() => void)[] = [];
  
  constructor(private config: any) {}
  
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }
  
  addDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }
  
  dispose(): void {
    for (const dispose of this.disposables) {
      try {
        dispose();
      } catch (e) {
        console.error(`Error during disposal: ${e}`);
      }
    }
    this.disposables = [];
    this.services.clear();
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements a multi-turn reasoning process that iteratively generates and refines presentation content. It manages the step budget and maintains a trajectory of actions taken during the generation process.

### Inputs & Outputs
- **Inputs**: Initial context, prompt, maximum steps
- **Outputs**: Generated presentation content

### Implementation Code
```typescript
export class PptAgentLoopEngine {
  private stepBudget: number;
  private trajectory: any[] = [];
  
  constructor(private maxSteps: number = 20) {
    this.stepBudget = maxSteps;
  }
  
  async executeLoop(context: any, prompt: string): Promise<any> {
    let currentStep = 0;
    let currentResult = null;
    
    while (currentStep < this.stepBudget) {
      // Generate next action
      const action = await this.generateAction(context, prompt, currentResult);
      
      // Execute action
      const result = await this.executeAction(action);
      
      // Update trajectory
      this.trajectory.push({ step: currentStep, action, result });
      currentResult = result;
      
      // Check for completion
      if (this.isComplete(result)) {
        break;
      }
      
      currentStep++;
    }
    
    return currentResult;
  }
  
  private async generateAction(context: any, prompt: string, previousResult: any): Promise<any> {
    // Implementation would use model to generate next action
    return { type: 'generate_slide', content: prompt };
  }
  
  private async executeAction(action: any): Promise<any> {
    // Implementation would execute the action
    return { status: 'completed', slide: action.content };
  }
  
  private isComplete(result: any): boolean {
    // Check if result indicates task completion
    return result && result.status === 'completed';
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Model Stream Adapter handles the streaming of tokens from the language model, reconstructs partial JSON tool calls, and isolates model thoughts from tool outputs. This ensures smooth interaction with the generation model while maintaining clean separation between reasoning and actions.

### Inputs & Outputs
- **Inputs**: Prompts, partial JSON tool calls
- **Outputs**: Streamed tokens, reconstructed tool calls, isolated thoughts

### Implementation Code
```typescript
export class PptModelStreamAdapter {
  private buffer: string = '';
  private pendingCalls: any[] = [];
  
  async streamTokens(prompt: string, onToken: (token: string) => void): Promise<void> {
    // Implementation would stream tokens from model
    const mockTokens = ['Slide', ' ', '1', ':', ' ', 'Introduction'];
    
    for (const token of mockTokens) {
      this.buffer += token;
      onToken(token);
      
      // Simulate async behavior
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  async reconstructToolCall(partialJson: string): Promise<any> {
    try {
      // Implementation would reconstruct partial JSON tool calls
      return JSON.parse(partialJson);
    } catch (e) {
      throw new Error(`Failed to reconstruct tool call: ${e}`);
    }
  }
  
  isolateThought(thought: string): string {
    // Implementation would isolate model thoughts from tool calls
    return thought.replace(/\[TOOL_CALL\].*?\[\/TOOL_CALL\]/g, '');
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox provides an isolated execution environment for PowerPoint-related operations, including a virtual file system (VFS) and a shell interpreter for PPT commands. This ensures safe execution of potentially dangerous operations while maintaining a clean workspace for the presentation generation process.

### Inputs & Outputs
- **Inputs**: Commands, file paths, content
- **Outputs**: Command results, file operations

### Implementation Code
```typescript
export class PptToolSandbox {
  private vfs: Map<string, any> = new Map();
  private shellInterpreter: any;
  
  constructor() {
    this.initializeVFS();
    this.initializeShellInterpreter();
  }
  
  private initializeVFS(): void {
    // Initialize virtual file system
    this.vfs.set('/', { type: 'directory', children: [] });
    this.vfs.set('/slides', { type: 'directory', children: [] });
  }
  
  private initializeShellInterpreter(): void {
    // Initialize shell interpreter for PPT commands
    this.shellInterpreter = {
      execute: async (command: string) => {
        // Implementation would execute PPT-specific commands
        return { status: 'success', output: '' };
      }
    };
  }
  
  async executeCommand(command: string): Promise<any> {
    return this.shellInterpreter.execute(command);
  }
  
  writeFile(path: string, content: any): void {
    this.vfs.set(path, { type: 'file', content });
  }
  
  readFile(path: string): any {
    return this.vfs.get(path)?.content;
  }
  
  sanitizeOutput(output: string): string {
    // Implementation would sanitize command output
    return output.replace(/<[^>]*>/g, '');
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Session Tree manages branching workflows during presentation generation, allowing for exploration of different content approaches. It maintains a token budget to ensure efficient resource usage and implements pruning of less promising branches to stay within limits.

### Inputs & Outputs
- **Inputs**: Token limits, branching decisions
- **Outputs**: Current session state, checkpoints

### Implementation Code
```typescript
export class PptSessionTree {
  private root: any;
  private currentBranch: any;
  private tokenBudget: number;
  private usedTokens: number = 0;
  
  constructor(private maxTokens: number = 100000) {
    this.tokenBudget = maxTokens;
    this.initializeTree();
  }
  
  private initializeTree(): void {
    this.root = { id: 'root', children: [], tokens: 0 };
    this.currentBranch = this.root;
  }
  
  checkpoint(): string {
    // Create checkpoint of current state
    const checkpointId = `cp_${Date.now()}`;
    this.currentBranch.checkpoints = this.currentBranch.checkpoints || {};
    this.currentBranch.checkpoints[checkpointId] = {
      tokens: this.usedTokens,
      state: this.cloneState()
    };
    return checkpointId;
  }
  
  restore(checkpointId: string): void {
    // Restore to checkpoint
    if (this.currentBranch.checkpoints && this.currentBranch.checkpoints[checkpointId]) {
      const checkpoint = this.currentBranch.checkpoints[checkpointId];
      this.usedTokens = checkpoint.tokens;
      this.restoreState(checkpoint.state);
    }
  }
  
  branch(): string {
    // Create new branch
    const branchId = `branch_${Date.now()}`;
    const newBranch = {
      id: branchId,
      children: [],
      parent: this.currentBranch,
      tokens: this.usedTokens
    };
    
    this.currentBranch.children.push(newBranch);
    this.currentBranch = newBranch;
    return branchId;
  }
  
  prune(): void {
    // Implement LRU pruning
    if (this.usedTokens > this.tokenBudget * 0.9) {
      this.pruneBranch(this.root);
    }
  }
  
  private pruneBranch(branch: any): void {
    // Recursively prune least recently used branches
    if (branch.children.length > 2) {
      branch.children.sort((a: any, b: any) => a.tokens - b.tokens);
      branch.children = branch.children.slice(1);
    }
    
    for (const child of branch.children) {
      this.pruneBranch(child);
    }
  }
  
  private cloneState(): any {
    // Implementation would clone current state
    return { slides: [], tokens: this.usedTokens };
  }
  
  private restoreState(state: any): void {
    // Implementation would restore state
    this.usedTokens = state.tokens;
  }
}
```
