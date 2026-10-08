/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AiderRuntimeEngineRepoMapEngine
 * Source Origin: Aider-AI/aider
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

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
