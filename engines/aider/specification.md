This document details the core runtime engines powering a sophisticated AI code assistance system, meticulously extracted and sanitized from an open-source repository. Each engine is described by its specific function, inputs, state management, invariant preservation, and outputs, followed by its complete, pristine implementation in TypeScript. All proprietary names and branding have been replaced with generic terms to maintain neutrality and focus on architectural components.

---

## Engine 1: AiderRuntimeEngine Orchestrator

### What it does
The AiderRuntimeEngine Orchestrator is the central control unit for the entire AI coding session. It manages the interaction loop between the user, the AI coding engine, the conversation engine, and the repository synchronization engine. It's responsible for:
1.  **Session Initialization:** Setting up the environment, loading initial files, and preparing the chat history.
2.  **User Interaction:** Prompting the user for input, parsing commands, and incorporating user messages into the conversation.
3.  **AI Invocation:** Delegating code generation tasks to the `UnifiedDiffCodingEngine` based on user input and current context.
4.  **Change Application:** Receiving AI-generated diffs and instructing the `RepositorySyncEngine` to apply them to the file system.
5.  **State Management:** Maintaining the overall session flow, tracking the conversation, and managing the active files.
6.  **Error Handling:** Catching and reporting issues during AI generation, diff application, or user interaction.

**Inputs:** Initial project path, list of files to work on, user input (chat messages, commands).
**State lifecycle:** Initializes a `ChatHistoryEngine` and `RepositorySyncEngine`. Enters a continuous loop, processing user input, invoking AI, applying changes, and updating the session state.
**Invariant preservation:** Ensures the conversation history remains consistent, file changes are tracked and applied through the `RepositorySyncEngine`, and the user is always presented with a coherent session state.
**Outputs:** Modified files in the project, console output for user interaction, AI responses, and potential error messages.

### Implementation Code

