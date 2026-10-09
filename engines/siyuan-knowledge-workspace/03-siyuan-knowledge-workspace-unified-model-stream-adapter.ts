/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Siyuan Knowledge Workspace Engine — Unified Model Stream Adapter
 * Source Origin: siyuan-note/siyuan
 */

export class siyuanModelStreamAdapter {
  private buffer: string = '';
  private thoughtBuffer: string = '';
  private callbacks: ((chunk: string) => void)[] = [];

  /**
   * Process a streaming token
   */
  processToken(token: string): void {
    this.buffer += token;
    
    // Check for thought patterns
    if (token.includes('Thought:')) {
      this.thoughtBuffer += token;
    }
    
    // Check for complete tool calls
    if (this.buffer.includes('```json') && this.buffer.includes('```')) {
      const toolCall = this.extractToolCall(this.buffer);
      if (toolCall) {
        this.notifyCallbacks(toolCall);
        this.buffer = '';
      }
    } else {
      this.notifyCallbacks(token);
    }
  }

  /**
   * Extract a complete tool call from buffer
   */
  private extractToolCall(buffer: string): string | null {
    const start = buffer.indexOf('```json');
    const end = buffer.indexOf('```', start + 7);
    
    if (start !== -1 && end !== -1) {
      return buffer.substring(start + 7, end).trim();
    }
    
    return null;
  }

  /**
   * Register a callback for new chunks
   */
  onChunk(callback: (chunk: string) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Notify all callbacks with a chunk
   */
  private notifyCallbacks(chunk: string): void {
    for (const callback of this.callbacks) {
      try {
        callback(chunk);
      } catch (e) {
        console.error('Error in stream callback:', e);
      }
    }
  }

  /**
   * Get the current thought buffer
   */
  getThoughtBuffer(): string {
    return this.thoughtBuffer;
  }

  /**
   * Reset the stream state
   */
  reset(): void {
    this.buffer = '';
    this.thoughtBuffer = '';
    this.callbacks = [];
  }
}
