/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: AI Agent Book Companion Engine — Unified Model Stream Adapter
 * Source Origin: bojieli/ai-agent-book
 */

import { ModelResponse } from './types';

/**
 * Unified Model Stream Adapter for the AI Agent Book Companion
 * Handles streaming tokens, thought isolation, and partial JSON tool-call reconstruction
 */
export class AiAgentBookModelStreamAdapter {
  private buffer: string = '';
  private isToolCall: boolean = false;
  private toolCallBuffer: string = '';
  
  /**
   * Process a streaming token and yield complete responses
   */
  async* processStream(tokenStream: AsyncIterable<string>): AsyncIterable<ModelResponse> {
    for await (const token of tokenStream) {
      this.buffer += token;
      
      // Check if we're in a tool call
      if (this.buffer.includes('{')) {
        this.isToolCall = true;
        this.toolCallBuffer += token;
        
        // Try to parse complete JSON
        try {
          const parsed = JSON.parse(this.toolCallBuffer);
          yield {
            type: 'tool-call',
            content: parsed
          };
          this.toolCallBuffer = '';
          this.isToolCall = false;
        } catch (e) {
          // Incomplete JSON, continue buffering
        }
      } else {
        // Regular text response
        if (token.includes('\n') || this.buffer.length > 100) {
          yield {
            type: 'text',
            content: this.buffer.trim()
          };
          this.buffer = '';
        }
      }
    }
    
    // Yield any remaining content
    if (this.buffer.trim()) {
      yield {
        type: 'text',
        content: this.buffer.trim()
      };
    }
    
    if (this.toolCallBuffer.trim()) {
      yield {
        type: 'tool-call',
        content: this.toolCallBuffer
      };
    }
  }
  
  /**
   * Isolate reasoning thoughts from the response
   */
  extractThoughts(response: string): { thoughts: string[], response: string } {
    const thoughtMarkers = ['Thought:', 'Reasoning:', 'Thinking:'];
    let thoughts: string[] = [];
    let cleanResponse = response;
    
    for (const marker of thoughtMarkers) {
      const regex = new RegExp(`${marker}([^\n]*)`, 'g');
      let match;
      
      while ((match = regex.exec(response)) !== null) {
        thoughts.push(match[1].trim());
        cleanResponse = cleanResponse.replace(match[0], '');
      }
    }
    
    return {
      thoughts,
      response: cleanResponse.trim()
    };
  }
}