```typescript
import { UnifiedDiffCodingEngine, DiffResult } from './UnifiedDiffCodingEngine';
import { ChatHistoryEngine, Message } from './ChatHistoryEngine';
import { RepositorySyncEngine, FileChange } from './RepositorySyncEngine';
import { LLMConnectorEngine } from './LLMConnectorEngine';

/**
 * Represents the available roles in a conversation.
 */
export type Role = 'system' | 'user' | 'assistant';

/**
 * Defines a simple logger interface for console output.
 */
interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Defines an interface for user input handling.
 */
interface InputHandler {
  getLine(prompt: string): Promise<string | null>;
  close(): void;
}

/**
 * Command structure.
 */
interface Command {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<void>;
}

/**
 * The AiderRuntimeEngine Orchestrator manages the AI coding session.
 */
export class AiderRuntimeEngineOrchestrator {
  private chatHistory: ChatHistoryEngine;
  private codingEngine: UnifiedDiffCodingEngine;
  private repoSyncEngine: RepositorySyncEngine;
  private logger: Logger;
  private inputHandler: InputHandler;
  private currentFiles: Set<string>;
  private isRunning: boolean;
  private commands: Map<string, Command>;

  constructor(
    projectPath: string,
    initialFiles: string[],
    llmConnector: LLMConnectorEngine,
    logger: Logger,
    inputHandler: InputHandler,
  ) {
    this.repoSyncEngine = new RepositorySyncEngine(projectPath, logger);
    this.chatHistory = new ChatHistoryEngine();
    this.codingEngine = new UnifiedDiffCodingEngine(llmConnector, logger);
    this.logger = logger;
    this.inputHandler = inputHandler;
    this.currentFiles = new Set(initialFiles);
    this.isRunning = false;
    this.commands = new Map<string, Command>();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.commands.set('/add', {
      name: '/add <file>',
      description: 'Add a file to the current session.',
      execute: async (args: string[]) => {
        if (args.length === 0) {
          this.logger.warn('Usage: /add <file_path>');
          return;
        }
        const filePath = args[0];
        if (await this.repoSyncEngine.fileExists(filePath)) {
          this.currentFiles.add(filePath);
          this.logger.log(`Added file: ${filePath}`);
        } else {
          this.logger.error(`File not found: ${filePath}`);
        }
      },
    });

    this.commands.set('/drop', {
      name: '/drop <file>',
      description: 'Remove a file from the current session.',
      execute: async (args: string[]) => {
        if (args.length === 0) {
          this.logger.warn('Usage: /drop <file_path>');
          return;
        }
        const filePath = args[0];
        if (this.currentFiles.has(filePath)) {
          this.currentFiles.delete(filePath);
          this.logger.log(`Dropped file: ${filePath}`);
        } else {
          this.logger.warn(`File not in session: ${filePath}`);
        }
      },
    });

    this.commands.set('/files', {
      name: '/files',
      description: 'List files in the current session.',
      execute: async () => {
        this.logger.log('Current files in session:');
        if (this.currentFiles.size === 0) {
          this.logger.log('  (No files currently)');
        } else {
          this.currentFiles.forEach(file => this.logger.log(`  - ${file}`));
        }
      },
    });

    this.commands.set('/undo', {
      name: '/undo',
      description: 'Undo the last commit (if any).',
      execute: async () => {
        try {
          await this.repoSyncEngine.undoLastCommit();
          this.logger.log('Last commit undone successfully.');
        } catch (error: any) {
          this.logger.error(`Failed to undo last commit: ${error.message}`);
        }
      },
    });

    this.commands.set('/help', {
      name: '/help',
      description: 'Show available commands.',
      execute: async () => {
        this.logger.log('Available commands:');
        this.commands.forEach(cmd => {
          this.logger.log(`  ${cmd.name}: ${cmd.description}`);
        });
      },
    });

    this.commands.set('/quit', {
      name: '/quit',
      description: 'Exit the AiderRuntimeEngine session.',
      execute: async () => {
        this.logger.log('Exiting AiderRuntimeEngine session.');
        this.isRunning = false;
      },
    });
  }

  /**
   * Initializes the session by loading file contents and setting up system messages.
   */
  public async initializeSession(): Promise<void> {
    try {
      await this.repoSyncEngine.initialize();
      this.chatHistory.addMessage('system', 'You are an AI assistant that helps with code modifications. You communicate using unified diff format.');

      const fileContents: { path: string, content: string }[] = [];
      for (const filePath of this.currentFiles) {
        try {
          const content = await this.repoSyncEngine.readFile(filePath);
          fileContents.push({ path: filePath, content });
        } catch (error: any) {
          this.logger.warn(`Could not read file ${filePath}: ${error.message}. Skipping.`);
          this.currentFiles.delete(filePath); // Remove problematic file
        }
      }

      if (fileContents.length > 0) {
        const fileContext = fileContents.map(f => `--- ${f.path}\n${f.content}`).join('\n\n');
        this.chatHistory.addMessage('system', `Here are the files you are currently working on:\n\n${fileContext}`);
      } else {
        this.logger.warn('No files loaded into the session.');
      }

      this.logger.log('AiderRuntimeEngine session initialized. Type /help for commands, or start chatting.');
    } catch (error: any) {
      this.logger.error(`Session initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Runs the main interaction loop of the AI assistant.
   */
  public async run(): Promise<void> {
    this.isRunning = true;
    while (this.isRunning) {
      const userInput = await this.inputHandler.getLine('> ');

      if (userInput === null) {
        this.logger.log('End of input, exiting.');
        this.isRunning = false;
        break;
      }

      if (userInput.trim() === '') {
        continue; // Don't process empty input
      }

      if (userInput.startsWith('/')) {
        await this.handleCommand(userInput);
        if (!this.isRunning) break; // Exit if /quit was called
        continue;
      }

      this.chatHistory.addMessage('user', userInput);
      this.logger.log('Thinking...');

      try {
        const currentFileContents = new Map<string, string>();
        for (const filePath of this.currentFiles) {
          const content = await this.repoSyncEngine.readFile(filePath);
          currentFileContents.set(filePath, content);
        }

        const diffResult = await this.codingEngine.generateCodeDiff(
          Array.from(this.chatHistory.getMessages()),
          currentFileContents
        );

        if (diffResult.diff) {
          this.logger.log('AI proposed changes:');
          this.logger.log(diffResult.diff);

          const changes = await this.repoSyncEngine.applyUnifiedDiff(diffResult.diff);

          if (changes.length > 0) {
            const affectedFiles = new Set(changes.map(c => c.filePath));
            const changeDescription = changes.map(c => `${c.type} ${c.filePath}`).join(', ');
            this.logger.log(`Applied changes to: ${Array.from(affectedFiles).join(', ')}`);

            const commitMessage = `AiderRuntimeEngine: ${userInput.split('\n')[0].substring(0, 50)}...`;
            await this.repoSyncEngine.commitChanges(commitMessage);
            this.logger.log('Changes committed to repository.');

            this.chatHistory.addMessage('assistant', `Applied changes to ${changeDescription}.`);
          } else {
            this.logger.log('No actual file changes resulted from the diff.');
            this.chatHistory.addMessage('assistant', 'I could not apply any changes based on your request.');
          }

          if (diffResult.followUpMessage) {
            this.chatHistory.addMessage('assistant', diffResult.followUpMessage);
            this.logger.log(`AI: ${diffResult.followUpMessage}`);
          }
        } else {
          this.logger.log('AI did not propose any code changes.');
          this.chatHistory.addMessage('assistant', 'I did not propose any code changes for this request.');
        }
      } catch (error: any) {
        this.logger.error(`An error occurred during AI processing: ${error.message}`);
        this.chatHistory.addMessage('assistant', `An error occurred: ${error.message}. Please try again or refine your request.`);
      }
    }
    this.inputHandler.close();
    this.logger.log('AiderRuntimeEngine session ended.');
  }

  private async handleCommand(commandLine: string): Promise<void> {
    const parts = commandLine.trim().split(/\s+/);
    const cmdName = parts[0];
    const args = parts.slice(1);

    const command = this.commands.get(cmdName);
    if (command) {
      await command.execute(args);
    } else {
      this.logger.warn(`Unknown command: ${cmdName}. Type /help for a list of commands.`);
    }
  }
}

