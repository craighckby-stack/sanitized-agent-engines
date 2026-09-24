/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ContainerRuntimeManager
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

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
