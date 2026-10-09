/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Nanobot Autonomous Agent Framework Engine — Tool Sandbox & Virtual File System
 * Source Origin: HKUDS/nanobot
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { ToolResult } from '../providers/base';

export class NanobotToolSandbox {
  private vfsRoot: string;
  private allowedCommands: string[];
  private maxOutputSize: number;

  constructor(vfsRoot: string = '/tmp/nanobot-vfs', maxOutputSize: number = 100000) {
    this.vfsRoot = vfsRoot;
    this.allowedCommands = [
      'echo', 'cat', 'ls', 'pwd', 'cd', 'mkdir', 'rm', 'mv', 'cp',
      'find', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq',
      'python', 'python3', 'node', 'npm', 'git'
    ];
    this.maxOutputSize = maxOutputSize;
  }

  async initialize(): Promise<void> {
    try {
      await fs.access(this.vfsRoot);
    } catch {
      await fs.mkdir(this.vfsRoot, { recursive: true });
    }
  }

  async executeCommand(command: string, args: string[], cwd?: string): Promise<ToolResult> {
    // Sanitize command and arguments
    const sanitizedCommand = this.sanitizeCommand(command);
    if (!sanitizedCommand) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Create a unique working directory if not provided
    const workingDir = cwd || join(this.vfsRoot, nanoid());
    await fs.mkdir(workingDir, { recursive: true });

    try {
      // Execute command
      const result = await this.executeProcess(sanitizedCommand, args, workingDir);
      
      // Sanitize output
      const sanitizedOutput = this.sanitizeOutput(result.stdout);
      
      return {
        content: sanitizedOutput,
        isError: result.stderr.length > 0
      };
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(workingDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async readFile(path: string): Promise<ToolResult> {
    // Sanitize path
    const sanitizedPath = this.sanitizePath(path);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${path}`);
    }

    try {
      const content = await fs.readFile(sanitizedPath, 'utf-8');
      return {
        content: this.sanitizeOutput(content),
        isError: false
      };
    } catch (error) {
      return {
        content: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }

  async writeFile(path: string, content: string): Promise<ToolResult> {
    // Sanitize path
    const sanitizedPath = this.sanitizePath(path);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${path}`);
    }

    try {
      await fs.writeFile(sanitizedPath, content, 'utf-8');
      return {
        content: `File written successfully to ${sanitizedPath}`,
        isError: false
      };
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }

  private sanitizeCommand(command: string): string | null {
    if (!this.allowedCommands.includes(command)) {
      return null;
    }
    return command;
  }

  private sanitizePath(path: string): string | null {
    // Prevent directory traversal
    if (path.includes('..') || path.includes('~')) {
      return null;
    }
    
    // Resolve to absolute path within VFS
    const absolutePath = join(this.vfsRoot, path);
    
    // Ensure path is within VFS
    if (!absolutePath.startsWith(this.vfsRoot)) {
      return null;
    }
    
    return absolutePath;
  }

  private sanitizeOutput(output: string): string {
    // Truncate if too long
    if (output.length > this.maxOutputSize) {
      return output.substring(0, this.maxOutputSize) + '\n[Output truncated]';
    }
    
    // Remove sensitive information (basic implementation)
    const sensitivePatterns = [
      /password[:\s=]+[\w\d]+/gi,
      /token[:\s=]+[\w\d-]+/gi,
      /api[_-]?key[:\s=]+[\w\d-]+/gi,
      /secret[:\s=]+[\w\d]+/gi
    ];
    
    let sanitized = output;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  private async executeProcess(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = exec(
        [command, ...args].join(' '),
        { cwd, encoding: 'utf-8', maxBuffer: this.maxOutputSize },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });
  }
}
