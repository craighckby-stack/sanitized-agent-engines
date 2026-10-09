/* GLM-Engine-Harvester [2026-10-09T02:43:52.629Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Agent Reach Autonomous Internet Explorer Engine — Unified Model Stream Adapter
 * Source Origin: Panniantong/Agent-Reach
 */

class AgentReachModelStream {
  private channelRegistry: ChannelRegistry;
  private activeChannel: Channel | null = null;
  private tokenBuffer: string = '';
  private thoughtBuffer: string = '';

  constructor(channelRegistry: ChannelRegistry) {
    this.channelRegistry = channelRegistry;
  }

  async streamTokens(input: string, onToken: (token: string) => void) {
    // Determine appropriate channel based on input
    this.activeChannel = this.channelRegistry.determineChannel(input);
    
    if (!this.activeChannel) {
      throw new Error('No suitable channel found for input');
    }

    // Get streaming adapter for the channel
    const streamAdapter = this.activeChannel.getStreamAdapter();
    
    // Process input through the channel
    const response = await streamAdapter.process(input);
    
    // Stream tokens back to caller
    for (const token of response.tokens) {
      onToken(token);
      this.tokenBuffer += token;
    }
    
    // Extract and store thoughts
    this.thoughtBuffer = response.thought || '';
    
    return {
      finalResponse: response.content,
      thought: this.thoughtBuffer,
      channel: this.activeChannel.name
    };
  }

  reconstructToolCalls(partialJson: string): any[] {
    // Reconstruct tool calls from partial JSON responses
    const toolCalls: any[] = [];
    
    try {
      // Try to parse complete JSON first
      const parsed = JSON.parse(partialJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Partial JSON parsing
      const matches = partialJson.match(/\{[^{}]*"action"[^{}]*\}/g) || [];
      
      for (const match of matches) {
        try {
          const toolCall = JSON.parse(match);
          toolCalls.push(toolCall);
        } catch (e) {
          // Skip invalid tool calls
        }
      }
    }
    
    return toolCalls;
  }

  getThoughtBuffer(): string {
    return this.thoughtBuffer;
  }

  clearBuffer() {
    this.tokenBuffer = '';
    this.thoughtBuffer = '';
  }
}
