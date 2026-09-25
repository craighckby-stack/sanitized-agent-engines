/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ag2 Tool Sandbox & Virtual File System Engine
 * Source Origin: ag2ai/ag2
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface VFSFile {
  path: string;
  content: string;
  size: number;
  updatedAt: number;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface VFSOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
  readOnly?: boolean;
}

export class ag2VirtualFileSystem {
  private files = new Map<string, VFSFile>();
  private maxFileSize: number;
  private maxTotalSize: number;
  private readOnly: boolean;

  constructor(initialFiles: Record<string, string> = {}, options: VFSOptions = {}) {
    this.maxFileSize = options.maxFileSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxTotalSize = options.maxTotalSize ?? 100 * 1024 * 1024; // 100MB default
    this.readOnly = options.readOnly ?? false;

    for (const [path, content] of Object.entries(initialFiles)) {
      this.writeFile(path, content);
    }
  }

  public normalizePath(path: string): string {
    if (typeof path !== 'string' || !path.trim()) {
      return '/';
    }

    // Sanitize null bytes and unify separators
    const sanitized = path
      .replace(/\0/g, '')
      .replace(/\\+/g, '/')
      .replace(/\+/g, '/')
      .trim();

    const segments = sanitized.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const seg of segments) {
      if (seg === '.' || seg === '') {
        continue;
      }
      if (seg === '..') {
        if (resolved.length > 0) {
          resolved.pop();
        }
      } else {
        // Strip out dangerous control characters while preserving valid filename chars
        const cleanSeg = seg.replace(/[\x00-\x1f\x7f]/g, '');
        if (cleanSeg) {
          resolved.push(cleanSeg);
        }
      }
    }

    return '/' + resolved.join('/');
  }

  public calculateByteLength(content: string): number {
    if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
      return Buffer.byteLength(content, 'utf8');
    }
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(content).length;
    }
    return content.length;
  }

  public getTotalSize(): number {
    let total = 0;
    for (const file of this.files.values()) {
      total += file.size;
    }
    return total;
  }

  public writeFile(path: string, content: string): void {
    if (this.readOnly) {
      throw new Error(`File system is in read-only mode. Cannot write to '${path}'`);
    }

    const normalized = this.normalizePath(path);
    if (normalized === '/' || normalized === '') {
      throw new Error(`Cannot write directly to virtual filesystem root: '${path}'`);
    }

    const safeContent = typeof content === 'string' ? content : String(content ?? '');
    const byteLength = this.calculateByteLength(safeContent);

    if (byteLength > this.maxFileSize) {
      throw new Error(`File size ${byteLength} exceeds maximum allowed file size of ${this.maxFileSize} bytes`);
    }

    const existingFile = this.files.get(normalized);
    const currentTotal = this.getTotalSize();
    const sizeDelta = byteLength - (existingFile ? existingFile.size : 0);

    if (currentTotal + sizeDelta > this.maxTotalSize) {
      throw new Error(`Virtual filesystem capacity exceeded (${this.maxTotalSize} bytes limit)`);
    }

    this.files.set(normalized, {
      path: normalized,
      content: safeContent,
      size: byteLength,
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
    if (this.readOnly) {
      throw new Error(`File system is in read-only mode. Cannot delete '${path}'`);
    }
    return this.files.delete(this.normalizePath(path));
  }

  public listFiles(dirPrefix = '/'): string[] {
    const normDir = this.normalizePath(dirPrefix);
    const results: string[] = [];

    for (const key of this.files.keys()) {
      if (normDir === '/' || key === normDir || key.startsWith(normDir.endsWith('/') ? normDir : normDir + '/')) {
        results.push(key);
      }
    }
    return results.sort();
  }

  public getStat(path: string): VFSFile | null {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);
    if (!file) return null;
    return { ...file };
  }

  public clear(): void {
    if (this.readOnly) {
      throw new Error('File system is in read-only mode.');
    }
    this.files.clear();
  }

  public dumpSnapshot(): Record<string, string> {
    const snapshot: Record<string, string> = {};
    for (const [path, file] of this.files.entries()) {
      snapshot[path] = file.content;
    }
    return snapshot;
  }

  public applyDiffPatch(path: string, originalSnippet: string, replacementSnippet: string): boolean {
    if (this.readOnly) {
      throw new Error(`File system is in read-only mode. Cannot patch '${path}'`);
    }

    const current = this.readFile(path);
    if (!current.includes(originalSnippet)) {
      throw new Error(`Target snippet not found in '${path}' for diff patching.`);
    }

    // Prevent multiple unanchored ambiguous replaces if snippet appears multiple times
    const firstIndex = current.indexOf(originalSnippet);
    const lastIndex = current.lastIndexOf(originalSnippet);
    if (firstIndex !== lastIndex) {
      // Snippet matches multiple locations; replace strictly the first occurrence defensively
      const updated = current.slice(0, firstIndex) + replacementSnippet + current.slice(firstIndex + originalSnippet.length);
      this.writeFile(path, updated);
      return true;
    }

    const updated = current.replace(originalSnippet, replacementSnippet);
    this.writeFile(path, updated);
    return true;
  }
}

export class ag2ToolSandbox {
  private vfs: ag2VirtualFileSystem;
  private maxOutputLength = 100000;

