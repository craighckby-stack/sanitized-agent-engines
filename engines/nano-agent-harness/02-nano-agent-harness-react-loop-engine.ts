/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 2: Nano Agent Harness Engine — ReAct Agent Loop
 * Source Origin: shareAI-lab/learn-claude-code
 */

export class NanoAgentLoopEngine {
  private stepCount = 0;
  private maxSteps: number;
  private messages: Message[] = [];
  
  constructor(
    private modelAdapter: ModelAdapter,
    private toolRegistry: ToolRegistry,
    private config: LoopConfig
  ) {
    this.maxSteps = config.maxSteps || 20;
  }
  
  async run(initialPrompt: string): Promise<LoopResult> {
    this.messages.push({ role: 'user', content: initialPrompt });
    
    while (this.stepCount < this.maxSteps) {
      this.stepCount++;
      
      // Get model response with available tools
      const response = await this.modelAdapter.generate(
        this.messages,
        this.toolRegistry.getToolDefinitions()
      );
      
      // Add response to message history
      this.messages.push(response.message);
      
      // Check if we should stop (no tool use)
      if (response.stopReason !== 'tool_use') {
        return {
          success: true,
          finalResponse: response.message.content,
          steps: this.stepCount,
          messages: this.messages
        };
      }
      
      // Execute tool calls
      for (const toolCall of response.toolCalls || []) {
        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          throw new Error(`Tool not found: ${toolCall.name}`);
        }
        
        const result = await tool.execute(toolCall.arguments);
        this.messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: result
        });
      }
    }
    
    return {
      success: false,
      error: 'Maximum steps exceeded',
      steps: this.stepCount,
      messages: this.messages
    };
  }
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ModelResponse {
  message: Message;
  toolCalls?: ToolCall[];
  stopReason: 'stop' | 'tool_use';
}

interface LoopResult {
  success: boolean;
  finalResponse?: string;
  error?: string;
  steps: number;
  messages: Message[];
}

interface LoopConfig {
  maxSteps?: number;
}

interface ModelAdapter {
  generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolRegistry {
  getToolDefinitions(): ToolDefinition[];
  getTool(name: string): Tool | undefined;
}

interface Tool {
  execute(args: Record<string, unknown>): Promise<string>;
}
