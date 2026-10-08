/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AiderRuntimeEngineCoderEngine
 * Source Origin: Aider-AI/aider
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

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
