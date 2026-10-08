/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Unified Clean-Room Runtime for aider
 * Source Origin: Aider-AI/aider
 */

// ==========================================
// AiderRuntimeEngineCoderEngine
// ==========================================
export interface SearchReplaceBlock {
  filePath: string;
  searchBlock: string;
  replaceBlock: string;
}

export class AiderRuntimeEngineCoderEngine {
  public parseEditBlocks(llmOutput: string): SearchReplaceBlock[] {
    const blocks: SearchReplaceBlock[] = [];
    const regex = /([\w./-]+)\n<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(llmOutput)) !== null) {
      blocks.push({
        filePath: match[1].trim(),
        searchBlock: match[2],
        replaceBlock: match[3],
      });
    }

    return blocks;
  }

  public applyPatch(fileContent: string, block: SearchReplaceBlock): { updatedContent: string; success: boolean } {
    if (!fileContent.includes(block.searchBlock)) {
      return { updatedContent: fileContent, success: false };
    }
    const updated = fileContent.replace(block.searchBlock, block.replaceBlock);
    return { updatedContent: updated, success: true };
  }
}

// ==========================================
// AiderRuntimeEngineRepoMapEngine
// ==========================================
export interface SymbolTag {
  name: string;
  kind: 'class' | 'function' | 'method';
  line: number;
}

export class AiderRuntimeEngineRepoMapEngine {
  private fileTags = new Map<string, SymbolTag[]>();

  public extractSymbols(filePath: string, code: string): SymbolTag[] {
    const tags: SymbolTag[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const classMatch = line.match(/(?:class|def|function)\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        tags.push({
          name: classMatch[1],
          kind: line.includes('class') ? 'class' : 'function',
          line: index + 1,
        });
      }
    });

    this.fileTags.set(filePath, tags);
    return tags;
  }

  public generateMapSummary(): string {
    let summary = '';
    for (const [path, tags] of this.fileTags.entries()) {
      summary += `File: ${path}\n`;
      tags.forEach((t) => {
        summary += `  ${t.kind} ${t.name} (line ${t.line})\n`;
      });
    }
    return summary;
  }
}

// ==========================================
// AiderRuntimeEngineGitDiffPatcherEngine
// ==========================================
export class AiderRuntimeEngineGitDiffPatcherEngine {
  private history: { filePath: string; previousContent: string }[] = [];

  public snapshot(filePath: string, currentContent: string): void {
    this.history.push({ filePath, previousContent: currentContent });
  }

  public rollbackAll(fileStore: Map<string, string>): void {
    while (this.history.length > 0) {
      const entry = this.history.pop()!;
      fileStore.set(entry.filePath, entry.previousContent);
    }
  }
}
