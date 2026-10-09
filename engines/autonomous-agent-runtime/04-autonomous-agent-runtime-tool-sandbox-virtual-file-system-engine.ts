/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Autonomous Agent Runtime Engine — Tool Sandbox & Virtual File System
 * Source Origin: NousResearch/hermes-agent
 */

import { FileSystem, ToolCall, ToolResult } from './types';

/**
 * Tool Sandbox & VFS - In-memory file system with shell interpreter and output sanitization
 */
export class AutonomousAgentToolSandbox {
  private fileSystem: FileSystem;
  private workingDirectory: string = '/';
  private environment: Record<string, string> = {};
  private maxOutputSize: number = 100000; // 100KB

  constructor() {
    this.fileSystem = this.createEmptyFileSystem();
  }

  /** Create an empty file system */
  private createEmptyFileSystem(): FileSystem {
    return {
      '/': {
        type: 'directory',
        children: {}
      }
    };
  }

  /** Execute a tool call in the sandbox */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = toolCall;
    
    try {
      switch (name) {
        case 'read_file':
          return this.readFile(args.path);
        case 'write_file':
          return this.writeFile(args.path, args.content);
        case 'list_directory':
          return this.listDirectory(args.path);
        case 'execute_command':
          return this.executeCommand(args.command);
        default:
          return {
            success: false,
            content: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        content: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /** Read a file from the virtual file system */
  private readFile(path: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    let current: any = this.fileSystem['/'];
    
    for (const part of parts) {
      if (!current.children || !current.children[part]) {
        return {
          success: false,
          content: `File not found: ${path}`
        };
      }
      current = current.children[part];
    }
    
    if (current.type !== 'file') {
      return {
        success: false,
        content: `Path is not a file: ${path}`
      };
    }
    
    return {
      success: true,
      content: current.content || ''
    };
  }

  /** Write a file to the virtual file system */
  private writeFile(path: string, content: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    // Ensure directory exists
    let current: any = this.fileSystem['/'];
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = {
          type: 'directory',
          children: {}
        };
      }
      current = current.children[part];
    }
    
    // Create or update file
    const fileName = parts[parts.length - 1];
    current.children[fileName] = {
      type: 'file',
      content: content
    };
    
    return {
      success: true,
      content: `File written: ${path}`
    };
  }

  /** List directory contents */
  private listDirectory(path: string): ToolResult {
    const normalizedPath = this.normalizePath(path);
    const parts = normalizedPath.split('/').filter(p => p);
    
    let current: any = this.fileSystem['/'];
    
    for (const part of parts) {
      if (!current.children || !current.children[part]) {
        return {
          success: false,
          content: `Directory not found: ${path}`
        };
      }
      current = current.children[part];
    }
    
    if (current.type !== 'directory') {
      return {
        success: false,
        content: `Path is not a directory: ${path}`
      };
    }
    
    const contents = Object.keys(current.children || {});
    return {
      success: true,
      content: contents.join('\n')
    };
  }

  /** Execute a shell command */
  private executeCommand(command: string): ToolResult {
    // In a real implementation, this would use a safe shell interpreter
    // For this example, we'll simulate command execution
    
    // Sanitize command to prevent injection
    const sanitized = command.replace(/[^a-zA-Z0-9 _\-\.,]/g, '');
    
    // Simulate command output
    let output = '';
    
    if (sanitized.startsWith('ls')) {
      output = 'file1.txt\nfile2.txt\ndirectory1\n';
    } else if (sanitized.startsWith('echo')) {
      output = sanitized.substring(4).trim() + '\n';
    } else {
      output = `Command executed: ${sanitized}\n`;
    }
    
    // Truncate output if too large
    if (output.length > this.maxOutputSize) {
      output = output.substring(0, this.maxOutputSize) + '\n... (output truncated)';
    }
    
    return {
      success: true,
      content: output
    };
  }

  /** Normalize a file path */
  private normalizePath(path: string): string {
    // Resolve relative paths
    if (path.startsWith('./')) {
      path = this.workingDirectory + '/' + path.substring(2);
    } else if (path.startsWith('../')) {
      // Handle parent directory navigation
      const parts = this.workingDirectory.split('/').filter(p => p);
      while (path.startsWith('../')) {
        if (parts.length > 0) {
          parts.pop();
        }
        path = path.substring(3);
      }
      path = '/' + parts.join('/') + '/' + path;
    } else if (!path.startsWith('/')) {
      path = this.workingDirectory + '/' + path;
    }
    
    // Remove duplicate slashes
    path = path.replace(/\/+/g, '/');
    
    // Remove trailing slash (except for root)
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    return path;
  }

  /** Get the current working directory */
  getWorkingDirectory(): string {
    return this.workingDirectory;
  }

  /** Change the working directory */
  setWorkingDirectory(path: string): void {
    this.workingDirectory = this.normalizePath(path);
  }

  /** Get the virtual file system state */
  getFileSystem(): FileSystem {
    return JSON.parse(JSON.stringify(this.fileSystem));
  }

  /** Reset the sandbox state */
  reset(): void {
    this.fileSystem = this.createEmptyFileSystem();
    this.workingDirectory = '/';
    this.environment = {};
  }
}
