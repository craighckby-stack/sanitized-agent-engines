/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Career Ops Autonomous Agent Engine — Unified Model Stream Adapter
 * Source Origin: career-ops-hq/career-ops
 */

import { Readable } from 'stream';

class CareerOpsModelStreamAdapter {
  private buffer: string = '';
  private thoughtDelimiter: string = '### THOUGHT ###';
  private toolCallDelimiter: string = '### TOOL ###';
  
  /** Process a stream of tokens and extract thoughts/tool calls */
  async *processStream(stream: Readable): AsyncGenerator<{ type: 'thought' | 'tool' | 'text'; content: string }> {
    for await (const chunk of stream) {
      this.buffer += chunk.toString();
      
      // Extract thoughts
      const thoughtMatch = this.buffer.match(new RegExp(`${this.thoughtDelimiter}([^${this.thoughtDelimiter}]*)${this.thoughtDelimiter}`));
      if (thoughtMatch) {
        yield { type: 'thought', content: thoughtMatch[1].trim() };
        this.buffer = this.buffer.replace(thoughtMatch[0], '');
      }
      
      // Extract tool calls
      const toolMatch = this.buffer.match(new RegExp(`${this.toolCallDelimiter}([^${this.toolCallDelimiter}]*)${this.toolCallDelimiter}`));
      if (toolMatch) {
        yield { type: 'tool', content: toolMatch[1].trim() };
        this.buffer = this.buffer.replace(toolMatch[0], '');
      }
      
      // Regular text
      if (this.buffer.length > 0) {
        yield { type: 'text', content: this.buffer };
        this.buffer = '';
      }
    }
  }
  
  /** Reconstruct partial JSON tool calls */
  reconstructToolCall(partial: string): any {
    try {
      // Try to parse as complete JSON first
      return JSON.parse(partial);
    } catch {
      // If incomplete, try to fix common issues
      const fixed = partial
        .replace(/([\w]+):/g, '"$1":') // Add quotes to keys
        .replace(/'([^']+)'/g, '"$1"') // Replace single quotes with double
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']');
      
      try {
        return JSON.parse(fixed);
      } catch {
        return { raw: partial };
      }
    }
  }
}
