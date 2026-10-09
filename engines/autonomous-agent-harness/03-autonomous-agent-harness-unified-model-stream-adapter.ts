/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Autonomous Agent Harness Engine — Unified Model Stream Adapter
 * Source Origin: zhayujie/CowAgent
 */

import { Observable } from 'rxjs';

/**
 * Unified Model Stream Adapter - Streaming tokens, thought isolation, partial JSON tool-call reconstruction
 */
export class autonomousAgentHarnessModelStreamAdapter {
  private buffer: string = '';
  private partialJsonBuffer: string = '';
  private inJsonBlock: boolean = false;
  private toolCalls: Array<{
    id: string;
    function: string;
    args: string;
  }> = [];

  /**
   * Process a stream of tokens and emit structured events
   */
  processStream(stream: Observable<string>): Observable<{
    type: 'token' | 'thought' | 'tool_call' | 'error';
    content: string;
    toolCallId?: string;
  }> {
    return new Observable((subscriber) => {
      const subscription = stream.subscribe({
        next: (token) => {
          try {
            const event = this.processToken(token);
            if (event) {
              subscriber.next(event);
            }
          } catch (error) {
            subscriber.next({
              type: 'error',
              content: error instanceof Error ? error.message : String(error),
            });
          }
        },
        error: (err) => {
          subscriber.error(err);
        },
        complete: () => {
          // Flush any remaining content
          if (this.buffer.trim()) {
            subscriber.next({
              type: 'token',
              content: this.buffer.trim(),
            });
          }
          
          // Emit any pending tool calls
          for (const toolCall of this.toolCalls) {
            subscriber.next({
              type: 'tool_call',
              content: toolCall.function,
              toolCallId: toolCall.id,
            });
          }
          
          subscriber.complete();
        },
      });

      return () => subscription.unsubscribe();
    });
  }

  private processToken(token: string): {
    type: 'token' | 'thought' | 'tool_call' | 'error';
    content: string;
    toolCallId?: string;
  } | null {
    this.buffer += token;

    // Detect thought blocks
    if (this.buffer.includes('Thought:')) {
      const thoughtMatch = this.buffer.match(/Thought:\s*([^\n]+)/);
      if (thoughtMatch) {
        const thought = thoughtMatch[1].trim();
        this.buffer = this.buffer.replace(/Thought:\s*([^\n]+)/, '').trim();
        return {
          type: 'thought',
          content: thought,
        };
      }
    }

    // Detect JSON tool calls
    if (token.includes('{') && !this.inJsonBlock) {
      this.inJsonBlock = true;
      this.partialJsonBuffer = '';
    }

    if (this.inJsonBlock) {
      this.partialJsonBuffer += token;

      try {
        // Try to parse as complete JSON
        const parsed = JSON.parse(this.partialJsonBuffer);
        
        if (parsed.type === 'tool_call' || parsed.function) {
          this.inJsonBlock = false;
          this.toolCalls.push({
            id: parsed.id || `tool_${Date.now()}`,
            function: parsed.function || parsed.name,
            args: JSON.stringify(parsed.arguments || parsed.params),
          });
          
          return {
            type: 'tool_call',
            content: parsed.function || parsed.name,
            toolCallId: parsed.id || `tool_${Date.now()}`,
          };
        }
      } catch {
        // Incomplete JSON, continue buffering
        if (token.includes('}')) {
          this.inJsonBlock = false;
        }
      }
    }

    // Regular token emission
    if (token.includes('\n') || token.includes('. ')) {
      const content = this.buffer.trim();
      this.buffer = '';
      if (content) {
        return {
          type: 'token',
          content,
        };
      }
    }

    return null;
  }

  /**
   * Get collected tool calls
   */
  getToolCalls() {
    return [...this.toolCalls];
  }

  /**
   * Reset the adapter state
   */
  reset() {
    this.buffer = '';
    this.partialJsonBuffer = '';
    this.inJsonBlock = false;
    this.toolCalls = [];
  }
}
