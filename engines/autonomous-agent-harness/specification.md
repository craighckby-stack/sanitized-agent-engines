/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
# Autonomous Agent Harness Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> **Source Origin**: This specification is derived from the open-source CowAgent project, a personal AI assistant framework. All vendor-specific branding has been removed to create a generic, reusable engine specification.

## 1. Architectural Topology & Component Overview

The Autonomous Agent Harness Engine is a modular framework for building AI agents with memory, tool execution, and self-evolution capabilities. The architecture consists of five interconnected engines:

1. **Lifecycle Kernel** - Dependency injection, hook dispatch, disposable registry, and scope tree management
2. **ReAct Agent Loop Engine** - Multi-turn reasoning loop with step budget and trajectory tracking
3. **Unified Model Stream Adapter** - Streaming token processing, thought isolation, and tool-call reconstruction
4. **Tool Sandbox & VFS** - In-memory file system, shell interpreter, and output sanitization
5. **Non-linear Session Tree & Token Budget** - Branching conversation tree with checkpoints and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the dependency injection system, service registration, event hooks, and resource disposal. It implements a hierarchical scope tree that allows services to be registered at different levels and inherited by child scopes. This enables clean separation of concerns and proper resource management throughout the agent's lifecycle.

### Inputs & Outputs
- **Inputs**: Service instances, hook functions, disposable resources
- **Outputs**: Resolved service instances, hook event dispatch, resource cleanup

### Implementation Code
```typescript
import { Disposable, IDisposable } from './types';

/**
 * Lifecycle Kernel - Dependency injection, hook dispatch, disposable registry, and scope tree
 */
export class autonomousAgentHarnessLifecycleContext implements Disposable {
  private parent?: autonomousAgentHarnessLifecycleContext;
  private children: Set<autonomousAgentHarnessLifecycleContext> = new Set();
  private services: Map<string, any> = new Map();
  private disposables: Set<IDisposable> = new Set();
  private hooks: Map<string, Function[]> = new Map();

  constructor(parent?: autonomousAgentHarnessLifecycleContext) {
    this.parent = parent;
    if (parent) {
      parent.children.add(this);
    }
  }

  /**
   * Register a service instance in this scope
   */
  registerService<T>(name: string, instance: T): T {
    this.services.set(name, instance);
    return instance;
  }

  /**
   * Get a service from this scope or parent scopes
   */
  getService<T>(name: string): T | undefined {
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    return this.parent?.getService<T>(name);
  }

  /**
   * Add a hook function for a specific event
   */
  addHook(event: string, fn: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(fn);
  }

  /**
   * Dispatch an event to all registered hooks
   */
  dispatch(event: string, ...args: any[]): void {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      try {
        hook(...args);
      } catch (err) {
        console.error(`Error in hook ${event}:`, err);
      }
    }
    this.parent?.dispatch(event, ...args);
  }

  /**
   * Register a disposable resource
   */
  registerDisposable(disposable: IDisposable): void {
    this.disposables.add(disposable);
  }

  /**
   * Create a child scope
   */
  createChild(): autonomousAgentHarnessLifecycleContext {
    return new autonomousAgentHarnessLifecycleContext(this);
  }

  /**
   * Dispose this scope and all children
   */
  dispose(): void {
    for (const child of this.children) {
      child.dispose();
    }
    
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (err) {
        console.error('Error disposing resource:', err);
      }
    }
    
    this.disposables.clear();
    this.children.clear();
    this.services.clear();
    this.hooks.clear();
    
    if (this.parent) {
      this.parent.children.delete(this);
    }
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine implements the core reasoning loop that enables agents to think and act iteratively. It manages step execution, tracks the agent's trajectory, enforces step budgets to prevent infinite loops, and coordinates between the agent's reasoning and tool execution capabilities.

### Inputs & Outputs
- **Inputs**: Agent instance, user query, step callback function
- **Outputs**: Agent response, execution trajectory with steps and observations

### Implementation Code
```typescript
import { AgentState, ToolResult } from './types';

/**
 * ReAct Agent Loop Engine - Multi-turn loop with step budget and trajectory tracking
 */
export class autonomousAgentHarnessAgentLoopEngine {
  private maxSteps: number;
  private trajectory: Array<{
    step: number;
    action: string;
    observation?: string;
    result?: ToolResult;
    error?: string;
  }> = [];

  constructor(maxSteps: number = 20) {
    this.maxSteps = maxSteps;
  }

  /**
   * Execute the ReAct loop with the given agent and query
   */
  async run(
    agent: any,
    query: string,
    onStep?: (step: number, action: string, observation?: string) => void
  ): Promise<{ result: string; trajectory: any[] }> {
    this.trajectory = [];
    let step = 0;
    let state: AgentState = {
      messages: [{ role: 'user', content: query }],
      currentStep: 0,
      maxSteps: this.maxSteps,
    };

    while (step < this.maxSteps) {
      step++;
      state.currentStep = step;

      // Get agent action (thought or tool call)
      const action = await agent.generateAction(state);
      this.trajectory.push({ step, action });
      onStep?.(step, action);

      if (this.isActionComplete(action)) {
        break;
      }

      // Execute tool if needed
      if (this.isToolAction(action)) {
        try {
          const toolResult = await agent.executeTool(action);
          this.trajectory[this.trajectory.length - 1].result = toolResult;
          onStep?.(step, 'tool_result', toolResult.content);
          
          // Update state with tool result
          state.messages.push({
            role: 'tool',
            content: toolResult.content,
            toolCallId: toolResult.toolCallId,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.trajectory[this.trajectory.length - 1].error = errorMsg;
          onStep?.(step, 'error', errorMsg);
          
          state.messages.push({
            role: 'error',
            content: errorMsg,
          });
        }
      }
    }

    // Generate final response
    const finalResponse = await agent.generateResponse(state);
    return {
      result: finalResponse,
      trajectory: this.trajectory,
    };
  }

  private isActionComplete(action: string): boolean {
    return action.toLowerCase().includes('finish') || 
           action.toLowerCase().includes('conclude');
  }

  private isToolAction(action: string): boolean {
    return action.toLowerCase().includes('use tool') || 
           action.toLowerCase().includes('call tool');
  }

  /**
   * Get the execution trajectory
   */
  getTrajectory() {
    return [...this.trajectory];
  }

  /**
   * Reset the engine state
   */
  reset() {
    this.trajectory = [];
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter processes streaming tokens from language models, detecting and separating thoughts from regular content. It reconstructs partial JSON tool calls, emits structured events for different types of content (tokens, thoughts, tool calls), and manages the state needed to handle incomplete or malformed responses from the model.

### Inputs & Outputs
- **Inputs**: Observable stream of tokens from language model
- **Outputs**: Structured events (tokens, thoughts, tool calls, errors)

### Implementation Code
```typescript
import { Observable }
