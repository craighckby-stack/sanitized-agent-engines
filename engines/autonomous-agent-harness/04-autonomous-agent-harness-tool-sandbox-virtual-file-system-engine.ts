/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Autonomous Agent Harness Engine — Tool Sandbox & Virtual File System
 * Source Origin: zhayujie/CowAgent
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Tool Sandbox & VFS - In-memory file system, shell interpreter, and output sanitizer
 */
export class autonomousAgentHarnessToolSandbox extends EventEmitter {
  private vfs: Map<string, { content: string; isDirectory: boolean }> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private maxOutputSize: number = 1024 * 1024; // 1MB
  private allowedCommands: Set<string> = new Set(['ls', 'cat', 'echo', 'pwd', 'mkdir', 'rm', 'cp', 'mv']);

  constructor() {
    super();
    this.initializeVFS();
  }

  private initializeVFS() {
    // Create root directory
    this.vfs.set('/', { content: '', isDirectory: true });
    
    // Create basic directory structure
    this.createDirectory('/workspace');
    this.createDirectory('/tmp');
    
    // Create a sample file
    this.writeFile('/workspace/sample.txt', 'Hello, World!');
  }

  /**
   * Create a directory in the VFS
   */
  createDirectory(dirPath: string): void {
    const normalizedPath = this.normalizePath(dirPath);
    this.vfs.set(normalizedPath, { content: '', isDirectory: true });
    
    // Create parent directories if they don't exist
    const parentPath = path.dirname(normalizedPath);
    if (parentPath !== '/' && !this.vfs.has(parentPath)) {
      this.createDirectory(parentPath);
    }
  }

  /**
   * Write content to a file in the VFS
   */
  writeFile(filePath: string, content: string): void {
    const normalizedPath = this.normalizePath(filePath);
    
    // Ensure directory exists
    const dirPath = path.dirname(normalizedPath);
    if (dirPath !== '/' && !this.vfs.has(dirPath)) {
      this.createDirectory(dirPath);
    }
    
    this.vfs.set(normalizedPath, { content, isDirectory: false });
  }

  /**
   * Read content from a file in the VFS
   */
  async readFile(filePath: string): Promise<string> {
    const normalizedPath = this.normalizePath(filePath);
    
    if (!this.vfs.has(normalizedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const entry = this.vfs.get(normalizedPath)!;
    if (entry.isDirectory) {
      throw new Error(`Path is a directory: ${filePath}`);
    }
    
    return entry.content;
  }

  /**
   * List contents of a directory in the VFS
   */
  listDirectory(dirPath: string): string[] {
    const normalizedPath = this.normalizePath(dirPath);
    
    if (!this.vfs.has(normalizedPath) || !this.vfs.get(normalizedPath)!.isDirectory) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    
    const contents: string[] = [];
    const prefix = normalizedPath === '/' ? '' : normalizedPath + '/';
    
    for (const [path, entry] of this.vfs) {
      if (path.startsWith(prefix) && path !== prefix) {
        const relativePath = path.substring(prefix.length);
        const firstSlash = relativePath.indexOf('/');
        
        if (firstSlash === -1) {
          // Direct child
          contents.push(relativePath);
        } else {
          // Subdirectory - add just the directory name
          const dirName = relativePath.substring(0, firstSlash);
          if (!contents.includes(dirName)) {
            contents.push(dirName);
          }
        }
      }
    }
    
    return contents;
  }

  /**
   * Execute a shell command in the sandbox
   */
  async executeCommand(command: string, args: string[] = [], cwd: string = '/workspace'): Promise<{ stdout: string; stderr: string; code: number }> {
    // Sanitize command
    const commandName = command.split(' ')[0];
    if (!this.allowedCommands.has(commandName)) {
      throw new Error(`Command not allowed: ${commandName}`);
    }
    
    // Sanitize arguments
    const sanitizedArgs = args.map(arg => {
      // Remove any shell metacharacters
      return arg.replace(/[;&|`$\(){}\[\]<>]/g, '');
    });
    
    // Sanitize working directory
    const sanitizedCwd = this.normalizePath(cwd);
    if (!this.vfs.has(sanitizedCwd) || !this.vfs.get(sanitizedCwd)!.isDirectory) {
      throw new Error(`Invalid working directory: ${cwd}`);
    }
    
    return new Promise((resolve, reject) => {
      const process = spawn(command, sanitizedArgs, { cwd: sanitizedCwd });
      const processId = `process_${Date.now()}`;
      this.processes.set(processId, process);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        // Limit output size
        if (stdout.length > this.maxOutputSize) {
          stdout = stdout.substring(stdout.length - this.maxOutputSize);
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        // Limit output size
        if (stderr.length > this.maxOutputSize) {
          stderr = stderr.substring(stderr.length - this.maxOutputSize);
        }
      });
      
      process.on('close', (code) => {
        this.processes.delete(processId);
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      process.on('error', (error) => {
        this.processes.delete(processId);
        reject(error);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        process.kill('SIGTERM');
        this.processes.delete(processId);
        resolve({ stdout, stderr, code: -1 });
      }, 30000);
    });
  }

  /**
   * Normalize a file path
   */
  private normalizePath(filePath: string): string {
    return path.normalize('/' + filePath).replace(/\\/g, '/');
  }

  /**
   * Get the current VFS state
   */
  getVFSState() {
    return Object.fromEntries(this.vfs);
  }

  /**
   * Reset the VFS
   */
  resetVFS() {
    this.vfs.clear();
    this.initializeVFS();
  }

  /**
   * Clean up all running processes
   */
  cleanup() {
    for (const [id, process] of this.processes) {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
    this.processes.clear();
  }

  /**
   * Dispose the sandbox
   */
  dispose() {
    this.cleanup();
    this.resetVFS();
  }
}
