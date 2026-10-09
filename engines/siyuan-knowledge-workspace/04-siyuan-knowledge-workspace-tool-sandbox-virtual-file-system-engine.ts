/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Siyuan Knowledge Workspace Engine — Tool Sandbox & Virtual File System
 * Source Origin: siyuan-note/siyuan
 */

export class siyuanToolSandbox {
  private vfs: Map<string, string> = new Map();
  private workingDirectory: string = '/';
  private shellHistory: string[] = [];

  /**
   * Execute a command in the sandbox
   */
  async execute(command: string): Promise<string> {
    this.shellHistory.push(command);
    
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'ls':
        return this.listFiles(args[0] || this.workingDirectory);
      case 'cat':
        return this.readFile(args[0]);
      case 'echo':
        return args.join(' ');
      case 'mkdir':
        return this.createDirectory(args[0]);
      case 'write':
        return this.writeFile(args[0], args.slice(1).join(' '));
      case 'cd':
        return this.changeDirectory(args[0]);
      default:
        return `Unknown command: ${cmd}`;
    }
  }

  /**
   * List files in a directory
   */
  private listFiles(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const files: string[] = [];
    
    for (const [filePath, content] of this.vfs) {
      if (filePath.startsWith(normalizedPath) && 
          filePath.substring(normalizedPath.length).split('/').length === 2) {
        const fileName = filePath.substring(normalizedPath.length).split('/')[0];
        if (fileName) files.push(fileName);
      }
    }
    
    return files.length > 0 ? files.join('\n') : 'Directory is empty';
  }

  /**
   * Read a file
   */
  private readFile(path: string): string {
    const normalizedPath = this.normalizePath(path);
    const content = this.vfs.get(normalizedPath);
    return content || 'File not found';
  }

  /**
   * Create a directory
   */
  private createDirectory(path: string): string {
    const normalizedPath = this.normalizePath(path);
    if (!this.vfs.has(normalizedPath)) {
      this.vfs.set(normalizedPath, '');
      return `Directory created: ${normalizedPath}`;
    }
    return 'Directory already exists';
  }

  /**
   * Write to a file
   */
  private writeFile(path: string, content: string): string {
    const normalizedPath = this.normalizePath(path);
    this.vfs.set(normalizedPath, content);
    return `File written: ${normalizedPath}`;
  }

  /**
   * Change working directory
   */
  private changeDirectory(path: string): string {
    const normalizedPath = this.normalizePath(path);
    if (this.vfs.has(normalizedPath)) {
      this.workingDirectory = normalizedPath;
      return `Changed directory to: ${normalizedPath}`;
    }
    return 'Directory not found';
  }

  /**
   * Normalize a path
   */
  private normalizePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return `${this.workingDirectory}/${path}`.replace(/\/g, '/');
  }

  /**
   * Get the virtual file system
   */
  getVFS(): Map<string, string> {
    return new Map(this.vfs);
  }

  /**
   * Get shell history
   */
  getHistory(): string[] {
    return [...this.shellHistory];
  }

  /**
   * Reset the sandbox
   */
  reset(): void {
    this.vfs.clear();
    this.workingDirectory = '/';
    this.shellHistory = [];
  }
}
