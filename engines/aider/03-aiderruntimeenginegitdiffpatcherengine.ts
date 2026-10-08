/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AiderRuntimeEngineGitDiffPatcherEngine
 * Source Origin: Aider-AI/aider
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

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