// Minimal Logger implementation for example
class ConsoleLogger implements Logger {
  log(message: string): void { console.log(message); }
  error(message: string): void { console.error(`ERROR: ${message}`); }
  warn(message: string): void { console.warn(`WARN: ${message}`); }
}

// Minimal InputHandler implementation for example
import * as readline from 'readline';

class ConsoleInputHandler implements InputHandler {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  getLine(prompt: string): Promise<string | null> {
    return new Promise(resolve => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  close(): void {
    this.rl.close();
  }
}
```

---

## Engine 2: UnifiedDiffCodingEngine

### What it does
The UnifiedDiffCodingEngine is responsible for the core AI reasoning around code modifications. It specializes in generating and interpreting code changes in the standard "unified diff" format. This engine acts as an intermediary between the `AiderRuntimeEngineOrchestrator` and the `LLMConnectorEngine`. Its primary functions include:
1.  **Prompt Construction:** Formulating detailed instructions and context (including current file contents and conversation history) into a prompt suitable for an LLM to generate a unified diff.
2.  **LLM Interaction:** Sending the constructed prompt to the `LLMConnectorEngine` and receiving the AI's raw text response.
3.  **Diff Parsing & Validation:** Attempting to extract a valid unified diff from the LLM's response. It may include mechanisms to detect and correct common LLM output errors or re-prompt the LLM if the diff is malformed.
4.  **Follow-up Messages:** Extracting any natural language follow-up messages from the LLM's response that are intended for the user.

**Inputs:** A list of `Message` objects representing the conversation history, and a map of current file paths to their contents.
**State lifecycle:** Largely stateless per interaction. Each call to `generateCodeDiff` is a self-contained operation.
**Invariant preservation:** Aims to ensure that any `diff` returned is in a syntactically correct unified diff format, although actual applicability is validated by the `RepositorySyncEngine`.
**Outputs:** A `DiffResult` object containing the generated unified diff string (if successful) and any accompanying natural language follow-up message from the AI.

### Implementation Code

```typescript
import { LLMConnectorEngine, LLMMessage, LLMResponse } from './LLMConnectorEngine';
import { Message } from './ChatHistoryEngine'; // Re-using Message type from ChatHistoryEngine

/**
 * Defines the structure for the AI's diff generation result.
 */
export interface DiffResult {
  diff: string | null;
  followUpMessage: string | null;
}

/**
 * Defines a simple logger interface for console output.
 */
interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * The UnifiedDiffCodingEngine generates and parses unified diffs from LLM responses.
 */
export class UnifiedDiffCodingEngine {
  private llmConnector: LLMConnectorEngine;
  private logger: Logger;
  private maxAttempts: number = 3; // Maximum attempts to get a valid diff

