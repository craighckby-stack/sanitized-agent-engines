/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: AI Agent Book Companion Engine — Tool Sandbox & Virtual File System
 * Source Origin: bojieli/ai-agent-book
 */

import { VFS, FileEntry } from './types';

/**
 * Tool Sandbox & VFS for the AI Agent Book Companion
 * Provides in-memory file system, shell interpreter, and output sanitization
 */
export class AiAgentBookToolSandbox {
  private vfs: VFS = new Map();
  private workingDirectory: string = '/';
  
  /**
   * Execute a shell command in the sandbox
   */
  async executeCommand(command: string): Promise<string> {
    const sanitized = this.sanitizeCommand(command);
    
    // Simple command parsing - in a real implementation this would be more robust
    const parts = sanitized.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDirectory);
      case 'cd':
        return this.changeDirectory(args[0] || '/');
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return args.join(' ');
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        if (args.length >= 2) {
          const path = args[0];
          const content = args.slice(1).join(' ');
          return this.writeFile(path, content);
        }
        return 'Usage: write <path> <content>';
      default:
        return `Command not supported: ${cmd}`;
    }
  }
  
  /**
   * Sanitize command input to prevent injection
   */
  private sanitizeCommand(command: string): string {
    // Remove potentially dangerous characters and commands
    return command
      .replace(/[;&|`$]/g, '')
      .replace(/rm -rf/g, '')
      .replace(/sudo /g, '')
      .trim();
  }
  
  /**
   * List files in a directory
   */
  private listFiles(path: string): string {
    const fullPath = this.resolvePath(path);
    const files: string[] = [];
    
    for (const [filePath, entry] of this.vfs) {
      if (filePath.startsWith(fullPath) && filePath !== fullPath) {
        const relativePath = filePath.substring(fullPath.length);
        const parts = relativePath.split('/');
        if (parts.length === 1 || (parts.length > 1 && !this.vfs.has(fullPath + '/' + parts[0]))) {
          files.push(parts[0]);
        }
      }
    }
    
    return files.length > 0 ? files.join('\n') : 'Directory is empty';
  }
  
  /**
   * Change working directory
   */
  private changeDirectory(path: string): string {
    const fullPath = this.resolvePath(path);
    
    // Check if directory exists
    let isDir = false;
    for (const [filePath] of this.vfs) {
      if (filePath.startsWith(fullPath + '/') || filePath === fullPath) {
        isDir = true;
        break;
      }
    }
    
    if (isDir) {
      this.workingDirectory = fullPath;
      return `Changed directory to ${fullPath}`;
    }
    
    return `Directory not found: ${path}`;
  }
  
  /**
   * Read a file
   */
  private readFile(path: string): string {
    const fullPath = this.resolvePath(path);
    const entry = this.vfs.get(fullPath);
    
    if (entry && entry.type === 'file') {
      return entry.content;
    }
    
    return `File not found: ${path}`;
  }
  
  /**
   * Write a file
   */
  private writeFile(path: string, content: string): string {
    const fullPath = this.resolvePath(path);
    
    // Ensure directory exists
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dirPath && dirPath !== '/') {
      this.createDirectory(dirPath);
    }
    
    this.vfs.set(fullPath, {
      type: 'file',
      content,
      createdAt: new Date(),
      modifiedAt: new Date()
    });
    
    return `File written: ${path}`;
  }
  
  /**
   * Create a directory
   */
  private createDirectory(path: string): string {
    const fullPath = this.resolvePath(path);
    
    // Create directory marker
    this.vfs.set(fullPath + '/', {
      type: 'directory',
      createdAt: new Date(),
      modifiedAt: new Date()
    });
    
    return `Directory created: ${path}`;
  }
  
  /**
   * Resolve a relative path to absolute
   */
  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    
    const parts = this.workingDirectory.split('/').filter(p => p);
    const pathParts = path.split('/').filter(p => p && p !== '.');
    
    for (const part of pathParts) {
      if (part === '..') {
        if (parts.length > 0) {
          parts.pop();
        }
      } else {
        parts.push(part);
      }
    }
    
    return '/' + parts.join('/');
  }
}
