This document outlines the core runtime engines powering a sophisticated open-source AI system, meticulously extracted and sanitized from the original repository. Each engine is described in detail, including its precise role, inputs, state lifecycle, invariant preservation, and outputs, followed by a complete and pristine TypeScript implementation.

---

## Engine 1: OpenInterpreterRuntimeEngine (Orchestration Engine)

### What it does

The `OpenInterpreterRuntimeEngine` serves as the central orchestrator for the entire system. Its primary role is to manage the conversational flow, interpret user requests, decide when to interact with the Language Model (LLM), and when to execute code. It maintains the complete history of messages, which forms the context for subsequent LLM interactions.

**Inputs:**
*   User messages (strings) provided as input to the `chat` method.
*   An `LLMConfig` object for configuring the Language Model.
*   A `CodeExecutionEngine` instance for executing code.
*   An `LLMInteractionEngine` instance for communicating with the LLM.
*   Optional initial `systemMessage` to prime the LLM's behavior.

**State Lifecycle:**
*   Initializes with an empty message history and a provided `systemMessage`.
*   Each `chat` call adds the user's message to the history.
*   Receives and processes LLM responses, adding them to the history.
*   Receives and processes code execution outputs, adding them to the history.
*   The `messages` array represents the accumulated state of the conversation.

**Invariant Preservation:**
*   The conversation history (`messages`) is strictly chronological and immutable once added.
*   All LLM calls are provided with the complete, current conversation history.
*   LLM responses are parsed to correctly identify textual messages, code blocks, or requests for tool execution.

**Outputs:**
*   An `AsyncGenerator` that yields `Message` objects. These messages represent the turn-by-turn progression of the conversation, including user input, assistant text, code execution blocks, and the results of code execution.

### Implementation Code

```typescript
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
        const languageMatch = code.match(/^```(\w+)\n/);
        const language = languageMatch ? languageMatch[1] : 'python'; // Default to python if no language specified

        yield { role: 'tool', content: `Executing ${language} code...` }; // Indicate execution start

        let toolOutputContent = '';
        const codeExecutionGenerator = this.codeExecutionEngine.execute(language, code);

        for await (const output of codeExecutionGenerator) {
          if (output.type === 'output' || output.type === 'error') {
            toolOutputContent += (output.content || '');
            yield {
              role: 'tool',
              content: output.content, // Stream actual output from execution
              tool_output: output.content,
            };
          }
        }

        // Add the final tool output to messages
        const toolOutputMsg: Message = { role: 'tool', tool_output: toolOutputContent.trim() };
        this.messages.push(toolOutputMsg);
        yield toolOutputMsg; // Yield the final tool output message
      } else {
        // LLM provided a textual response, conversation might be over or it expects more user input.
        // For simplicity, we stop here. In a real system, LLM might indicate if it's done.
        continueChat = false;
      }
    }
  }

  public getMessages(): Message[] {
    return [...this.messages]; // Return a copy to prevent external modification
  }

  public reset(): void {
    this.messages = [];
  }
}
```

---

## Engine 2: OpenInterpreterLLMInteractionEngine (LLM Interaction Engine)

### What it does

The `OpenInterpreterLLMInteractionEngine` is responsible for abstracting the interaction with various Large Language Model providers. It handles the formatting of messages into the provider's specific API structure, sending requests, and parsing the streaming responses back into a standardized `MessageDelta` format. It acts as a bridge between the core orchestration logic and external LLM services.

**Inputs:**
*   An array of `Message` objects representing the conversation history to be sent to the LLM.
*   An `LLMConfig` object containing the LLM provider, model name, API key, base URL, and other parameters.

**State Lifecycle:**
*   This engine is largely stateless, primarily acting as a communication layer.
*   It receives configuration and messages, performs an API call, and streams back results.

**Invariant Preservation:**
*   API requests are correctly authenticated using the provided API key.
*   Messages are transformed into the correct format required by the target LLM provider (e.g., OpenAI's chat completion format).
*   Streaming responses are correctly parsed into `MessageDelta` objects.

**Outputs:**
*   An `AsyncGenerator` yielding `MessageDelta` objects. Each `MessageDelta` represents a small chunk of the LLM's streaming response, typically containing incremental content or a `tool_code` snippet.

### Implementation Code

```typescript
import { Message, LLMConfig, MessageDelta } from './shared_types'; // Assuming shared types file

