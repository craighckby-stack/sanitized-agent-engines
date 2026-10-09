/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Nanobot Autonomous Agent Runtime Engine — Tool Sandbox & Virtual File System
 * Source Origin: HKUDS/nanobot
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tool sandbox with virtual file system and safe execution environment.
 */
export class NanobotToolSandbox {
  private readonly vfs: Map<string, string> = new Map();
  private readonly tempDir: string;
  
  constructor() {
    this.tempDir = path.join(process.cwd(), 'nanobot-tmp', uuidv4());
    fs.mkdir(this.tempDir, { recursive: true });
  }
  
  /**
   * Create a virtual file
   */  
  async createFile(name: string, content: string): Promise<string> {
    const path = this.resolvePath(name);
    await fs.writeFile(path, content);
    this.vfs.set(name, content);
    return path;
  }
  
  /**
   * Read a virtual file
   */
  async readFile(name: string): Promise<string> {
    const path = this.resolvePath(name);
    const content = await fs.readFile(path, 'utf-8');
    this.vfs.set(name, content);
    return content;
  }
  
  /**
   * Execute a shell command safely
   */
  async executeCommand(command: string, timeout: number = 5000): Promise<string> {
    // Sanitize command to prevent injection
    const sanitized = this.sanitizeCommand(command);
    
    return new Promise((resolve, reject) => {
      const child = exec(sanitized, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || error.message}`));
        } else {
          resolve(stdout);
        }
      });
      
      child.on('timeout', () => {
        child.kill();
        reject(new Error('Command execution timed out'));
      });
    });
  }
  
  /**
   * Sanitize shell command to prevent injection
   */
  private sanitizeCommand(command: string): string {
    // Remove dangerous characters and patterns
    return command
      .replace(/[;&|`$\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Resolve a path within the virtual file system
   */
  private resolvePath(name: string): string {
    return path.join(this.tempDir, name);
  }
  
  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    await fs.rm(this.tempDir, { recursive: true, force: true });
    this.vfs.clear();
  }
}
