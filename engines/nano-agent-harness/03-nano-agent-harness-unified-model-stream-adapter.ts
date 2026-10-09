/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Nano Agent Harness Engine — Unified Model Stream Adapter
 * Source Origin: shareAI-lab/learn-claude-code
 */

export class NanoModelStreamAdapter {
  private buffer = '';
  private partialToolCall: PartialToolCall | null = null;
  
  constructor(
    private modelClient: ModelClient,
    private config: StreamConfig = {}
  ) {}
  
  async *streamResponse(
    messages: Message[],
    tools: ToolDefinition[]
  ): AsyncIterable<StreamChunk> {
    const stream = await this.modelClient.createStream(messages, tools);
    
    for await (const chunk of stream) {
      if (chunk.type === 'text') {
        this.buffer += chunk.content;
        yield {
          type: 'text',
          content: chunk.content
        };
        
        // Try to detect and reconstruct partial tool calls
        if (this.config.reconstructToolCalls) {
          const toolCall = this.extractPartialToolCall(this.buffer);
          if (toolCall && !this.partialToolCall) {
            this.partialToolCall = toolCall;
            yield {
              type: 'tool_start',
              toolName: toolCall.name
            };
          }
        }
      } else if (chunk.type === 'tool_call_start') {
        this.partialToolCall = {
          id: chunk.id,
          name: chunk.name,
          arguments: ''
        };
        yield {
          type: 'tool_start',
          toolName: chunk.name
        };
      } else if (chunk.type === 'tool_call_delta') {
        if (this.partialToolCall) {
          this.partialToolCall.arguments += chunk.delta;
          yield {
            type: 'tool_args',
            args: chunk.delta
          };
        }
      } else if (chunk.type === 'tool_call_end') {
        if (this.partialToolCall) {
          yield {
            type: 'tool_complete',
            toolCall: this.partialToolCall
          };
          this.partialToolCall = null;
        }
      }
    }
  }
  
  private extractPartialToolCall(text: string): PartialToolCall | null {
    // Simple regex-based extraction for demonstration
    // In a real implementation, this would be more sophisticated
    const match = text.match(/\{"type": "tool_call", "name": "(\w+)", "arguments": ({.*})\}/);
    if (match) {
      try {
        return {
          id: `temp-${Date.now()}`,
          name: match[1],
          arguments: match[2]
        };
      } catch {
        return null;
      }
    }
    return null;
  }
  
  reset(): void {
    this.buffer = '';
    this.partialToolCall = null;
  }
}

interface StreamConfig {
  reconstructToolCalls?: boolean;
}

interface ModelClient {
  createStream(messages: Message[], tools: ToolDefinition[]): AsyncIterable<ModelChunk>;
}

interface ModelChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end';
  content?: string;
  id?: string;
  name?: string;
  delta?: string;
}

interface StreamChunk {
  type: 'text' | 'tool_start' | 'tool_args' | 'tool_complete';
  content?: string;
  toolName?: string;
  args?: string;
  toolCall?: PartialToolCall;
}

interface PartialToolCall {
  id: string;
  name: string;
  arguments: string;
}