  constructor(llmConnector: LLMConnectorEngine, logger: Logger) {
    this.llmConnector = llmConnector;
    this.logger = logger;
  }

  /**
   * Generates a code diff based on conversation history and current file contents.
   * @param chatHistory The list of messages in the conversation.
   * @param currentFileContents A map of file paths to their current contents.
   * @returns A DiffResult containing the generated diff and any follow-up message.
   */
  public async generateCodeDiff(
    chatHistory: Message[],
    currentFileContents: Map<string, string>,
  ): Promise<DiffResult> {
    let attempts = 0;
    while (attempts < this.maxAttempts) {
      attempts++;
      try {
        const promptMessages = this.constructPrompt(chatHistory, currentFileContents);
        const llmResponse = await this.llmConnector.completeChat(promptMessages);

        return this.parseLLMResponseForDiff(llmResponse.content);
      } catch (error: any) {
        this.logger.error(`Error during diff generation attempt ${attempts}: ${error.message}`);
        if (attempts >= this.maxAttempts) {
          throw new Error(`Failed to generate a valid diff after ${this.maxAttempts} attempts: ${error.message}`);
        }
        // Potentially add a message to chatHistory about retrying or self-correction
      }
    }
    return { diff: null, followUpMessage: 'I encountered an issue and could not generate a diff.' };
  }

  /**
   * Constructs the LLM prompt from the conversation history and file contents.
   * @param chatHistory The conversation messages.
   * @param currentFileContents The current contents of relevant files.
   * @returns A list of LLMMessage objects ready for the LLM.
   */
  private constructPrompt(
    chatHistory: Message[],
    currentFileContents: Map<string, string>,
  ): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];

    // System message to guide the LLM
    llmMessages.push({
      role: 'system',
      content:
        'You are an expert AI software engineer. ' +
        'You will be provided with a conversation history, user instructions, and relevant file contents. ' +
        'Your task is to propose code changes in a unified diff format. ' +
        'Strictly output only the unified diff. If you need to explain something, output the explanation *before* the diff, enclosed in triple backticks, and ensure the diff itself starts with `---` and ends with `+++` lines. ' +
        'If no changes are needed, output a single line: "No changes requested."\n' +
        'Example diff format:\n' +
        '```\n' +
        '```explanation\n' +
        'The user asked to fix a typo in the main function. I will correct "helol" to "hello".\n' +
        '```\n' +
        '--- a/src/main.ts\n' +
        '+++ b/src/main.ts\n' +
        '@@ -1,4 +1,4 @@\n' +
        ' function main() {\n' +
        '-  console.log("helol world");\n' +
        '+  console.log("hello world");\n' +
        ' }\n' +
        '```'
    });

    // Add current file contents as context
    if (currentFileContents.size > 0) {
      let fileContext = 'Current file contents:\n';
      currentFileContents.forEach((content, path) => {
        fileContext += `--- ${path}\n${content}\n`;
      });
      llmMessages.push({ role: 'system', content: fileContext });
    }

    // Convert chat history to LLMMessage format
    chatHistory.forEach(msg => {
      llmMessages.push({ role: msg.role as 'user' | 'assistant' | 'system', content: msg.content });
    });

    return llmMessages;
  }

