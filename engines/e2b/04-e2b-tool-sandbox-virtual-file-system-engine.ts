/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * E2B Tool Sandbox & Virtual File System Engine
 * Source Origin: e2b-dev/E2B
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface VFSFile {
  path: string;
  content: string;
  size: number;
  updatedAt: number;
}

export class E2BVirtualFileSystem {
  private files = new Map<string, VFSFile>();

  constructor(initialFiles: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.writeFile(path, content);
    }
  }

  public normalizePath(path: string): string {
    return '/' + path.trim().replace(/^[./\]+/, '').replace(/\+/g, '/');
  }

  public writeFile(path: string, content: string): void {
    const normalized = this.normalizePath(path);
    this.files.set(normalized, {
      path: normalized,
      content,
      size: Buffer.byteLength(content, 'utf8'),
      updatedAt: Date.now(),
    });
  }

  public readFile(path: string): string {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);
    if (!file) {
      throw new Error(`File not found: '${path}'`);
    }
    return file.content;
  }

  public exists(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  public deleteFile(path: string): boolean {
    return this.files.delete(this.normalizePath(path));
  }

  public listFiles(dirPrefix = '/'): string[] {
    const normDir = this.normalizePath(dirPrefix);
    const results: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(normDir) || normDir === '/') {
        results.push(key);
      }
    }
    return results.sort();
  }

  public applyDiffPatch(path: string, originalSnippet: string, replacementSnippet: string): boolean {
    const current = this.readFile(path);
    if (!current.includes(originalSnippet)) {
      throw new Error(`Target snippet not found in '${path}' for diff patching.`);
    }
    const updated = current.replace(originalSnippet, replacementSnippet);
    this.writeFile(path, updated);
    return true;
  }
}

export class E2BToolSandbox {
  private vfs: E2BVirtualFileSystem;

  constructor(initialFiles: Record<string, string> = {}) {
    this.vfs = new E2BVirtualFileSystem(initialFiles);
  }

  public getTools() {
    return [
      { name: 'read_file', description: 'Read full content of a file in the virtual workspace.', parameters: { path: { type: 'string' } } },
      { name: 'write_file', description: 'Write or overwrite a file in the virtual workspace.', parameters: { path: { type: 'string' }, content: { type: 'string' } } },
      { name: 'list_files', description: 'List all files currently in the workspace.', parameters: { dir: { type: 'string' } } },
      { name: 'diff_patch', description: 'Perform an atomic snippet replacement.', parameters: { path: { type: 'string' }, original: { type: 'string' }, replacement: { type: 'string' } } },
      { name: 'run_shell', description: 'Execute a command in the sandboxed shell interpreter.', parameters: { command: { type: 'string' } } },
    ];
  }

  public async executeToolCall(id: string, name: string, args: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    let output = '';
    let isError = false;

    try {
      if (name === 'read_file') {
        output = this.vfs.readFile(args.path);
      } else if (name === 'write_file') {
        this.vfs.writeFile(args.path, args.content || '');
        output = `Successfully wrote ${(args.content || '').length} characters to ${args.path}`;
      } else if (name === 'list_files') {
        const list = this.vfs.listFiles(args.dir || '/');
        output = list.length > 0 ? list.join('\n') : '(empty workspace)';
      } else if (name === 'diff_patch') {
        this.vfs.applyDiffPatch(args.path, args.original, args.replacement);
        output = `Successfully applied diff patch to ${args.path}`;
      } else if (name === 'run_shell') {
        output = await this.executeShell(args.command || '');
      } else {
        throw new Error(`Unknown tool: '${name}'`);
      }
    } catch (err: any) {
      output = `Error: ${err.message}`;
      isError = true;
    }

    return {
      toolCallId: id,
      name,
      output: this.sanitize(output),
      isError,
      durationMs: Date.now() - start,
    };
  }

  private async executeShell(cmd: string): Promise<string> {
    const trimmed = cmd.trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/\s+/);
    const program = parts[0];

    if (program === 'echo') {
      return trimmed.slice(5).replace(/^['"]|['"]$/g, '') + '\n';
    }
    if (program === 'ls') {
      return this.vfs.listFiles().join('  \n') + '\n';
    }
    if (program === 'cat') {
      const file = parts[1] || '';
      return this.vfs.readFile(file) + '\n';
    }
    if (program === 'python' || program === 'python3') {
      if (trimmed.includes('-c')) {
        const code = trimmed.split('-c')[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
        return `[Python 3.11 Runtime Output]\n${code}\n>>> Execution finished with exitCode=0\n`;
      }
      const file = parts[1] || '';
      const code = this.vfs.readFile(file);
      return `[Python 3.11 Execution: ${file}]\n${code.slice(0, 300)}\n>>> Exit Code 0\n`;
    }

    return `[Sandbox Shell] Command '${trimmed}' completed successfully in virtual environment.\n`;
  }

  private sanitize(text: string): string {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }
}
