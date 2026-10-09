/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Cherry Studio Autonomous Agent Runtime Engine — Unified Model Stream Adapter
 * Source Origin: CherryHQ/cherry-studio
 */

export class cherryStudioModelStreamAdapter {
  private buffer: string = '';
  private pendingToolCalls: Array<{ id: string; name: string; args: any }> = [];

  async *streamTokens(
    modelCall: () => AsyncIterable<string>
  ): AsyncIterable<{ content: string; toolCalls?: any[] }> {
    this.buffer = '';
    this.pendingToolCalls = [];
    
    for await (const chunk of modelCall()) {
      this.buffer += chunk;
      
      // Try to extract complete tool calls
      const { content, toolCalls, remaining } = this.extractToolCalls(this.buffer);
      this.buffer = remaining;
      
      if (toolCalls.length > 0) {
        yield { content, toolCalls };
      } else if (content) {
        yield { content };
      }
    }
    
    // Yield any remaining content
    if (this.buffer) {
      yield { content: this.buffer };
    }
  }

  private extractToolCalls(buffer: string): { content: string; toolCalls: any[]; remaining: string } {
    const toolCalls: any[] = [];
    let content = '';
    let remaining = buffer;
    
    // Simple regex-based tool call extraction
    // In a real implementation, this would use proper JSON parsing
    const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
    let match;
    
    while ((match = toolCallRegex.exec(buffer)) !== null) {
      try {
        const toolCall = JSON.parse(match[1]);
        toolCalls.push(toolCall);
        remaining = remaining.replace(match[0], '');
      } catch (e) {
        // Invalid JSON, treat as regular content
        content += match[0];
      }
    }
    
    return { content, toolCalls, remaining };
  }

  isolateThoughts(buffer: string): { thoughts: string; content: string } {
    const thoughtDelimiter = '<thought>';
    const endDelimiter = '</thought>';
    
    const thoughtStart = buffer.indexOf(thoughtDelimiter);
    if (thoughtStart === -1) {
      return { thoughts: '', content: buffer };
    }
    
    const thoughtEnd = buffer.indexOf(endDelimiter, thoughtStart);
    if (thoughtEnd === -1) {
      return { thoughts: '', content: buffer };
    }
    
    const thoughts = buffer.slice(
      thoughtStart + thoughtDelimiter.length,
      thoughtEnd
    );
    
    const content = [
      buffer.slice(0, thoughtStart),
      buffer.slice(thoughtEnd + endDelimiter.length)
    ].join('');
    
    return { thoughts, content };
  }
}
