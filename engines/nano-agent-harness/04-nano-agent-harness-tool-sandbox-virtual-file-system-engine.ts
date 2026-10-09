/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 4: Nano Agent Harness Engine — Tool Sandbox & Virtual File System
 * Source Origin: shareAI-lab/learn-claude-code
 */

export class NanoToolSandbox {
  private vfs: VirtualFileSystem;
  private allowedTools: Set<string>;
  
  constructor(
    private config: SandboxConfig = {}
  ) {
    this.vfs = new VirtualFileSystem();
    this.allowedTools = new Set(config.allowedTools || []);
  }
  
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    if (!this.allowedTools.has(toolName)) {
      throw new Error(`Tool not allowed: ${toolName}`);
    }
    
    switch (toolName) {
      case 'bash':
        return this.runBash(args.command as string);
      case 'read':
        return this.runRead(args.path as string, args.limit as number);
      case 'write':
        return this.runWrite(args.path as string, args.content as string);
      case 'edit':
        return this.runEdit(args.path as string, args.content as string);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  private runBash(command: string): string {
    const dangerous = ['rm -rf /', 'sudo', 'shutdown', 'reboot', '> /dev/'];
    if (dangerous.some(d => command.includes(d))) {
      return 'Error: Dangerous command blocked';
    }
    
    try {
      const result = subprocess.run(
        command,
        shell: true,
        cwd: this.vfs.getWorkingDirectory(),
        captureOutput: true,
        text: true,
        errors: 'replace',
        timeout: this.config.commandTimeout || 120
      );
      
      const output = (result.stdout + result.stderr).trim();
      return output.slice(0, this.config.maxOutputSize || 50000) || '(no output)';
    } catch (error) {
      if (error instanceof subprocess.TimeoutExpired) {
        return 'Error: Timeout';
      }
      return `Error: ${error.message}`;
    }
  }
  
  private runRead(path: string, limit?: number): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      const content = this.vfs.readFile(fullPath);
      
      if (limit && content.split('\n').length > limit) {
        const lines = content.split('\n');
        return lines.slice(0, limit).join('\n') + `\n... (${lines.length - limit} more lines)`;
      }
      
      return content.slice(0, this.config.maxOutputSize || 50000);
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private runWrite(path: string, content: string): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      this.vfs.writeFile(fullPath, content);
      return `File written: ${path}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private runEdit(path: string, content: string): string {
    try {
      const fullPath = this.vfs.resolvePath(path);
      const currentContent = this.vfs.readFile(fullPath);
      const updatedContent = this.sanitizeEdit(currentContent, content);
      this.vfs.writeFile(fullPath, updatedContent);
      return `File edited: ${path}`;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }
  
  private sanitizeEdit(original: string, edit: string): string {
    // Basic sanitization to prevent dangerous edits
    // In a real implementation, this would be more sophisticated
    if (edit.includes('rm -rf') || edit.includes('> /dev/')) {
      throw new Error('Dangerous edit detected');
    }
    return edit;
  }
}

interface SandboxConfig {
  allowedTools?: string[];
  commandTimeout?: number;
  maxOutputSize?: number;
}

class VirtualFileSystem {
  private workingDir: string = process.cwd();
  private files: Map<string, string> = new Map();
  
  getWorkingDirectory(): string {
    return this.workingDir;
  }
  
  resolvePath(path: string): string {
    const fullPath = path.resolve(this.workingDir, path);
    if (!fullPath.startsWith(this.workingDir)) {
      throw new Error('Path escapes workspace');
    }
    return fullPath;
  }
  
  readFile(path: string): string {
    return this.files.get(path) || '';
  }
  
  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  
  listFiles(dir: string): string[] {
    const files: string[] = [];
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    
    for (const [path] of this.files) {
      if (path.startsWith(prefix)) {
        const relativePath = path.slice(prefix.length);
        if (!relativePath.includes('/')) {
          files.push(relativePath);
        }
      }
    }
    
    return files;
  }
}
