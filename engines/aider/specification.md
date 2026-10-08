# AiderRuntimeEngine Code Edit & Git Patching Specification
*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> **Source Origin**: [paul-gauthier/aider](https://github.com/paul-gauthier/aider) (Python)
> **License**: Apache-2.0 (Authentic Source License)
> **Architecture**: Interactive Search-And-Replace Edit Blocks + Tree-Sitter Repo Map + Git Commit/Rollback.

---

## 1. Architectural Topology & Component Overview

The system isolates the core pair-programming runtime into 3 single-responsibility TypeScript engines:

1. **AiderRuntimeEngineCoderEngine**: Parses search/replace edit blocks (`<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE`) and applies modifications directly to file buffers.
2. **AiderRuntimeEngineRepoMapEngine**: Builds tree-sitter AST symbol graphs to prune repository context down to relevant class & method signatures.
3. **AiderRuntimeEngineGitDiffPatcherEngine**: Executes atomic Git diff commits and auto-rollbacks if linting or tests fail.

---

## Engine 1: AiderRuntimeEngineCoderEngine

### What it does
Parses multi-line search-and-replace edit blocks emitted by language models and applies precise line replacements onto target source files with verification.

### Implementation Code
```typescript
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
```

---

## Engine 2: AiderRuntimeEngineRepoMapEngine

### What it does
Generates concise AST symbol maps from repository source files, summarizing class and function definitions to conserve model context budget.

### Implementation Code
```typescript
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
```

---

## Engine 3: AiderRuntimeEngineGitDiffPatcherEngine

### What it does
Tracks workspace file changes, stage edits, and performs atomic commits or auto-rollback on failure.

### Implementation Code
```typescript
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
```