  /**
   * Parses the raw LLM response to extract the diff and any follow-up message.
   * @param llmOutput The raw text output from the LLM.
   * @returns A DiffResult object.
   */
  private parseLLMResponseForDiff(llmOutput: string): DiffResult {
    const diffMarkerStart = '```diff\n'; // Common for some LLMs
    const diffMarkerStartFallback = '--- '; // Standard diff start

    let diffContent: string | null = null;
    let followUpMessage: string | null = null;
    let explanationBlock: string | null = null;

    // First, try to find a fenced code block with explanation
    const explanationBlockRegex = /```explanation\n([\s\S]*?)\n```\n*/;
    const explanationMatch = llmOutput.match(explanationBlockRegex);
    if (explanationMatch) {
      explanationBlock = explanationMatch[1].trim();
      llmOutput = llmOutput.replace(explanationMatch[0], '').trim(); // Remove explanation block from original output
    }

    // Try to find a fenced diff block (```diff ... ``` or just ``` ... ```)
    const fencedCodeBlockRegex = /```(?:diff)?\n([\s\S]*?)\n```/;
    const fencedMatch = llmOutput.match(fencedCodeBlockRegex);

    if (fencedMatch) {
      diffContent = fencedMatch[1].trim();
      // If there was an explanation, it's the follow-up
      followUpMessage = explanationBlock;
    } else {
      // If no fenced block, look for a diff starting with '--- '
      const diffStartIndex = llmOutput.indexOf(diffMarkerStartFallback);
      if (diffStartIndex !== -1) {
        diffContent = llmOutput.substring(diffStartIndex).trim();
        // The part before the diff is the follow-up
        const potentialFollowUp = llmOutput.substring(0, diffStartIndex).trim();
        if (potentialFollowUp) {
          followUpMessage = potentialFollowUp;
        }
      }
    }

    // Clean up diff content if found
    if (diffContent) {
      // Ensure the diff starts with '--- '
      if (!diffContent.startsWith(diffMarkerStartFallback)) {
        this.logger.warn('AI-generated diff does not start with "--- ". Attempting to find it.');
        const trueDiffStart = diffContent.indexOf(diffMarkerStartFallback);
        if (trueDiffStart !== -1) {
          diffContent = diffContent.substring(trueDiffStart);
        } else {
          diffContent = null; // Malformed diff, cannot recover
          this.logger.error('Could not find a valid diff start within the AI output.');
        }
      }
    }

    if (diffContent === 'No changes requested.') {
        return { diff: null, followUpMessage: followUpMessage || 'No changes were requested or generated.' };
    }

    return { diff: diffContent, followUpMessage: followUpMessage };
  }
}
```

---

## Engine 3: LLMConnectorEngine

### What it does
The LLMConnectorEngine serves as an abstraction layer for interacting with Large Language Models (LLMs). Its primary responsibilities include:
1.  **API Integration:** Handling the communication with various LLM APIs (e.g., OpenAI, custom endpoints).
2.  **Request Formatting:** Converting generic chat messages into the specific payload format required by the chosen LLM API.
3.  **Response Parsing:** Extracting the AI's message content and any associated metadata (like token usage) from the raw API response.
4.  **Configuration Management:** Managing API keys, model names, temperature, and other LLM-specific parameters.
5.  **Error Handling & Retries:** Implementing robust error handling for API failures, including retry mechanisms with exponential backoff.
6.  **Token Counting (Optional):** Providing estimates or actual counts of tokens used in requests and responses.

**Inputs:** A list of `LLMMessage` objects, model name, optional generation parameters (temperature, max tokens).
**State lifecycle:** Can be stateless for individual requests, but holds configuration like API keys and default model parameters.
**Invariant preservation:** Ensures that API requests are well-formed, authenticated, and that responses are consistently parsed.
**Outputs:** An `LLMResponse` object containing the AI's message content and token usage statistics.

### Implementation Code

```typescript
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Defines a simple logger interface for console output.
 */
interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Represents a single message in the LLM conversation context.
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * Represents the response received from the LLM.
 */
export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Configuration options for the LLMConnectorEngine.
 */
export interface LLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  retries?: number;
  timeout?: number;
}

/**
 * The LLMConnectorEngine provides an interface for interacting with Large Language Models.
 */
export class LLMConnectorEngine {
  private openai: OpenAI;
  private config: Required<LLMConfig>;
  private logger: Logger;

