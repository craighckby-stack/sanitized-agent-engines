/**
 * Represents a message in the conversation or system interaction.
 * Messages can be from the user, assistant (LLM), or function calls/results.
 */
export interface IMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content?: string; // Text content for user/assistant messages, or function results.
  code?: string;    // Code block for assistant messages.
  language?: string; // Language of the code block (e.g., 'python', 'javascript', 'sh').
  name?: string;    // Name of the function/tool being called or that produced output.
}

/**
 * Configuration parameters for interacting with a Large Language Model (LLM).
 */
export interface LLMConfig {
  model?: string;
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  // Additional LLM-specific parameters can be added here.
}

/**
 * Interface for any Large Language Model (LLM) client.
 * It's responsible for sending messages to an LLM and streaming back its responses.
 */
export interface ILLMClient {
  /**
   * Requests completions from the LLM based on the provided message history.
   * @param messages The current conversation history to send to the LLM.
   * @param config LLM-specific configuration overrides for this call.
   * @returns An AsyncGenerator that yields IMessage chunks as the LLM responds.
   */
  getCompletions(messages: IMessage[], config: LLMConfig): AsyncGenerator<IMessage>;
}

/**
 * Interface for a generic code execution engine.
 * It provides methods to start, stop, and run code in a specific language environment.
 */
export interface ICodeInterpreter {
  readonly language: string; // The language this interpreter supports (e.g., 'python', 'javascript', 'sh').

  /**
   * Initializes and starts the underlying process for the code interpreter.
   */
  start(): Promise<void>;

  /**
   * Executes a given block of code within the interpreter's environment.
   * @param code The code string to execute.
   * @returns An AsyncGenerator that yields IMessage chunks representing stdout, stderr, or other outputs.
   */
  run(code: string): AsyncGenerator<IMessage>;

  /**
   * Stops and cleans up the underlying process for the code interpreter.
   */
  stop(): Promise<void>;

  /**
   * Resets the interpreter's state (e.g., clears variables, restarts the process).
   * (Optional, but often useful for stateless or fresh executions).
   */
  reset?(): Promise<void>;
}

/**
 * Configuration for the main AgenticLoopEngine.
 */
export interface OpenInterpreterRuntimeEngineConfiguration {
  llmClient: ILLMClient;
  llmConfig: LLMConfig;
  autoRunCode?: boolean; // If true, the agent automatically executes code without user confirmation.
  verbose?: boolean;     // Enable verbose logging.
  debugMode?: boolean;   // Enable debug logging.
  maxTokens?: number;    // Max tokens for LLM responses.
  maxMessageHistory?: number; // Maximum number of messages to send to the LLM to control context window.
  // Other configs specific to the orchestration.
}

// Dummy LLM Client for demonstration purposes. In a real system, this would integrate with
// an actual LLM provider (e.g., OpenAI, Anthropic, Ollama, etc.).
export class DummyLLMClient implements ILLMClient {
  private callCount = 0; // Tracks the number of calls to simulate different LLM behaviors

  async *getCompletions(messages: IMessage[], config: LLMConfig): AsyncGenerator<IMessage> {
    this.callCount++;
    console.log(`[DummyLLMClient] LLM Call ${this.callCount} with config:`, config);
    console.log(`[DummyLLMClient] Messages history:`, messages);

    // Simulate LLM thinking time
    await new Promise(resolve => setTimeout(resolve, 500));

    if (this.callCount === 1) {
      // On the first call, pretend to provide some Python code
      yield { role: 'assistant', content: 'Okay, I understand. I will use Python to achieve that.' };
      await new Promise(resolve => setTimeout(resolve, 200));
      yield {
        role: 'assistant',
        code: 'import os\nprint("Hello from dummy Python!");\nprint(f"Current directory: {os.getcwd()}")',
        language: 'python'
      };
    } else if (this.callCount === 2 && messages.some(m => m.name === 'output')) {
      // If previous message was code output, confirm and ask for next task
      yield { role: 'assistant', content: 'The Python code executed successfully. What should I do next?' };
    } else {
      // Generic response for other scenarios
      yield { role: 'assistant', content: 'I am ready for your next instruction.' };
    }
  }
}