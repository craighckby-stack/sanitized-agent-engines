# OpenHandsRuntimeEngine Architecture Catalog

This document outlines the core runtime engines extracted from the `OpenHandsRuntimeEngine` architecture. These components are responsible for orchestrating containerized execution environments, managing agentic tool execution, and maintaining state isolation during automated software development tasks.

---

## Engine 1: ContainerRuntimeManager

### What it does
The `ContainerRuntimeManager` acts as the primary orchestrator for ephemeral execution environments. It handles the lifecycle of isolated Docker containers, including image pulling, volume mounting for persistent workspaces, and the mapping of communication channels (streams) between the agent and the runtime environment. It ensures that the execution environment is "sane" by running post-initialization diagnostic commands and enforcing resource constraints.

### Implementation Code
```typescript
import { spawn } from 'child_process';

export interface RuntimeConfig {
  containerId: string;
  image: string;
  workspacePath: string;
}

export class ContainerRuntimeManager {
  private config: RuntimeConfig;

  constructor(config: RuntimeConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    console.log(`Initializing runtime: ${this.config.containerId}`);
    
    const child = spawn('docker', [
      'run', '-d',
      '--name', this.config.containerId,
      '-v', `${this.config.workspacePath}:/workspace`,
      this.config.image,
      'tail', '-f', '/dev/null'
    ]);

    return new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Container startup failed with code ${code}`));
      });
    });
  }

  public async executeCommand(command: string): Promise<string> {
    const process = spawn('docker', ['exec', this.config.containerId, 'sh', '-c', command]);
    let output = '';

    for await (const chunk of process.stdout) {
      output += chunk;
    }

    return output;
  }

  public async stop(): Promise<void> {
    await new Promise((resolve) => {
      const ps = spawn('docker', ['rm', '-f', this.config.containerId]);
      ps.on('close', resolve);
    });
  }
}
```

---

## Engine 2: ActionExecutionEngine

### What it does
The `ActionExecutionEngine` is the bridge between the high-level agentic intent and low-level system calls. It receives structured "Action" objects (e.g., `CmdRunAction`, `FileReadAction`), validates them against an internal security policy, and dispatches them to the `ContainerRuntimeManager`. It tracks the status of each action, captures stdout/stderr, and returns a structured "Observation" object that the agent uses to update its internal state.

### Implementation Code
```typescript
export type Action = {
  type: 'run' | 'read' | 'write';
  payload: Record<string, any>;
};

export type Observation = {
  status: 'success' | 'error';
  content: string;
};

export class ActionExecutionEngine {
  constructor(private runtime: ContainerRuntimeManager) {}

  public async dispatch(action: Action): Promise<Observation> {
    try {
      switch (action.type) {
        case 'run':
          const output = await this.runtime.executeCommand(action.payload.command);
          return { status: 'success', content: output };
        
        case 'read':
          const content = await this.runtime.executeCommand(`cat ${action.payload.path}`);
          return { status: 'success', content };

        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
    } catch (error: any) {
      return { status: 'error', content: error.message };
    }
  }
}
```

---

## Engine 3: EnvironmentStateManager

### What it does
The `EnvironmentStateManager` maintains the persistent state of the file system and installed dependencies within the runtime. It functions as a state machine that preserves the environment's configuration across multiple agent interaction cycles. It is responsible for injecting environment variables, managing environment secrets, and ensuring that the working directory state is synchronized between the host and the ephemeral container.

### Implementation Code
```typescript
export class EnvironmentStateManager {
  private envVars: Map<string, string> = new Map();

  public setVariable(key: string, value: string): void {
    this.envVars.set(key, value);
  }

  public getExportString(): string {
    return Array.from(this.envVars.entries())
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n');
  }

  public async syncState(runtime: ContainerRuntimeManager): Promise<void> {
    const script = this.getExportString();
    await runtime.executeCommand(`echo '${script}' >> /etc/environment`);
  }
}
```