  constructor(config: LLMConfig, logger: Logger) {
    if (!config.apiKey) {
      throw new Error('LLMConnectorEngine requires an API key.');
    }

    this.config = {
      ...config,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      baseUrl: config.baseUrl ?? 'https://api.openai.com/v1',
      retries: config.retries ?? 3,
      timeout: config.timeout ?? 60 * 1000, // 60 seconds
    };

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
    });
    this.logger = logger;
  }

  /**
   * Sends a list of messages to the LLM and retrieves a chat completion.
   * Implements retry logic for transient errors.
   * @param messages The conversation history and prompt messages.
   * @returns An LLMResponse object.
   */
  public async completeChat(messages: LLMMessage[]): Promise<LLMResponse> {
    let attempts = 0;
    while (attempts < this.config.retries) {
      attempts++;
      try {
        const chatMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: chatMessages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        });

        const choice = response.choices[0];
        if (!choice || !choice.message || !choice.message.content) {
          throw new Error('LLM response did not contain valid content.');
        }

        return {
          content: choice.message.content,
          usage: response.usage ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          } : undefined,
        };
      } catch (error: any) {
        this.logger.error(`LLM API call failed (attempt ${attempts}/${this.config.retries}): ${error.message}`);

        // Implement exponential backoff
        const delay = Math.pow(2, attempts) * 1000; // 1s, 2s, 4s, ...
        await new Promise(res => setTimeout(res, delay));

        if (attempts >= this.config.retries) {
          throw new Error(`Failed to complete LLM chat after ${this.config.retries} attempts: ${error.message}`);
        }
      }
    }
    // Should not reach here if retries > 0, but for type safety
    throw new Error('Unexpected error: LLM chat completion failed without reaching retry limit logic.');
  }

  /**
   * Estimates the token count for a list of messages (simplified).
   * Note: A more accurate implementation would use a proper tokenizer like `tiktoken`.
   * This is a placeholder for conceptual completeness.
   * @param messages The messages to count tokens for.
   * @returns An estimated token count.
   */
  public estimateTokenCount(messages: LLMMessage[]): number {
    let count = 0;
    for (const msg of messages) {
      // Basic estimation: ~4 chars per token for English text + some overhead per message
      count += msg.content.length / 4 + 4; // +4 for role/structure overhead
    }
    return Math.floor(count);
  }
}
```

---

## Engine 4: ChatHistoryEngine

### What it does
The ChatHistoryEngine is responsible for managing the complete conversation history between the user and the AI. It acts as the canonical source of truth for all messages exchanged during a session. Its functions include:
1.  **Message Storage:** Persisting incoming messages, associating them with a role (system, user, assistant).
2.  **Context Building:** Providing a chronological list of messages suitable for submission to an LLM.
3.  **Role Management:** Ensuring messages are correctly attributed to their sender role.
4.  **Context Window Management (Optional):** In more advanced scenarios, this engine might implement strategies to prune or summarize older messages to fit within an LLM's context window. For this basic implementation, it simply stores all messages.

**Inputs:** New messages with their content and role.
**State lifecycle:** Initializes as an empty list of messages, then accumulates messages as the conversation progresses.
**Invariant preservation:** Maintains the chronological order of messages and correctly assigns roles to each message.
**Outputs:** An ordered list of `Message` objects representing the current conversation history.

### Implementation Code

```typescript
/**
 * Represents a single message in the conversation history.
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * The ChatHistoryEngine manages the chronological history of the conversation.
 */
export class ChatHistoryEngine {
  private messages: Message[];

  constructor() {
    this.messages = [];
  }

  /**
   * Adds a new message to the conversation history.
   * @param role The role of the sender ('system', 'user', or 'assistant').
   * @param content The text content of the message.
   */
  public addMessage(role: 'system' | 'user' | 'assistant', content: string): void {
    if (!['system', 'user', 'assistant'].includes(role)) {
      throw new Error(`Invalid message role: ${role}`);
    }
    if (!content || content.trim() === '') {
      // Optionally, throw an error or log a warning for empty messages
      return;
    }
    this.messages.push({ role, content, timestamp: new Date() });
  }

  /**
   * Retrieves the current conversation history.
   * The returned array is a shallow copy to prevent external modification of the internal state.
   * @returns An array of Message objects.
   */
  public getMessages(): Message[] {
    return [...this.messages]; // Return a shallow copy
  }

  /**
   * Clears the entire conversation history.
   */
  public clearHistory(): void {
    this.messages = [];
  }

