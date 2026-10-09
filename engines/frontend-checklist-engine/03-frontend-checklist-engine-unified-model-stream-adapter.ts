/* GLM-Engine-Harvester [2026-10-09T04:38:32.866Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Frontend Checklist Autonomous Agent Engine — Unified Model Stream Adapter
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistModelStreamAdapter {
  private buffer: string = '';
  private pendingToolCalls: ToolCall[] = [];
  
  constructor(private config: StreamConfig = {}) {}
  
  /**
   * Process a stream of tokens and extract tool calls
   */
  async processStream(
    stream: AsyncIterable<string>,
    onToken?: (token: string) => void
  ): Promise<StreamResult> {
    let fullText = '';
    let lastThought = '';
    
    for await (const chunk of stream) {
      this.buffer += chunk;
      fullText += chunk;
      
      // Emit token if requested
      onToken?.(chunk);
      
      // Check for complete tool calls
      const toolCalls = this.extractToolCalls(this.buffer);
      if (toolCalls.length > this.pendingToolCalls.length) {
        const newCalls = toolCalls.slice(this.pendingToolCalls.length);
        this.pendingToolCalls = toolCalls;
        
        // Return new tool calls
        return {
          type: 'tool-calls',
          calls: newCalls,
          remainingText: this.buffer
        };
      }
      
      // Check for thought isolation
      const thought = this.extractThought(this.buffer);
      if (thought && thought !== lastThought) {
        lastThought = thought;
        return {
          type: 'thought',
          thought,
          remainingText: this.buffer
        };
      }
    }
    
    // Final result
    return {
      type: 'complete',
      text: fullText,
      toolCalls: this.pendingToolCalls
    };
  }
  
  /**
   * Extract complete tool calls from buffer
   */
  private extractToolCalls(buffer: string): ToolCall[] {
    const regex = /<tool_call>(.*?)<\/tool_call>/gs;
    const calls: ToolCall[] = [];
    let match;
    
    while ((match = regex.exec(buffer)) !== null) {
      try {
        const callData = JSON.parse(match[1]);
        calls.push({
          id: callData.id || `call-${Date.now()}-${calls.length}`,
          name: callData.name,
          parameters: callData.parameters || {}
        });
      } catch (e) {
        // Invalid JSON, skip this tool call
      }
    }
    
    return calls;
  }
  
  /**
   * Extract thought from buffer
   */
  private extractThought(buffer: string): string | null {
    const thoughtRegex = /<thought>(.*?)<\/thought>/s;
    const match = buffer.match(thoughtRegex);
    return match ? match[1].trim() : null;
  }
  
  /**
   * Reconstruct partial JSON tool calls
   */
  reconstructPartialCalls(buffer: string): ToolCall[] {
    const calls: ToolCall[] = [];
    const startIdx = buffer.lastIndexOf('<tool_call>');
    
    if (startIdx === -1) return calls;
    
    const partialContent = buffer.slice(startIdx + '<tool_call>'.length);
    const endIdx = partialContent.indexOf('</tool_call>');
    
    if (endIdx === -1) {
      // Incomplete call, try to parse what we have
      try {
        const partialJson = partialContent.slice(0, Math.min(100, partialContent.length));
        const callData = JSON.parse(partialJson);
        calls.push({
          id: callData.id || `call-${Date.now()}-${calls.length}`,
          name: callData.name || '',
          parameters: callData.parameters || {}
        });
      } catch (e) {
        // Can't parse partial call
      }
    } else {
      // Complete call
      const completeContent = partialContent.slice(0, endIdx);
      try {
        const callData = JSON.parse(completeContent);
        calls.push({
          id: callData.id || `call-${Date.now()}-${calls.length}`,
          name: callData.name,
          parameters: callData.parameters || {}
        });
      } catch (e) {
        // Invalid JSON
      }
    }
    
    return calls;
  }
}

interface StreamConfig {
  maxTokens?: number;
  timeoutMs?: number;
}

interface StreamResult {
  type: 'thought' | 'tool-calls' | 'complete';
  thought?: string;
  calls?: ToolCall[];
  text?: string;
  remainingText: string;
}

interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
}