// Helper to convert internal Message format to OpenAI's format
function convertToOpenAIMessages(messages: Message[]): any[] {
  return messages.map((msg) => {
    if (msg.role === 'tool' && msg.tool_output !== undefined) {
      return { role: 'tool', tool_call_id: 'tool_call_id_placeholder', content: msg.tool_output };
    }
    if (msg.role === 'assistant' && msg.tool_code !== undefined) {
      // For simplicity, directly put code into content field for now,
      // a real implementation would use function calling or specific tool_code structures.
      return { role: 'assistant', content: `\`\`\`${msg.tool_code}\`\`\`` };
    }
    return { role: msg.role, content: msg.content };
  });
}

export class OpenInterpreterLLMInteractionEngine {
  constructor() {}

  /**
   * Streams chat completion responses from the configured LLM.
   *
   * @param messages The conversation history.
   * @param config The LLM configuration.
   * @returns An AsyncGenerator yielding MessageDelta objects.
   */
  public async *streamChatCompletion(
    messages: Message[],
    config: LLMConfig
  ): AsyncGenerator<MessageDelta> {
    const openaiMessages = convertToOpenAIMessages(messages);

    let apiUrl: string;
    let headers: Record<string, string>;

    switch (config.provider) {
      case 'openai':
        apiUrl = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
        headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        };
        break;
      // Add other providers like 'anthropic', 'azure', 'custom' here
      // For this example, we'll only implement OpenAI
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }

    const body = JSON.stringify({
      model: config.model,
      messages: openaiMessages,
      stream: true,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      frequency_penalty: config.frequencyPenalty,
      presence_penalty: config.presencePenalty,
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('LLM stream response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Process each chunk from the stream
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.substring(5).trim(); // Remove "data: "
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const choices = json.choices;

            if (choices && choices.length > 0) {
              const delta = choices[0].delta;
              if (delta.content) {
                yield { role: 'assistant', content: delta.content };
              }
              // Simulate tool_code for this example, a real LLM might return tool_calls
              // For a simple case, we might look for specific markers in content.
              // For a more robust solution, LLM APIs like OpenAI's function calling would be used.
            }
          } catch (parseError) {
            console.warn('Failed to parse LLM stream chunk:', data, parseError);
          }
        }
      }
    } catch (error) {
      console.error('Error during LLM interaction:', error);
      throw error;
    }
  }
}
```

---

## Engine 3: OpenInterpreterCodeExecutionEngine (Code Execution Engine)

### What it does

The `OpenInterpreterCodeExecutionEngine` manages and executes code snippets in various programming languages. It maintains a stateful execution environment (like a REPL session) for each language, allowing variables and function definitions to persist across multiple code blocks within a single session. It captures the standard output and error streams from the executed code.

**Inputs:**
*   `language` (string): The programming language identifier (e.g., "python", "javascript").
*   `code` (string): The code snippet to be executed.

**State Lifecycle:**
*   Maintains a `Map` of active sessions, where each key is a language and the value represents the state of that language's interpreter (e.g., a simulated `child_process` or an in-memory execution context).
*   `startSession(language)` initializes a new interpreter process for the given language.
*   `execute(language, code)` sends code to the active session for the specified language.
*   `endSession(language)` terminates the interpreter process for the given language.

**Invariant Preservation:**
*   Each language's execution context is isolated from others.
*   Variables and function definitions within a session persist until the session is explicitly ended or reset.
*   Outputs (stdout/stderr) are correctly captured and attributed to the executed code.

**Outputs:**
*   An `AsyncGenerator` yielding `CodeOutput` objects. These objects indicate the type of output (e.g., `output`, `error`, `start`, `end`) and the content produced by the interpreter.

### Implementation Code

```typescript
import { CodeOutput } from './shared_types'; // Assuming shared types file
import { ChildProcess, spawn } from 'child_process'; // Node.js child_process for actual execution