  /**
   * Retrieves the last message added to the history, if any.
   * @returns The last Message object or null if history is empty.
   */
  public getLastMessage(): Message | null {
    if (this.messages.length === 0) {
      return null;
    }
    return this.messages[this.messages.length - 1];
  }

  /**
   * Gets the number of messages in the history.
   * @returns The total number of messages.
   */
  public getMessageCount(): number {
    return this.messages.length;
  }
}
```

---

## Engine 5: RepositorySyncEngine

### What it does
The RepositorySyncEngine manages all interactions with the local file system and the Git version control system within the project directory. It ensures that the AI operates on a consistent and version-controlled view of the code. Its key responsibilities include:
1.  **File System Operations:** Reading, writing, and deleting files.
2.  **Diff Application:** Interpreting and applying unified diffs to the local file system, ensuring correct line changes, additions, and deletions.
3.  **Git Integration:** Performing Git commands such as staging changes, committing, and reverting/undoing commits.
4.  **State Tracking:** Monitoring the project directory for changes and reporting relevant file information.
5.  **Path Resolution:** Ensuring all file paths are handled correctly relative to the project root.

**Inputs:** Project root path, file paths, file contents, unified diff strings, commit messages.
**State lifecycle:** Initializes with a project path, tracks modified files internally, and uses Git for persistent state changes.
**Invariant preservation:** Ensures that file system operations are robust, Git repository integrity is maintained, and diffs are applied accurately. If a diff fails to apply cleanly, it should report an error and ideally revert to a stable state.
**Outputs:** Read file contents, success/failure of file write/diff application, Git commit success/failure.

### Implementation Code

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Defines a simple logger interface for console output.
 */
interface Logger {
  log(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}

/**
 * Represents a change applied to a file.
 */
export interface FileChange {
  type: 'added' | 'modified' | 'deleted';
  filePath: string;
}

/**
 * The RepositorySyncEngine manages file system and Git operations.
 */
export class RepositorySyncEngine {
  private projectRoot: string;
  private logger: Logger;

  constructor(projectRoot: string, logger: Logger) {
    this.projectRoot = path.resolve(projectRoot);
    this.logger = logger;
  }

  /**
   * Initializes the repository engine, ensuring the project path exists and is a Git repo.
   */
  public async initialize(): Promise<void> {
    try {
      await fs.access(this.projectRoot);
      this.logger.log(`Working in project root: ${this.projectRoot}`);

      // Check if it's a Git repository, initialize if not
      try {
        await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.projectRoot });
        this.logger.log('Git repository detected.');
      } catch (error) {
        this.logger.warn('No Git repository detected. Initializing a new one.');
        await execAsync('git init', { cwd: this.projectRoot });
        await execAsync('git config user.name "AiderRuntimeEngine"', { cwd: this.projectRoot });
        await execAsync('git config user.email "runtime-engine@example.com"', { cwd: this.projectRoot });
        this.logger.log('New Git repository initialized.');
      }
    } catch (error: any) {
      throw new Error(`Project root directory "${this.projectRoot}" does not exist or is inaccessible: ${error.message}`);
    }
  }

  /**
   * Reads the content of a file.
   * @param filePath The path to the file, relative to the project root.
   * @returns The content of the file as a string.
   */
  public async readFile(filePath: string): Promise<string> {
    const absolutePath = path.join(this.projectRoot, filePath);
    try {
      return await fs.readFile(absolutePath, 'utf8');
    } catch (error: any) {
      throw new Error(`Failed to read file "${filePath}": ${error.message}`);
    }
  }

  /**
   * Writes content to a file. Creates the file and parent directories if they don't exist.
   * @param filePath The path to the file, relative to the project root.
   * @param content The content to write.
   */
  public async writeFile(filePath: string, content: string): Promise<void> {
    const absolutePath = path.join(this.projectRoot, filePath);
    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf8');
    } catch (error: any) {
      throw new Error(`Failed to write file "${filePath}": ${error.message}`);
    }
  }

  /**
   * Checks if a file exists.
   * @param filePath The path to the file, relative to the project root.
   * @returns True if the file exists, false otherwise.
   */
  public async fileExists(filePath: string): Promise<boolean> {
    const absolutePath = path.join(this.projectRoot, filePath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Applies a unified diff string to the repository.
   * Uses `git apply` for robust diff application.
   * @param diffContent The unified diff string.
   * @returns A list of FileChange objects indicating what files were affected.
   */
  public async applyUnifiedDiff(diffContent: string): Promise<FileChange[]> {
    if (!diffContent || diffContent.trim() === '') {
      return []; // No diff content, no changes
    }

    try {
      // Temporarily write diff to a file
      const tempDiffPath = path.join(this.projectRoot, '.temp_runtime_engine_diff.diff');
      await fs.writeFile(tempDiffPath, diffContent, 'utf8');

      try {
        // Apply the diff using git apply
        const { stdout, stderr } = await execAsync(`git apply --whitespace=fix "${tempDiffPath}"`, { cwd: this.projectRoot });
        if (stderr) {
            this.logger.warn(`git apply stderr: ${stderr}`);
        }
        this.logger.log(`Diff applied successfully: ${stdout}`);

        // Clean up the temporary diff file
        await fs.unlink(tempDiffPath);

        // Determine affected files (simplified by checking git status)
        const statusOutput = await execAsync('git status --porcelain', { cwd: this.projectRoot });
        const lines = statusOutput.stdout.split('\n').filter(line => line.trim() !== '');
        const changes: FileChange[] = [];
        for (const line of lines) {
          const status = line.substring(0, 2).trim();
          const filePath = line.substring(3).trim();

          if (status === 'A') { // Added
            changes.push({ type: 'added', filePath });
          } else if (status === 'M') { // Modified
            changes.push({ type: 'modified', filePath });
          } else if (status === 'D') { // Deleted (only if applied by diff, git apply marks them for deletion)
             // `git apply` doesn't typically handle deletions directly by modifying the index.
             // We'd expect the diff to delete the file, and then `git status` would show it as 'D'.
             // For robustness, we check if the file actually exists on disk.
             if (!(await this.fileExists(filePath))) {
                changes.push({ type: 'deleted', filePath });
             } else {
                // Could be a modified file if 'D' was in index but not actually deleted on disk.
                // This scenario is rare for 'git apply' with proper diffs.
                changes.push({ type: 'modified', filePath }); // Fallback
             }
          }
        }
        return changes;
      } catch (applyError: any) {
        // Log git apply errors and try to clean up
        this.logger.error(`Failed to apply diff: ${applyError.message}`);
        await fs.unlink(tempDiffPath).catch(() => {}); // Ensure cleanup even on error
        throw new Error(`Failed to apply code changes. This might indicate an invalid diff or conflicts: ${applyError.message}`);
      }
    } catch (writeError: any) {
      throw new Error(`Failed to write temporary diff file: ${writeError.message}`);
    }
  }

  /**
   * Stages all changes in the current working directory and commits them.
   * @param message The commit message.
   */
  public async commitChanges(message: string): Promise<void> {
    try {
      // Add all changes
      await execAsync('git add .', { cwd: this.projectRoot });
      // Commit
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: this.projectRoot });
      this.logger.log(`Committed changes: ${stdout.trim()}`);
    } catch (error: any) {
      // If there's nothing to commit, git commit will throw an error
      if (error.message.includes('nothing to commit')) {
        this.logger.warn('No changes to commit.');
        return;
      }
      throw new Error(`Failed to commit changes: ${error.message}`);
    }
  }

  /**
   * Undoes the last commit and keeps the changes in the working directory (soft reset).
   */
  public async undoLastCommit(): Promise<void> {
    try {
      // Check if there are any commits
      const { stdout: logOutput } = await execAsync('git rev-parse HEAD', { cwd: this.projectRoot });
      if (!logOutput.trim()) {
        this.logger.warn('No commits to undo.');
        return;
      }

      await execAsync('git reset HEAD~1', { cwd: this.projectRoot });
      this.logger.log('Last commit has been undone. Changes are still in the working directory.');
    } catch (error: any) {
      if (error.message.includes('fatal: ambiguous argument \'HEAD~1\'')) {
        throw new Error('No previous commit to undo.');
      }
      throw new Error(`Failed to undo last commit: ${error.message}`);
    }
  }
}
```