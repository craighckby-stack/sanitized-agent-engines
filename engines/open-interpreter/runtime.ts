import {
  Message,
  LLMConfig,
  LLMInteractionEngine,
  CodeExecutionEngine,
  CodeOutput,
  MessageDelta,
} from './shared_types'; // Assuming these are in a shared types file

export class OpenInterpreterRuntimeEngine {
  private messages: Message[];
  private llmInteractionEngine: LLMInteractionEngine;
  private codeExecutionEngine: CodeExecutionEngine;
  private llmConfig: LLMConfig;

  constructor(
    llmInteractionEngine: LLMInteractionEngine,
    codeExecutionEngine: CodeExecutionEngine,
    llmConfig: LLMConfig,
    systemMessage?: string
  ) {
    this.llmInteractionEngine = llmInteractionEngine;
    this.codeExecutionEngine = codeExecutionEngine;
    this.llmConfig = llmConfig;
    this.messages = [];
    if (systemMessage) {
      this.messages.push({ role: 'system', content: systemMessage });
    }
  }

  /**
   * Processes a user message and orchestrates the interaction between the LLM and code interpreter.
   *
   * @param userMessage The user's input message.
   * @returns An AsyncGenerator yielding Message objects representing the conversation turn-by-turn.
   */
  public async *chat(userMessage: string): AsyncGenerator<Message> {
    const userMsg: Message = { role: 'user', content: userMessage };
    this.messages.push(userMsg);
    yield userMsg; // Yield the user's message immediately

    let continueChat = true;
    while (continueChat) {
      const messagesForLLM = this.messages;

      // Stream response from LLM
      const llmResponseGenerator = this.llmInteractionEngine.streamChatCompletion(
        messagesForLLM,
        this.llmConfig
      );

      let assistantMessageContent = '';
      let assistantToolCode = '';
      let isCodeBlock = false;

      // Process LLM's streaming output
      for await (const delta of llmResponseGenerator) {
        if (delta.role === 'assistant') {
          // LLM started a new assistant message, if any previous content, yield it.
          if (assistantMessageContent || assistantToolCode) {
            const msg: Message = isCodeBlock
              ? { role: 'assistant', tool_code: assistantToolCode }
              : { role: assistantMessageContent.trim() ? 'assistant' : 'tool', content: assistantMessageContent };
            if (msg.content || msg.tool_code) {
              this.messages.push(msg);
              yield msg;
            }
            assistantMessageContent = '';
            assistantToolCode = '';
            isCodeBlock = false;
          }
        }

        if (delta.tool_code) {
          isCodeBlock = true;
          assistantToolCode += delta.tool_code;
        } else if (delta.content) {
          assistantMessageContent += delta.content;
        }

        // Yield a partial message for streaming display
        yield {
          role: 'assistant',
          content: isCodeBlock ? assistantToolCode : assistantMessageContent,
          tool_code: isCodeBlock ? assistantToolCode : undefined,
        };
      }

      // After streaming, finalize the assistant's message
      let finalAssistantMessage: Message | null = null;
      if (isCodeBlock && assistantToolCode) {
        finalAssistantMessage = { role: 'assistant', tool_code: assistantToolCode.trim() };
      } else if (assistantMessageContent) {
        finalAssistantMessage = { role: 'assistant', content: assistantMessageContent.trim() };
      }

      if (finalAssistantMessage && (finalAssistantMessage.content || finalAssistantMessage.tool_code)) {
        this.messages.push(finalAssistantMessage);
        yield finalAssistantMessage;
      }

      // Decide next action based on the LLM's final message
      if (finalAssistantMessage?.tool_code) {
        // LLM wants to execute code
        continueChat = true; // Continue the loop to get LLM's response to tool_output
        const code = finalAssistantMessage.tool_code;
        const languageMatch = code.match(/^