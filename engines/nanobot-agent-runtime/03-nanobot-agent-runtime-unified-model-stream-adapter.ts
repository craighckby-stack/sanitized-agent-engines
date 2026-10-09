/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Nanobot Autonomous Agent Runtime Engine — Unified Model Stream Adapter
 * Source Origin: HKUDS/nanobot
 */

import { AgentContext } from './context';
import { StreamChunk } from './types';

/**
 * Unified model stream adapter for handling token streaming and tool calls.
 */
export class NanobotModelStreamAdapter {
  private buffer: string = '';
  private pendingToolCall: any = null;
  
  /**
   * Process streaming tokens and reconstruct tool calls
   */
  async processStream(
    stream: AsyncIterable<string>,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    for await (const token of stream) {
      this.buffer += token;
      
      // Try to parse complete tool calls
      if (this.buffer.includes('\n\n')) {
        const parts = this.buffer.split('\n\n');
        const complete = parts.pop();
        this.buffer = parts.join('\n\n');
        
        if (complete) {
          const toolCall = this.parseToolCall(complete);
          if (toolCall) {
            onChunk({ type: 'tool_call', data: toolCall });
            this.buffer = '';
            continue;
          }
        }
      }
      
      // Emit regular text chunks
      onChunk({ type: 'text', data: token });
    }
    
    // Handle any remaining buffer
    if (this.buffer) {
      onChunk({ type: 'text', data: this.buffer });
      this.buffer = '';
    }
  }
  
  private parseToolCall(text: string): any | null {
    // Try to parse JSON tool calls
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'function_call' || parsed.type === 'tool_use') {
        return parsed;
      }
    } catch {
      // Not valid JSON
    }
    
    return null;
  }
  
  /**
   * Isolate reasoning thoughts from tool calls
   */
  extractReasoning(text: string): string {
    // Remove tool call blocks from reasoning
    return text.replace(/```json\n.*?\n```/g, '').trim();
  }
}
