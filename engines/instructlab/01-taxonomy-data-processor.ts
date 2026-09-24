/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Taxonomy Data Processor
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';

interface TaxonomyNode {
  version: string;
  domain: string;
  document: {
    repo: string;
    commit: string;
    patterns: string[];
  };
}

export class TaxonomyDataProcessor {
  public process(filePath: string): TaxonomyNode {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const data = yaml.load(fileContents) as TaxonomyNode;
      
      this.validate(data);
      
      return data;
    } catch (e) {
      throw new Error(`Failed to process InstructlabRuntimeEngine taxonomy: ${e}`);
    }
  }

  private validate(node: TaxonomyNode): void {
    if (!node.version || !node.domain) {
      throw new Error("Invalid taxonomy schema detected.");
    }
  }
}
