/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Autonomous Agent Runtime Engine — Unified Model Stream Adapter
 * Source Origin: NousResearch/hermes-agent
 */

import { ModelRequest, ModelResponse, StreamChunk } from './types';

/**
 * Unified Model Stream Adapter - Streaming tokens with thought isolation and tool-call reconstruction
 */
export class AutonomousAgentModelStream {
  private buffer: string = '';
  private toolCalls: any[] = [];
  private currentTool: any = null;
  private isProcessingTool: boolean = false;

  /** Process a stream of model response chunks */
  async processStream(
    request: ModelRequest,
    stream: AsyncIterable<StreamChunk>,
    onToken: (token: string) => void,
    onToolCall: (toolCall: any) => void
  ): Promise<ModelResponse> {
    let fullResponse = '';
    let isComplete = false;
    
    for await (const chunk of stream) {
      const content = chunk.content || '';
      fullResponse += content;
      
      // Process tool calls if present
      if (chunk.tool_calls) {
        for (const toolCall of chunk.tool_calls) {
          await this.processToolCall(toolCall, onToolCall);
        }
      }
      
      // Emit tokens for display
      onToken(content);
      
      // Check for completion
      if (chunk.finish_reason) {
        isComplete = true;
      }
    }
    
    return {
      request,
      content: fullResponse,
      tool_calls: this.toolCalls,
      finish_reason: isComplete ? 'stop' : null
    };
  }

  /** Process a tool call from the stream */
  private async processToolCall(toolCall: any, onToolCall: (toolCall: any) => void): Promise<void> {
    if (!this.isProcessingTool) {
      // Start new tool call
      this.currentTool = {
        id: toolCall.id,
        type: toolCall.type,
        function: {
          name: toolCall.function.name,
          arguments: ''
        }
      };
      this.isProcessingTool = true;
      onToolCall(this.currentTool);
    }
    
    // Append arguments
    if (this.currentTool && toolCall.function.arguments) {
      this.currentTool.function.arguments += toolCall.function.arguments;
      
      // Update the existing tool call in the callback
      onToolCall(this.currentTool);
    }
    
    // Check for tool completion
    if (toolCall.finish_reason === 'stop') {
      if (this.currentTool) {
        this.toolCalls.push(this.currentTool);
        this.currentTool = null;
        this.isProcessingTool = false;
      }
    }
  }

  /** Reset the stream state */
  reset(): void {
    this.buffer = '';
    this.toolCalls = [];
    this.currentTool = null;
    this.isProcessingTool = false;
  }

  /** Extract partial JSON from the buffer */
  extractPartialJSON(): any | null {
    try {
      // Try to parse as complete JSON first
      return JSON.parse(this.buffer);
    } catch {
      // If that fails, try to extract partial JSON
      const start = this.buffer.indexOf('{');
      if (start === -1) return null;
      
      const end = this.buffer.lastIndexOf('}');
      if (end === -1) return null;
      
      const partial = this.buffer.substring(start, end + 1);
      return JSON.parse(partial);
    }
  }
}
