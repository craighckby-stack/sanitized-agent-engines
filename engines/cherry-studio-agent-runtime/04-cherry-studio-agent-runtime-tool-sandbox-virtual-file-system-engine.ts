/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Cherry Studio Autonomous Agent Runtime Engine — Tool Sandbox & Virtual File System
 * Source Origin: CherryHQ/cherry-studio
 */

export class cherryStudioToolSandbox {
  private vfs: Map<string, { content: string; type: 'file' | 'dir' }> = new Map();
  private workingDir: string = '/';

  constructor() {
    // Initialize root directory
    this.vfs.set('/', { content: '', type: 'dir' });
  }

  /** Execute a shell command in the sandbox */
  async executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDir);
      case 'cd':
        return this.changeDirectory(args[0]);
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return this.echo(args.join(' '));
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        return this.writeFile(args[0], args.slice(1).join(' '));
      default:
        return {
          stdout: '',
          stderr: `Unknown command: ${cmd}`
        };
    }
  }

  private listFiles(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const dir = this.vfs.get(fullPath);
    
    if (!dir || dir.type !== 'dir') {
      return {
        stdout: '',
        stderr: `Directory not found: ${path}`
      };
    }
    
    const files = Array.from(this.vfs.entries())
      .filter(([_, entry]) => {
        const parent = entry.type === 'dir' 
          ? this.getParentPath(entry.content || '')
          : this.getParentPath(this.getFilePath(entry.content || ''));
        return parent === fullPath;
      })
      .map(([name]) => this.basename(name));
    
    return {
      stdout: files.join('\n'),
      stderr: ''
    };
  }

  private changeDirectory(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const dir = this.vfs.get(fullPath);
    
    if (!dir || dir.type !== 'dir') {
      return {
        stdout: '',
        stderr: `Directory not found: ${path}`
      };
    }
    
    this.workingDir = fullPath;
    return {
      stdout: '',
      stderr: ''
    };
  }

  private readFile(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    const entry = this.vfs.get(fullPath);
    
    if (!entry || entry.type !== 'file') {
      return {
        stdout: '',
        stderr: `File not found: ${path}`
      };
    }
    
    return {
      stdout: entry.content,
      stderr: ''
    };
  }

  private echo(text: string): { stdout: string; stderr: string } {
    return {
      stdout: text,
      stderr: ''
    };
  }

  private createDirectory(path: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    
    if (this.vfs.has(fullPath)) {
      return {
        stdout: '',
        stderr: `Directory already exists: ${path}`
      };
    }
    
    this.vfs.set(fullPath, { content: '', type: 'dir' });
    return {
      stdout: '',
      stderr: ''
    };
  }

  private writeFile(path: string, content: string): { stdout: string; stderr: string } {
    const fullPath = this.resolvePath(path);
    
    // Ensure parent directory exists
    const parentDir = this.getParentPath(fullPath);
    if (!this.vfs.has(parentDir)) {
      return {
        stdout: '',
        stderr: `Parent directory not found: ${parentDir}`
      };
    }
    
    this.vfs.set(fullPath, { content, type: 'file' });
    return {
      stdout: '',
      stderr: ''
    };
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    
    const parts = [...this.workingDir.split('/').filter(Boolean), path];
    return '/' + parts.join('/');
  }

  private getParentPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '/';
    
    const parent = '/' + parts.slice(0, -1).join('/');
    return parent || '/';
  }

  private getFilePath(path: string): string {
    if (path.endsWith('/')) return path.slice(0, -1);
    return path;
  }

  private basename(path: string): string {
    const normalized = this.getFilePath(path);
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] || '/';
  }

  /** Get a sanitized copy of the VFS */
  getVFS(): Map<string, { content: string; type: 'file' | 'dir' }> {
    return new Map(this.vfs);
  }

  /** Reset the VFS to initial state */
  reset(): void {
    this.vfs.clear();
    this.vfs.set('/', { content: '', type: 'dir' });
    this.workingDir = '/';
  }
}
