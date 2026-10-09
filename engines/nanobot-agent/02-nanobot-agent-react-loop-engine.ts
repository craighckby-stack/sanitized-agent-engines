/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Nanobot Autonomous Agent Framework Engine — ReAct Agent Loop
 * Source Origin: HKUDS/nanobot
 */

import { AgentContext } from './context';
import { ToolRegistry } from './tools';
import { LLMRuntime } from './llm-runtime';
import { Session } from '../session';
import { InboundMessage, OutboundMessage } from '../bus/events';
import { AgentHookContext, AgentTurnHookContext } from './hook';

export class NanobotAgentLoopEngine {
  private maxTurns: number;
  private context: AgentContext;
  private tools: ToolRegistry;
  private llm: LLMRuntime;

  constructor(
    maxTurns: number = 20,
    context: AgentContext,
    tools: ToolRegistry,
    llm: LLMRuntime
  ) {
    this.maxTurns = maxTurns;
    this.context = context;
    this.tools = tools;
    this.llm = llm;
  }

  async run(session: Session, message: InboundMessage): Promise<OutboundMessage> {
    let turnCount = 0;
    let currentMessage = message;
    let response: OutboundMessage | null = null;
    
    while (turnCount < this.maxTurns && !response) {
      turnCount++;
      
      // Run turn hooks
      const hookContext: AgentTurnHookContext = {
        session,
        message: currentMessage,
        turnCount,
        maxTurns: this.maxTurns
      };
      
      await this.context.runHook('beforeTurn', hookContext);
      
      // Process the message
      response = await this.processTurn(session, currentMessage);
      
      // Run post-turn hooks
      await this.context.runHook('afterTurn', {
        ...hookContext,
        response
      });
      
      // If no response yet, continue with assistant's response
      if (!response && turnCount < this.maxTurns) {
        currentMessage = this.createAssistantMessage(session);
      }
    }
    
    if (!response) {
      throw new Error(`Agent loop exceeded maximum turns (${this.maxTurns})`);
    }
    
    return response;
  }

  private async processTurn(session: Session, message: InboundMessage): Promise<OutboundMessage | null> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Get model response
    const response = await this.llm.complete(messages);
    
    // Handle tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = [];
      
      for (const toolCall of response.toolCalls) {
        const tool = this.tools.get(toolCall.name);
        if (tool) {
          const result = await tool.execute(toolCall.arguments);
          toolResults.push({
            toolCallId: toolCall.id,
            result
          });
        }
      }
      
      // Add tool results to session
      session.addToolResults(toolResults);
      
      // Return null to indicate we need another turn
      return null;
    }
    
    // Return the assistant's response
    return {
      content: response.content,
      role: 'assistant',
      timestamp: Date.now()
    };
  }

  private createAssistantMessage(session: Session): InboundMessage {
    return {
      content: '',
      role: 'assistant',
      timestamp: Date.now(),
      sessionKey: session.key
    };
  }
}