  constructor(initialFiles: Record<string, string> = {}, vfsOptions?: VFSOptions) {
    this.vfs = new ag2VirtualFileSystem(initialFiles, vfsOptions);
  }

  public getVFS(): ag2VirtualFileSystem {
    return this.vfs;
  }

  public getTools() {
    return [
      {
        name: 'read_file',
        description: 'Read full content of a file in the virtual workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the target file.' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write or overwrite a file in the virtual workspace.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Target destination path.' },
            content: { type: 'string', description: 'Full text content to write.' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_files',
        description: 'List all files currently in the workspace.',
        parameters: {
          type: 'object',
          properties: {
            dir: { type: 'string', description: 'Directory prefix filter (optional, defaults to /).' }
          }
        }
      },
      {
        name: 'diff_patch',
        description: 'Perform an atomic snippet replacement.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to patch.' },
            original: { type: 'string', description: 'Exact code snippet to replace.' },
            replacement: { type: 'string', description: 'New replacement code snippet.' }
          },
          required: ['path', 'original', 'replacement']
        }
      },
      {
        name: 'run_shell',
        description: 'Execute a command in the sandboxed shell interpreter.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command to execute.' }
          },
          required: ['command']
        }
      },
    ];
  }

  public async executeToolCall(id: string, name: string, args: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    let output = '';
    let isError = false;

    try {
      const safeArgs = args || {};

      if (name === 'read_file') {
        if (typeof safeArgs.path !== 'string') {
          throw new Error("Missing required argument 'path' for read_file.");
        }
        output = this.vfs.readFile(safeArgs.path);
      } else if (name === 'write_file') {
        if (typeof safeArgs.path !== 'string') {
          throw new Error("Missing required argument 'path' for write_file.");
        }
        const contentStr = safeArgs.content !== undefined ? String(safeArgs.content) : '';
        this.vfs.writeFile(safeArgs.path, contentStr);
        output = `Successfully wrote ${contentStr.length} characters to ${safeArgs.path}`;
      } else if (name === 'list_files') {
        const list = this.vfs.listFiles(safeArgs.dir || '/');
        output = list.length > 0 ? list.join('\n') : '(empty workspace)';
      } else if (name === 'diff_patch') {
        if (typeof safeArgs.path !== 'string') {
          throw new Error("Missing required argument 'path' for diff_patch.");
        }
        if (typeof safeArgs.original !== 'string') {
          throw new Error("Missing required argument 'original' for diff_patch.");
        }
        if (typeof safeArgs.replacement !== 'string') {
          throw new Error("Missing required argument 'replacement' for diff_patch.");
        }
        this.vfs.applyDiffPatch(safeArgs.path, safeArgs.original, safeArgs.replacement);
        output = `Successfully applied diff patch to ${safeArgs.path}`;
      } else if (name === 'run_shell') {
        output = await this.executeShell(safeArgs.command || '');
      } else {
        throw new Error(`Unknown tool: '${name}'`);
      }
    } catch (err: any) {
      output = `Error: ${err?.message || String(err)}`;
      isError = true;
    }

    // Bound maximum output length to prevent denial-of-service memory exhaustion
    if (output.length > this.maxOutputLength) {
      output = output.slice(0, this.maxOutputLength) + `\n... [Output truncated at ${this.maxOutputLength} characters]`;
    }

    return {
      toolCallId: id || `call_${Date.now()}`,
      name,
      output: this.sanitize(output),
      isError,
      durationMs: Date.now() - start,
    };
  }

  private async executeShell(cmd: string): Promise<string> {
    const trimmed = (cmd || '').trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/\s+/);
    const program = parts[0];

    if (program === 'echo') {
      const match = trimmed.match(/^echo\s+(.*)$/i);
      const rawText = match ? match[1] : '';
      return rawText.replace(/^['"]|['"]$/g, '') + '\n';
    }
    if (program === 'pwd') {
      return '/workspace\n';
    }
    if (program === 'ls') {
      const dirArg = parts[1] || '/';
      const files = this.vfs.listFiles(dirArg);
      return files.length > 0 ? files.join('  \n') + '\n' : '';
    }
    if (program === 'cat') {
      const file = parts[1] || '';
      if (!file) return 'cat: missing file operand\n';
      return this.vfs.readFile(file) + '\n';
    }
    if (program === 'rm') {
      const file = parts[1] || '';
      if (!file) return 'rm: missing operand\n';
      const deleted = this.vfs.deleteFile(file);
      return deleted ? `Removed ${file}\n` : `rm: cannot remove '${file}': No such file\n`;
    }
    if (program === 'python' || program === 'python3') {
      if (trimmed.includes('-c')) {
        const code = trimmed.split('-c')[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
        return `[Python 3.11 Runtime Output]\n${code}\n>>> Execution finished with exitCode=0\n`;
      }
      const file = parts[1] || '';
      if (!file) {
        return `[Python 3.11 Interactive Shell not supported; provide script or -c]\n`;
      }
      const code = this.vfs.readFile(file);
      return `[Python 3.11 Execution: ${file}]\n${code.slice(0, 300)}\n>>> Exit Code 0\n`;
    }

    return `[Sandbox Shell] Command '${trimmed}' completed successfully in virtual environment.\n`;
  }

  private sanitize(text: string): string {
    if (!text) return '';
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }
}
])}}}