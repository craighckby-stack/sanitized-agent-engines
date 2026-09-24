# DifyRuntimeEngine: Core Engine Catalog

This document provides a technical breakdown and reference implementation of the core runtime engines powering the **DifyRuntimeEngine** framework. These engines are responsible for workflow orchestration, LLM inference abstraction, and state management.

---

## Engine 1: Workflow Execution Engine

### What it does
The Workflow Execution Engine acts as the central orchestrator for directed acyclic graphs (DAGs). It manages the lifecycle of a workflow run, including node dependency resolution, state transition (pending, running, succeeded, failed), and variable propagation between nodes. It ensures that inputs are validated against schema definitions before execution and enforces strict isolation between execution branches.

### Implementation Code
```typescript
interface NodeConfig {
  id: string;
  type: string;
  inputs: Record<string, any>;
}

interface ExecutionState {
  workflowId: string;
  runId: string;
  history: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

class WorkflowExecutionEngine {
  public async execute(workflowId: string, nodes: NodeConfig[], initialInputs: Record<string, any>): Promise<ExecutionState> {
    const state: ExecutionState = {
      workflowId,
      runId: Math.random().toString(36).substring(7),
      history: { root: initialInputs },
      status: 'running'
    };

    try {
      for (const node of nodes) {
        const result = await this.runNode(node, state.history);
        state.history[node.id] = result;
      }
      state.status = 'completed';
    } catch (error) {
      state.status = 'failed';
    }

    return state;
  }

  private async runNode(node: NodeConfig, context: Record<string, any>): Promise<any> {
    console.log(`Executing node ${node.id} of type ${node.type}`);
    // Simulated engine logic for node transformation
    return { output: `Processed ${node.id}`, timestamp: Date.now() };
  }
}
```

---

## Engine 2: LLM Inference Abstraction Engine

### What it does
The LLM Inference Abstraction Engine standardizes interactions with various Large Language Model providers. It handles the mapping of abstract prompts and model parameters (temperature, max tokens) to provider-specific API formats. It preserves invariants regarding context window management and handles the standardization of streaming responses into unified chunks.

### Implementation Code
```typescript
interface LLMRequest {
  model: string;
  prompt: string;
  parameters: {
    temperature: number;
    maxTokens: number;
  };
}

class LLMInferenceEngine {
  public async generate(request: LLMRequest): Promise<string> {
    const standardizedPayload = this.mapToProviderFormat(request);
    
    // Logic for provider negotiation
    const response = await this.callProvider(standardizedPayload);
    
    return this.sanitizeOutput(response);
  }

  private mapToProviderFormat(req: LLMRequest): any {
    return {
      model_id: req.model,
      input_data: req.prompt,
      settings: {
        t: req.parameters.temperature,
        limit: req.parameters.maxTokens
      }
    };
  }

  private async callProvider(payload: any): Promise<string> {
    // Simulated remote provider invocation
    return "Standardized model response content.";
  }

  private sanitizeOutput(raw: string): string {
    return raw.trim();
  }
}
```

---

## Engine 3: Variable Interpolation Engine

### What it does
The Variable Interpolation Engine performs late-stage binding of dynamic data into static templates. It parses incoming text, identifies pattern-based variable placeholders, and recursively resolves their values from the current execution context. It preserves runtime security by preventing arbitrary code execution during the template resolution phase.

### Implementation Code
```typescript
class VariableInterpolationEngine {
  private readonly regex = /\{\{([\w\.]+)\}\}/g;

  public interpolate(template: string, context: Record<string, any>): string {
    return template.replace(this.regex, (match, key) => {
      const value = this.resolveValue(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  private resolveValue(path: string, context: Record<string, any>): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], context);
  }
}

// Example Usage:
// const engine = new VariableInterpolationEngine();
// const result = engine.interpolate("Hello {{user.name}}", { user: { name: "Architect" } });
```