// --- ContainerRuntimeManager ---
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

// --- ActionExecutionEngine ---
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

// --- EnvironmentStateManager ---
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