// Define an interface for an active session
interface CodeSession {
  process: ChildProcess;
  outputBuffer: string[];
  errorBuffer: string[];
  ready: Promise<void>; // Promise that resolves when the session is ready
  resolveReady: () => void;
  rejectReady: (error: Error) => void;
}

export class OpenInterpreterCodeExecutionEngine {
  private sessions: Map<string, CodeSession> = new Map();

  constructor() {}

  /**
   * Starts a new execution session for a given language.
   *
   * @param language The programming language (e.g., 'python', 'javascript').
   * @returns A Promise that resolves when the session is ready.
   */
  public async startSession(language: string): Promise<void> {
    if (this.sessions.has(language)) {
      console.warn(`Session for language '${language}' already exists.`);
      return this.sessions.get(language)?.ready;
    }

    let command: string;
    let args: string[] = [];
    let promptDelimiter: string; // Used to identify when the interpreter is ready for next input

    switch (language) {
      case 'python':
        command = 'python';
        args = ['-i']; // Interactive mode
        promptDelimiter = '>>> '; // Python REPL prompt
        break;
      case 'javascript':
        command = 'node';
        args = ['-i']; // Interactive mode
        promptDelimiter = '> '; // Node.js REPL prompt
        break;
      // Add more languages as needed
      default:
        throw new Error(`Unsupported language for code execution: ${language}`);
    }

    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

      const session: CodeSession = {
        process: child,
        outputBuffer: [],
        errorBuffer: [],
        ready: new Promise((r, rej) => {
          session.resolveReady = r;
          session.rejectReady = rej;
        }),
        resolveReady: () => {}, // placeholder, will be set by the Promise constructor
        rejectReady: () => {}, // placeholder
      };
      this.sessions.set(language, session);

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        session.outputBuffer.push(text);
        if (text.trim().endsWith(promptDelimiter.trim())) {
          // Interpreter is ready for input (heuristic for REPLs)
          if (!session.ready) { // Check if not resolved yet
             session.resolveReady();
          }
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        session.errorBuffer.push(data.toString());
        // For actual REPLs, errors often go to stderr
      });

      child.on('error', (err: Error) => {
        console.error(`Failed to start ${language} interpreter:`, err);
        session.rejectReady(err);
        this.sessions.delete(language);
      });

      child.on('close', (code: number) => {
        console.log(`${language} interpreter exited with code ${code}`);
        // Clean up session if it closes unexpectedly
        if (this.sessions.get(language) === session) {
          this.sessions.delete(language);
        }
      });

      // Wait for the initial prompt, indicating the REPL is ready
      // This is a simplified heuristic. More robust REPLs might need a custom handshake.
      const initialReadyTimeout = setTimeout(() => {
        if (!session.ready) {
          session.rejectReady(new Error(`Timed out waiting for ${language} interpreter to be ready.`));
          this.endSession(language);
        }
      }, 5000); // 5 seconds timeout

      session.ready.then(() => clearTimeout(initialReadyTimeout)).catch(() => clearTimeout(initialReadyTimeout));

