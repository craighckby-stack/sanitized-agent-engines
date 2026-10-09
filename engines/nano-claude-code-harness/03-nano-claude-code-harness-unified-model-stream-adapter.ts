/* GLM-Engine-Harvester [2026-10-09T03:29:13.889Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Nano Claude Code Harness Engine — Unified Model Stream Adapter
 * Source Origin: shareAI-lab/learn-claude-code
 */

class NanoClaudeCodeModelStreamAdapter {
  private buffer = '';
  private partialJson: any = null;
  
  constructor(private client: any, private modelId: string) {}
  
  async *streamResponse(messages: any[], system: string, tools: any[]): AsyncGenerator<string> {
    const stream = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 4000,
      system,
      messages,
      tools,
      stream: true
    });
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta?.text || '';
        this.buffer += text;
        
        // Try to extract complete tool calls from partial JSON
        if (chunk.delta?.type === 'tool_use') {
          this.partialJson = {
            ...this.partialJson,
            ...chunk.delta
          };
          
          if (chunk.delta.partial_json) {
            try {
              const complete = JSON.parse(this.partialJson.partial_json);
              yield JSON.stringify(complete);
              this.partialJson = null;
            } catch {
              // Incomplete JSON, continue buffering
            }
          }
        } else {
          // Regular text output
          yield text;
        }
      }
    }
  }
  
  extractThoughts(content: string): { thoughts: string[], output: string } {
    const thoughtMarker = '<thinking>';
    const endMarker = '</thinking>';
    
    const thoughts: string[] = [];
    let output = content;
    
    while (true) {
      const startIdx = output.indexOf(thoughtMarker);
      if (startIdx === -1) break;
      
      const endIdx = output.indexOf(endMarker, startIdx + thoughtMarker.length);
      if (endIdx === -1) break;
      
      const thought = output.slice(startIdx + thoughtMarker.length, endIdx);
      thoughts.push(thought);
      
      output = output.slice(0, startIdx) + output.slice(endIdx + endMarker.length);
    }
    
    return { thoughts, output };
  }
}
