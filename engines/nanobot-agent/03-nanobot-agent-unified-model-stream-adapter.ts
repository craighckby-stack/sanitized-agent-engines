/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Nanobot Autonomous Agent Framework Engine — Unified Model Stream Adapter
 * Source Origin: HKUDS/nanobot
 */

import { LLMRuntime } from './llm-runtime';
import { LLMResponse, LLMStreamChunk } from '../providers/base';
import { AgentContext } from './context';
import { Session } from '../session';
import { InboundMessage } from '../bus/events';

export class NanobotModelStreamAdapter {
  private llm: LLMRuntime;
  private context: AgentContext;

  constructor(llm: LLMRuntime, context: AgentContext) {
    this.llm = llm;
    this.context = context;
  }

  async *stream(session: Session, message: InboundMessage): AsyncGenerator<LLMStreamChunk> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Create a streaming response
    const stream = this.llm.stream(messages);
    
    let accumulatedContent = '';
    let accumulatedToolCalls: any[] = [];
    
    for await (const chunk of stream) {
      // Accumulate content
      if (chunk.content) {
        accumulatedContent += chunk.content;
      }
      
      // Accumulate tool calls
      if (chunk.toolCalls) {
        accumulatedToolCalls = [...accumulatedToolCalls, ...chunk.toolCalls];
      }
      
      // Yield the chunk
      yield {
        content: chunk.content || '',
        toolCalls: chunk.toolCalls || [],
        usage: chunk.usage
      };
    }
    
    // Create final response
    const finalResponse: LLMResponse = {
      content: accumulatedContent,
      toolCalls: accumulatedToolCalls,
      usage: stream.getUsage()
    };
    
    // Add response to session
    session.addResponse(finalResponse);
  }

  async *streamThoughts(session: Session, message: InboundMessage): AsyncGenerator<string> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Create a streaming response
    const stream = this.llm.stream(messages);
    
    let accumulatedContent = '';
    let inThought = false;
    let thoughtStart = 0;
    
    for await (const chunk of stream) {
      if (chunk.content) {
        accumulatedContent += chunk.content;
        
        // Extract thoughts (between <thought> tags)
        const thoughtMatch = accumulatedContent.match(/<thought>(.*?)<\/thought>/s);
        if (thoughtMatch && !inThought) {
          inThought = true;
          thoughtStart = accumulatedContent.indexOf('<thought>') + 8;
        } else if (inThought && accumulatedContent.includes('</thought>')) {
          inThought = false;
          const thoughtEnd = accumulatedContent.indexOf('</thought>');
          const thought = accumulatedContent.slice(thoughtStart, thoughtEnd);
          yield thought;
          accumulatedContent = accumulatedContent.slice(thoughtEnd + 9);
        }
      }
    }
  }

  async reconstructToolCalls(session: Session, message: InboundMessage): Promise<any[]> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Get the complete response
    const response = await this.llm.complete(messages);
    
    // Add response to session
    session.addResponse(response);
    
    return response.toolCalls || [];
  }
}