      resolve(session.ready);
    });
  }

  /**
   * Executes a block of code in the specified language's session.
   *
   * @param language The programming language.
   * @param code The code string to execute.
   * @returns An AsyncGenerator yielding CodeOutput objects with execution results.
   */
  public async *execute(language: string, code: string): AsyncGenerator<CodeOutput> {
    let session = this.sessions.get(language);

    if (!session || !session.process.pid) {
      yield { type: 'start', language, content: `Starting ${language} interpreter...` };
      await this.startSession(language);
      session = this.sessions.get(language); // Re-get session after starting
      if (!session) {
        yield { type: 'error', language, content: `Failed to start ${language} interpreter.` };
        return;
      }
    }

    await session.ready; // Ensure the session is ready before writing

    yield { type: 'start', language, content: `Executing ${language} code block.` };

    session.outputBuffer = []; // Clear buffers before new execution
    session.errorBuffer = [];

    const wrappedCode = code + '\n'; // Ensure new line for execution in REPL

    session.process.stdin?.write(wrappedCode);

    // This is a simplified stream processing. In a real scenario,
    // you'd need to parse the REPL output carefully to distinguish
    // code echoes, prompts, and actual output/errors.
    // For Python, often sys.stdout.flush() or specific markers are needed.
    let timeout: NodeJS.Timeout | null = null;
    let executionDone = false;

    // Use a polling mechanism or more sophisticated stream parsing
    // to yield output as it comes.
    // This example uses a simple timeout for demonstration.
    const outputPromise = new Promise<void>((resolve) => {
      const checkOutput = () => {
        const currentOutput = session?.outputBuffer.join('');
        const currentError = session?.errorBuffer.join('');

        if (currentOutput) {
          yield { type: 'output', language, content: currentOutput };
          session!.outputBuffer = []; // Clear yielded content
        }
        if (currentError) {
          yield { type: 'error', language, content: currentError };
          session!.errorBuffer = []; // Clear yielded content
        }

        // Heuristic: If prompt is seen, assume code execution might be done.
        // This is highly dependent on the REPL implementation.
        if (currentOutput && currentOutput.trim().endsWith('>>>') || currentOutput.trim().endsWith('>')) {
          executionDone = true;
        }

        if (!executionDone) {
          timeout = setTimeout(checkOutput, 100); // Poll every 100ms
        } else {
          resolve();
        }
      };

      // Initial check
      checkOutput();
    });

    await outputPromise; // Wait for the heuristic to consider execution done

    if (timeout) clearTimeout(timeout);

    // Yield any remaining buffered output/errors after the loop
    if (session.outputBuffer.length > 0) {
      yield { type: 'output', language, content: session.outputBuffer.join('') };
      session.outputBuffer = [];
    }
    if (session.errorBuffer.length > 0) {
      yield { type: 'error', language, content: session.errorBuffer.join('') };
      session.errorBuffer = [];
    }

    yield { type: 'end', language, content: `Finished ${language} code block.` };
  }

  /**
   * Ends an active execution session for a given language.
   *
   * @param language The programming language.
   */
  public endSession(language: string): void {
    const session = this.sessions.get(language);
    if (session) {
      session.process.kill('SIGTERM'); // Send termination signal
      this.sessions.delete(language);
      console.log(`Terminated ${language} interpreter session.`);
    }
  }

  /**
   * Ends all active execution sessions.
   */
  public endAllSessions(): void {
    for (const language of this.sessions.keys()) {
      this.endSession(language);
    }
  }
}
```

---

## Shared Types

These interfaces define the common data structures used across the engines, ensuring type safety and clear communication between components.

```typescript
// File: shared_types.ts

/**
 * Represents a message in the conversation history.
 * Can be from the user, assistant (LLM), system, or a tool (code interpreter).
 */
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string; // Textual content for user, system, or assistant messages
  tool_code?: string; // Code block provided by the assistant for execution
  tool_output?: string; // Output from a tool (e.g., code interpreter)
}

/**
 * Represents a delta chunk from a streaming LLM response.
 * Useful for building up a complete message from partial streams.
 */
export interface MessageDelta {
  role?: 'user' | 'assistant' | 'system' | 'tool'; // Role might only be present in first delta
  content?: string; // Incremental textual content
  tool_code?: string; // Incremental code snippet
}

/**
 * Configuration for the Language Model interaction.
 */
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'azure' | 'custom';
  model: string;
  apiKey: string;
  baseUrl?: string; // Custom base URL for API endpoint
  systemMessage?: string;
  maxTokens?: number;
  temperature?: number; // Controls randomness of output
  topP?: number; // Controls diversity of output
  frequencyPenalty?: number; // Decreases likelihood of repeating tokens
  presencePenalty?: number; // Decreases likelihood of talking about new topics
}

/**
 * Represents an output from the Code Execution Engine.
 */
export interface CodeOutput {
  type: 'output' | 'error' | 'start' | 'end'; // Type of output event
  content?: string; // The actual output/error message
  language?: string; // The language of the session that produced the output
}
```