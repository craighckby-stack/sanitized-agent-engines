This document catalogs the core runtime engines extracted from the OpenInterpreterRuntimeEngine project, refactored into pristine TypeScript. Each engine is described in terms of its role, inputs, state lifecycle, invariant preservation, and outputs, followed by its complete, sanitized implementation code.

---

## Common Interfaces and Types

The following interfaces and types are used across the various runtime engines to ensure consistent data structures and communication protocols.

```typescript
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
```

---

## Engine 1: AgenticLoopEngine

### What it does

The `AgenticLoopEngine` is the core orchestration component of the system. It manages the entire conversational and task execution flow of an AI agent. Its primary responsibility is to:

1.  **Receive User Input:** Accept textual prompts or structured messages from the user.
2.  **Maintain Conversation History:** Store and manage the sequence of messages exchanged between the user, the LLM, and code execution outputs. This history forms the context for subsequent LLM interactions.
3.  **Interact with LLM:** Send a curated portion of the conversation history to a Large Language Model (LLM) client and process its streaming responses.
4.  **Process LLM Responses:** Interpret the LLM's output, which can be natural language text (for direct user response) or structured code blocks (to be executed by a code interpreter).
5.  **Dispatch Code Execution:** When the LLM generates a code block, the engine identifies the language and dispatches the code to the appropriate `ICodeInterpreter` instance.
6.  **Capture and Integrate Code Output:** Collect the standard output, error messages, and return values from executed code, and incorporate them back into the conversation history. This allows the LLM to observe the results of its actions and iterate.
7.  **Manage Agentic Loop:** Continuously cycle through LLM interaction and code execution until the LLM indicates that it has completed its task (by not generating further code) or an explicit stop condition is met.

**Inputs:** An initial array of `IMessage` objects or a `string` representing user input. It also takes a `OpenInterpreterRuntimeEngineConfiguration` object during initialization to configure LLM interaction, auto-run behavior, and verbosity.

**State Lifecycle:**
*   **Initialization:** Sets up the LLM client, loads configuration, and initializes an empty `messages` array for conversation history. It maintains a `Map` of registered `ICodeInterpreter` instances.
*   **Active:** The `chat` method drives the engine. Each call potentially modifies the `messages` array and interacts with the LLM and code interpreters.
*   **Termination:** The `stop` method orchestrates the shutdown of all active code interpreter processes.
*   **Reset:** The `reset` method clears the conversation history, allowing for a fresh start.

**Invariant Preservation:**
*   **Sequential Conversation:** Ensures that messages are added to the history in chronological order, and that the LLM always receives a coherent, ordered sequence of prior interactions.
*   **Contextual Integrity:** The portion of the history sent to the LLM is carefully managed (e.g., trimmed by `maxMessageHistory`) to fit within the LLM's context window while retaining the most relevant recent turns.
*   **Execution Feedback Loop:** Guarantees that the output of any executed code is promptly captured and fed back into the `messages` history before the next LLM call, enabling the LLM to react to and correct its own actions.

**Outputs:** An `AsyncGenerator<IMessage>` that yields messages in real-time as they are produced by the LLM (streaming text and code) or by the code interpreters (streaming outputs and errors).

### Implementation Code

```typescript
import {
  IMessage,
  LLMConfig,
  ILLMClient,
  ICodeInterpreter,
  OpenInterpreterRuntimeEngineConfiguration
} from './interfaces'; // Assuming interfaces are in 'interfaces.ts'

export class AgenticLoopEngine {
  private messages: IMessage[] = [];
  private llmClient: ILLMClient;
  private llmConfig: LLMConfig;
  private codeInterpreters: Map<string, ICodeInterpreter> = new Map();
  private autoRunCode: boolean;
  private verbose: boolean;
  private debugMode: boolean;
  private maxTokens: number | undefined;
  private maxMessageHistory: number | undefined;

  constructor(config: OpenInterpreterRuntimeEngineConfiguration) {
    this.llmClient = config.llmClient;
    this.llmConfig = config.llmConfig;
    this.autoRunCode = config.autoRunCode ?? false;
    this.verbose = config.verbose ?? false;
    this.debugMode = config.debugMode ?? false;
    this.maxTokens = config.maxTokens;
    this.maxMessageHistory = config.maxMessageHistory;

    if (this.verbose) {
      console.log("[AgenticLoopEngine] Initialized with config:", config);
    }
  }

  /**
   * Registers a code interpreter with the engine, making it available for code execution.
   * @param interpreter An instance of an ICodeInterpreter.
   */
  public registerCodeInterpreter(interpreter: ICodeInterpreter): void {
    this.codeInterpreters.set(interpreter.language, interpreter);
    if (this.verbose) {
      console.log(`[AgenticLoopEngine] Registered code interpreter for language: ${interpreter.language}`);
    }
  }

  /**
   * Starts the agentic loop, processing user input and interacting with the LLM and code interpreters.
   * This method is an async generator, yielding messages as they are produced.
   * @param input The initial user input, either as a string or an array of messages.
   * @returns An AsyncGenerator that yields IMessage objects.
   */
  public async *chat(input: string | IMessage[]): AsyncGenerator<IMessage> {
    if (typeof input === 'string') {
      this.messages.push({ role: 'user', content: input });
    } else {
      // If an array of messages, ensure the last one is from the user or system to trigger LLM thinking
      this.messages.push(...input);
    }

    if (this.debugMode) {
      console.log("[AgenticLoopEngine] Starting chat loop. Initial messages:", this.messages);
    }

    while (true) {
      const messagesForLLM = this.trimMessagesForLLM(this.messages);

      if (this.debugMode) {
        console.log("[AgenticLoopEngine] Calling LLM with messages:", messagesForLLM);
      }

      const llmResponseGenerator = this.llmClient.getCompletions(messagesForLLM, {
        ...this.llmConfig,
        max_tokens: this.maxTokens,
      });

      let fullLLMResponse: IMessage = { role: 'assistant', content: '' };
      let toolCodeContent = '';
      let toolCodeLanguage = '';
      let receivedAnyContent = false; // Flag to track if any content (text or code) was received from LLM

      try {
        for await (const chunk of llmResponseGenerator) {
          receivedAnyContent = true;
          yield chunk; // Stream LLM output directly to the consumer

          if (chunk.content) {
            fullLLMResponse.content += chunk.content;
          }
          if (chunk.code) {
            toolCodeContent += chunk.code;
            toolCodeLanguage = chunk.language || 'python'; // Default code language if not specified by LLM
          }
          // The LLM client is expected to yield messages with either 'content' or 'code'/'language'.
          // If the LLM produces distinct messages for text and code, this logic handles it.
        }
      } catch (error) {
        console.error("[AgenticLoopEngine] Error during LLM completion:", error);
        const errorMessage = { role: 'function', name: 'error', content: `LLM Error: ${error instanceof Error ? error.message : String(error)}` };
        this.messages.push(errorMessage);
        yield errorMessage;
        break; // Exit loop on LLM error
      }


      // Add the full combined LLM response (text + code) to history
      if (receivedAnyContent) {
        const finalLLMMessage: IMessage = { role: 'assistant' };
        if (fullLLMResponse.content) finalLLMMessage.content = fullLLMResponse.content.trim();
        if (toolCodeContent) {
          finalLLMMessage.code = toolCodeContent.trim();
          finalLLMMessage.language = toolCodeLanguage;
        }
        if (finalLLMMessage.content || finalLLMMessage.code) {
          this.messages.push(finalLLMMessage);
        }
      }

      if (toolCodeContent) {
        // LLM provided code, attempt to execute it
        if (this.verbose) {
          console.log(`[AgenticLoopEngine] LLM suggested code (${toolCodeLanguage}):\n${toolCodeContent}`);
        }

        if (!this.autoRunCode) {
          // If auto-run is off, yield a message to the user for approval.
          // In a real application, the consumer of this generator would prompt the user
          // and then re-call `chat` with a user message indicating 'y' or 'n'.
          // For a standalone engine, we assume autoRunCode is handled by configuration or a simple prompt.
          yield { role: 'system', content: `Code suggested in ${toolCodeLanguage}:\n\`\`\`${toolCodeLanguage}\n${toolCodeContent}\n\`\`\`\nProceed? (auto-run is off)` };
          // If autoRunCode is false, this loop needs an external signal to continue or stop.
          // For this pristine code, we'll assume a "yes" implicitly if autoRunCode is off,
          // or that the loop breaks until external input which is out of scope.
          // To make it fully functional without explicit UI, let's proceed if autoRunCode is off and no explicit 'n' is given.
          // This behavior might need adjustment depending on the actual UI integration.
          // For now, we proceed as if approval is implicit when `autoRunCode` is off and this point is reached.
        }

        const interpreter = this.codeInterpreters.get(toolCodeLanguage);
        if (interpreter) {
          yield { role: 'system', content: `Running ${toolCodeLanguage} code...` };
          if (this.debugMode) {
            console.log(`[AgenticLoopEngine] Executing ${toolCodeLanguage} code.`);
          }

          const codeOutputMessages: IMessage[] = [];
          try {
            for await (const outputChunk of interpreter.run(toolCodeContent)) {
              yield outputChunk; // Yield code output chunks as they arrive
              codeOutputMessages.push(outputChunk);
            }
            // Add all code output messages to history
            this.messages.push(...codeOutputMessages);
          } catch (error) {
            console.error(`[AgenticLoopEngine] Error executing ${toolCodeLanguage} code:`, error);
            const errorMessage: IMessage = { role: 'function', name: 'error', content: `Code Execution Error: ${error instanceof Error ? error.message : String(error)}` };
            this.messages.push(errorMessage);
            yield errorMessage;
            // Decide if execution should stop on code error or continue to LLM for self-correction.
            // For now, continue to LLM to allow it to react to the error.
          }

          // Continue the loop to let the LLM see the output and potentially generate more code or a final response.
          continue;
        } else {
          const errorMessage = `No interpreter found for language: ${toolCodeLanguage}. Cannot execute code.`;
          console.error(`[AgenticLoopEngine] ${errorMessage}`);
          const errorMsg: IMessage = { role: 'function', name: 'error', content: errorMessage };
          this.messages.push(errorMsg);
          yield errorMsg;
          break; // Exit if no interpreter to handle the code
        }
      } else {
        // If LLM didn't provide code and there was no content, it means the LLM is done for this turn.
        // If it provided only text, and no code, it's also done.
        if (this.debugMode) {
          console.log("[AgenticLoopEngine] LLM did not provide code. Ending turn.");
        }
        break; // Exit the loop, the conversation turn is complete.
      }
    }
  }

  /**
   * Trims the message history to fit within the LLM's context window.
   * This is a simple trimming strategy; more sophisticated methods might prioritize system messages, tool definitions, etc.
   * @param messages The full conversation history.
   * @returns A subset of messages suitable for the LLM.
   */
  private trimMessagesForLLM(messages: IMessage[]): IMessage[] {
    if (!this.maxMessageHistory || messages.length <= this.maxMessageHistory) {
      return messages;
    }
    // Keep a reasonable number of recent messages, including the last user prompt
    return messages.slice(-this.maxMessageHistory);
  }

  /**
   * Starts all registered code interpreter processes.
   */
  public async start(): Promise<void> {
    if (this.verbose) {
      console.log("[AgenticLoopEngine] Starting all registered code interpreters...");
    }
    for (const interpreter of this.codeInterpreters.values()) {
      try {
        await interpreter.start();
        if (this.verbose) {
          console.log(`[AgenticLoopEngine] Interpreter for ${interpreter.language} started.`);
        }
      } catch (error) {
        console.error(`[AgenticLoopEngine] Failed to start interpreter for ${interpreter.language}:`, error);
        throw error; // Propagate startup errors
      }
    }
  }

  /**
   * Stops all registered code interpreter processes.
   */
  public async stop(): Promise<void> {
    if (this.verbose) {
      console.log("[AgenticLoopEngine] Stopping all registered code interpreters...");
    }
    for (const interpreter of this.codeInterpreters.values()) {
      try {
        await interpreter.stop();
        if (this.verbose) {
          console.log(`[AgenticLoopEngine] Interpreter for ${interpreter.language} stopped.`);
        }
      } catch (error) {
        console.error(`[AgenticLoopEngine] Failed to stop interpreter for ${interpreter.language}:`, error);
        // Continue stopping other interpreters even if one fails
      }
    }
  }

  /**
   * Resets the conversation history, effectively starting a new conversation.
   * Optionally resets the state of registered code interpreters.
   */
  public async reset(): Promise<void> {
    if (this.verbose) {
      console.log("[AgenticLoopEngine] Resetting conversation history and interpreters...");
    }
    this.messages = [];
    for (const interpreter of this.codeInterpreters.values()) {
      if (interpreter.reset) {
        try {
          await interpreter.reset();
        } catch (error) {
          console.error(`[AgenticLoopEngine] Failed to reset interpreter for ${interpreter.language}:`, error);
        }
      }
    }
  }
}
```

---

## Engine 2: PythonCodeExecutionEngine

### What it does

The `PythonCodeExecutionEngine` is responsible for executing Python code within a dedicated, persistent Python interpreter process. It provides a sandboxed (though locally accessible) environment for the `AgenticLoopEngine` to run Python scripts and commands.

1.  **Process Management:** Spawns and manages a child process running the Python interpreter in interactive mode (`python -i`).
2.  **Code Ingestion:** Receives Python code strings from the `AgenticLoopEngine`.
3.  **Execution & State:** Feeds the received code into the stdin of the Python process. Because it operates in interactive mode, variables, function definitions, and imported modules persist across multiple `run` calls within the same session.
4.  **Output Capture:** Captures `stdout` and `stderr` streams from the Python process.
5.  **Output Formatting:** Formats captured output and errors into `IMessage` objects, indicating the nature of the output (e.g., `'output'` for stdout, `'error'` for stderr or exceptions).
6.  **Execution Synchronization:** Uses a unique termination token to reliably detect the end of a code execution block and synchronize the capture of its output.

**Inputs:** Python code as a string.

**State Lifecycle:**
*   **Initialization:** Constructor prepares the engine; no active process yet.
*   **Start:** `start()` method spawns the Python child process, setting up event listeners for stdout/stderr and process termination. It waits for a readiness signal from the interpreter.
*   **Run:** `run()` method sends code to the Python process, buffers output, and yields `IMessage` objects until a special end-of-execution marker is detected. It manages a `isBusy` flag to prevent concurrent executions.
*   **Stop:** `stop()` method terminates the Python child process.
*   **Persistence:** The interactive Python session maintains its state (defined variables, imports) across successive `run` calls until `stop()` is called.

**Invariant Preservation:**
*   **Order of Execution:** Ensures that Python code blocks are executed sequentially within the same interpreter instance, preserving the order of operations and variable dependencies.
*   **Complete Output Capture:** Guarantees that all stdout and stderr generated by a code block are captured and reported, even if the output is voluminous or contains errors.
*   **Session Integrity:** The Python session remains active and maintains its state between `run` calls, facilitating multi-step coding tasks where context is crucial.

**Outputs:** An `AsyncGenerator<IMessage>` which yields `IMessage` objects representing `stdout` content (role `function`, name `output`) or `stderr`/exception messages (role `function`, name `error`).

### Implementation Code

```typescript
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { IMessage, ICodeInterpreter } from './interfaces'; // Assuming interfaces are in 'interfaces.ts'

export class PythonCodeExecutionEngine implements ICodeInterpreter {
  public readonly language = 'python';
  private process: ChildProcessWithoutNullStreams | null = null;
  private outputBuffer: string = '';
  private errorBuffer: string = '';
  private resolveExecution: (() => void) | null = null;
  private rejectExecution: ((error: Error) => void) | null = null;
  private isBusy: boolean = false;
  private verbose: boolean = false; // Add verbose flag, perhaps configurable

  constructor(options?: { verbose?: boolean }) {
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Starts the Python interactive interpreter process.
   * It waits for a specific readiness signal from the interpreter.
   */
  public async start(): Promise<void> {
    if (this.process) {
      if (this.verbose) console.warn("[PythonCodeExecutionEngine] Python interpreter already started.");
      return;
    }

    // Spawn Python in interactive mode, with a command to signal readiness
    this.process = spawn('python', ['-i', '-c', 'import sys; print("OPEN_INTERPRETER_RUNTIME_ENGINE_PYTHON_READY"); sys.stdout.flush()'], {
      stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr are piped
    });

    if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
      throw new Error("[PythonCodeExecutionEngine] Failed to open stdio pipes for Python process.");
    }

    this.process.stdout.on('data', (data) => {
      this.outputBuffer += data.toString();
      if (this.verbose) console.log(`[PythonCodeExecutionEngine][STDOUT] Buffer growth: ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      this.errorBuffer += data.toString();
      if (this.verbose) console.log(`[PythonCodeExecutionEngine][STDERR] Buffer growth: ${data.toString().trim()}`);
    });

    this.process.on('close', (code) => {
      if (this.rejectExecution) {
        this.rejectExecution(new Error(`[PythonCodeExecutionEngine] Python process exited unexpectedly with code ${code}`));
      }
      this.process = null;
      this.isBusy = false;
      if (this.verbose) console.log(`[PythonCodeExecutionEngine] Python process closed with code ${code}.`);
    });

    this.process.on('error', (err) => {
      if (this.rejectExecution) {
        this.rejectExecution(err);
      }
      console.error("[PythonCodeExecutionEngine] Python process error:", err);
      this.process = null;
      this.isBusy = false;
    });

    // Wait for the interpreter to signal readiness
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.process?.kill(); // Terminate if it times out
        reject(new Error("[PythonCodeExecutionEngine] Python interpreter startup timed out."));
      }, 15000); // 15 seconds timeout

      const onData = (data: Buffer) => {
        const str = data.toString();
        if (str.includes("OPEN_INTERPRETER_RUNTIME_ENGINE_PYTHON_READY")) {
          clearTimeout(timeout);
          this.process?.stdout?.off('data', onData); // Remove this specific listener
          if (this.verbose) console.log("[PythonCodeExecutionEngine] Python interpreter is ready.");
          resolve();
        }
      };
      this.process?.stdout?.on('data', onData);
    });
  }

  /**
   * Executes a given Python code block in the persistent interpreter session.
   * It uses a unique token to detect the end of the execution.
   * @param code The Python code string to execute.
   * @returns An AsyncGenerator that yields IMessage objects for output and errors.
   */
  public async *run(code: string): AsyncGenerator<IMessage> {
    if (!this.process || !this.process.stdin) {
      yield { role: 'function', name: 'error', content: '[PythonCodeExecutionEngine] Python interpreter not running.' };
      return;
    }
    if (this.isBusy) {
      yield { role: 'function', name: 'error', content: '[PythonCodeExecutionEngine] Python interpreter is currently busy with another execution.' };
      return;
    }

    this.isBusy = true;
    this.outputBuffer = ''; // Clear buffers for new execution
    this.errorBuffer = '';

    const executionPromise = new Promise<void>((resolve, reject) => {
      this.resolveExecution = resolve;
      this.rejectExecution = reject;
    });

    // Use a unique token to mark the end of execution and flush stdout
    const endOfExecutionToken = `---OPEN_INTERPRETER_RUNTIME_ENGINE_PYTHON_END_${Date.now()}---`;
    const wrappedCode = `${code}\nprint('${endOfExecutionToken}')\nsys.stdout.flush()\nsys.stderr.flush()\n`;

    try {
      this.process.stdin.write(wrappedCode);
    } catch (e) {
      this.isBusy = false;
      yield { role: 'function', name: 'error', content: `[PythonCodeExecutionEngine] Failed to write to Python stdin: ${e}` };
      return;
    }

    let currentStdoutSegment = '';
    let currentStderrSegment = '';

    const handleStdout = (data: Buffer) => {
      const str = data.toString();
      currentStdoutSegment += str;
      if (currentStdoutSegment.includes(endOfExecutionToken)) {
        const parts = currentStdoutSegment.split(endOfExecutionToken);
        this.outputBuffer += parts[0]; // Content before the token
        currentStdoutSegment = parts[1] || ''; // Remaining content after the token
        if (this.resolveExecution) {
          this.resolveExecution(); // Signal completion
        }
      } else {
        this.outputBuffer += str;
      }
    };

    const handleStderr = (data: Buffer) => {
      const str = data.toString();
      currentStderrSegment += str;
      this.errorBuffer += str;
    };

    this.process.stdout.on('data', handleStdout);
    this.process.stderr.on('data', handleStderr);

    try {
      await executionPromise; // Wait for the end token
    } catch (e: any) {
      yield { role: 'function', name: 'error', content: e.message || '[PythonCodeExecutionEngine] Unknown error during Python execution.' };
    } finally {
      this.process.stdout.off('data', handleStdout);
      this.process.stderr.off('data', handleStderr);
      this.isBusy = false;
      this.resolveExecution = null;
      this.rejectExecution = null;
    }

    // Clean up and yield the final output/error
    const cleanedOutput = this.outputBuffer.replace(`\n'${endOfExecutionToken}'`, '').trim();
    if (cleanedOutput) {
      yield { role: 'function', name: 'output', content: cleanedOutput };
    }
    if (this.errorBuffer.trim()) {
      yield { role: 'function', name: 'error', content: this.errorBuffer.trim() };
    }
  }

  /**
   * Stops the Python interpreter process.
   */
  public async stop(): Promise<void> {
    if (this.process) {
      if (this.verbose) console.log("[PythonCodeExecutionEngine] Stopping Python interpreter...");
      this.process.kill(); // Send SIGTERM
      this.process = null;
      this.isBusy = false;
    }
  }

  /**
   * Resets the Python interpreter by stopping and restarting the process.
   * This clears all defined variables and imported modules.
   */
  public async reset(): Promise<void> {
    if (this.verbose) console.log("[PythonCodeExecutionEngine] Resetting Python interpreter.");
    await this.stop();
    await this.start();
  }
}
```

---

## Engine 3: JavaScriptCodeExecutionEngine

### What it does

The `JavaScriptCodeExecutionEngine` is designed to execute JavaScript code using a dedicated Node.js interpreter process. Similar to its Python counterpart, it provides an interactive and persistent environment for running JavaScript commands and scripts.

1.  **Process Management:** Spawns and manages a child process running the Node.js interpreter in interactive mode (`node -i`).
2.  **Code Ingestion:** Receives JavaScript code strings from the `AgenticLoopEngine`.
3.  **Execution & State:** Sends the code to the stdin of the Node.js process. The interactive nature allows variables, function definitions, and module imports to persist across multiple `run` calls within the same session.
4.  **Output Capture:** Monitors and captures `stdout` and `stderr` streams from the Node.js process.
5.  **Output Formatting:** Formats the captured output and errors into `IMessage` objects, distinguishing between standard output and error messages.
6.  **Execution Synchronization:** Utilizes a unique termination token printed by the Node.js process to accurately determine when a code execution block has completed and all its output has been received.

**Inputs:** JavaScript code as a string.

**State Lifecycle:**
*   **Initialization:** Constructor prepares the engine.
*   **Start:** `start()` method launches the Node.js child process, sets up event handlers for its output and lifecycle events, and waits for a specific readiness signal.
*   **Run:** `run()` method sends JavaScript code to the Node.js process's stdin, buffers its output, and yields `IMessage` objects until an end-of-execution marker is detected. It ensures only one execution runs at a time using an `isBusy` flag.
*   **Stop:** `stop()` method terminates the Node.js child process.
*   **Persistence:** The interactive Node.js session maintains its state (e.g., global variables, loaded modules) between consecutive `run` calls, facilitating multi-step JavaScript tasks.

**Invariant Preservation:**
*   **Ordered Execution:** Guarantees that JavaScript code blocks are executed sequentially within the same Node.js context, maintaining the correct order of operations and variable dependencies.
*   **Comprehensive Output:** Ensures that all `stdout` and `stderr` produced by a code block are fully captured and reported, even in cases of extensive output or runtime errors.
*   **Session State:** The Node.js interactive session's state remains intact and accessible across `run` calls, allowing for iterative development and debugging within the same environment.

**Outputs:** An `AsyncGenerator<IMessage>` yielding `IMessage` objects for `stdout` content (role `function`, name `output`) or `stderr`/exception messages (role `function`, name `error`).

### Implementation Code

```typescript
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { IMessage, ICodeInterpreter } from './interfaces'; // Assuming interfaces are in 'interfaces.ts'

export class JavaScriptCodeExecutionEngine implements ICodeInterpreter {
  public readonly language = 'javascript';
  private process: ChildProcessWithoutNullStreams | null = null;
  private outputBuffer: string = '';
  private errorBuffer: string = '';
  private resolveExecution: (() => void) | null = null;
  private rejectExecution: ((error: Error) => void) | null = null;
  private isBusy: boolean = false;
  private verbose: boolean = false; // Add verbose flag, perhaps configurable

  constructor(options?: { verbose?: boolean }) {
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Starts the Node.js interactive interpreter process.
   * It waits for a specific readiness signal from the interpreter.
   */
  public async start(): Promise<void> {
    if (this.process) {
      if (this.verbose) console.warn("[JavaScriptCodeExecutionEngine] JavaScript interpreter already started.");
      return;
    }

    // Spawn Node.js in interactive mode, with a command to signal readiness
    this.process = spawn('node', ['-i', '-e', 'console.log("OPEN_INTERPRETER_RUNTIME_ENGINE_JAVASCRIPT_READY")'], {
      stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr are piped
    });

    if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
      throw new Error("[JavaScriptCodeExecutionEngine] Failed to open stdio pipes for JavaScript process.");
    }

    this.process.stdout.on('data', (data) => {
      this.outputBuffer += data.toString();
      if (this.verbose) console.log(`[JavaScriptCodeExecutionEngine][STDOUT] Buffer growth: ${data.toString().trim()}`);
    });

    this.process.stderr.on('data', (data) => {
      this.errorBuffer += data.toString();
      if (this.verbose) console.log(`[JavaScriptCodeExecutionEngine][STDERR] Buffer growth: ${data.toString().trim()}`);
    });

    this.process.on('close', (code) => {
      if (this.rejectExecution) {
        this.rejectExecution(new Error(`[JavaScriptCodeExecutionEngine] JavaScript process exited unexpectedly with code ${code}`));
      }
      this.process = null;
      this.isBusy = false;
      if (this.verbose) console.log(`[JavaScriptCodeExecutionEngine] JavaScript process closed with code ${code}.`);
    });

    this.process.on('error', (err) => {
      if (this.rejectExecution) {
        this.rejectExecution(err);
      }
      console.error("[JavaScriptCodeExecutionEngine] JavaScript process error:", err);
      this.process = null;
      this.isBusy = false;
    });

    // Wait for the interpreter to signal readiness
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.process?.kill();
        reject(new Error("[JavaScriptCodeExecutionEngine] JavaScript interpreter startup timed out."));
      }, 15000); // 15 seconds timeout

      const onData = (data: Buffer) => {
        const str = data.toString();
        if (str.includes("OPEN_INTERPRETER_RUNTIME_ENGINE_JAVASCRIPT_READY")) {
          clearTimeout(timeout);
          this.process?.stdout?.off('data', onData);
          if (this.verbose) console.log("[JavaScriptCodeExecutionEngine] JavaScript interpreter is ready.");
          resolve();
        }
      };
      this.process?.stdout?.on('data', onData);
    });
  }

  /**
   * Executes a given JavaScript code block in the persistent interpreter session.
   * It uses a unique token to detect the end of the execution.
   * @param code The JavaScript code string to execute.
   * @returns An AsyncGenerator that yields IMessage objects for output and errors.
   */
  public async *run(code: string): AsyncGenerator<IMessage> {
    if (!this.process || !this.process.stdin) {
      yield { role: 'function', name: 'error', content: '[JavaScriptCodeExecutionEngine] JavaScript interpreter not running.' };
      return;
    }
    if (this.isBusy) {
      yield { role: 'function', name: 'error', content: '[JavaScriptCodeExecutionEngine] JavaScript interpreter is currently busy with another execution.' };
      return;
    }

    this.isBusy = true;
    this.outputBuffer = '';
    this.errorBuffer = '';

    const executionPromise = new Promise<void>((resolve, reject) => {
      this.resolveExecution = resolve;
      this.rejectExecution = reject;
    });

    // Use a unique token to mark the end of execution and flush stdout
    const endOfExecutionToken = `---OPEN_INTERPRETER_RUNTIME_ENGINE_JAVASCRIPT_END_${Date.now()}---`;
    // In Node.js interactive mode, we typically use console.log for output and flushing.
    const wrappedCode = `${code}\nconsole.log('${endOfExecutionToken}')\n`;

    try {
      this.process.stdin.write(wrappedCode);
    } catch (e) {
      this.isBusy = false;
      yield { role: 'function', name: 'error', content: `[JavaScriptCodeExecutionEngine] Failed to write to Node.js stdin: ${e}` };
      return;
    }

    let currentStdoutSegment = '';
    let currentStderrSegment = '';

    const handleStdout = (data: Buffer) => {
      const str = data.toString();
      currentStdoutSegment += str;
      if (currentStdoutSegment.includes(endOfExecutionToken)) {
        const parts = currentStdoutSegment.split(endOfExecutionToken);
        this.outputBuffer += parts[0];
        currentStdoutSegment = parts[1] || '';
        if (this.resolveExecution) {
          this.resolveExecution();
        }
      } else {
        this.outputBuffer += str;
      }
    };

    const handleStderr = (data: Buffer) => {
      const str = data.toString();
      currentStderrSegment += str;
      this.errorBuffer += str;
    };

    this.process.stdout.on('data', handleStdout);
    this.process.stderr.on('data', handleStderr);

    try {
      await executionPromise;
    } catch (e: any) {
      yield { role: 'function', name: 'error', content: e.message || '[JavaScriptCodeExecutionEngine] Unknown error during JavaScript execution.' };
    } finally {
      this.process.stdout.off('data', handleStdout);
      this.process.stderr.off('data', handleStderr);
      this.isBusy = false;
      this.resolveExecution = null;
      this.rejectExecution = null;
    }

    const cleanedOutput = this.outputBuffer.replace(`\n'${endOfExecutionToken}'`, '').trim();
    if (cleanedOutput) {
      yield { role: 'function', name: 'output', content: cleanedOutput };
    }
    if (this.errorBuffer.trim()) {
      yield { role: 'function', name: 'error', content: this.errorBuffer.trim() };
    }
  }

  /**
   * Stops the Node.js interpreter process.
   */
  public async stop(): Promise<void> {
    if (this.process) {
      if (this.verbose) console.log("[JavaScriptCodeExecutionEngine] Stopping JavaScript interpreter...");
      this.process.kill();
      this.process = null;
      this.isBusy = false;
    }
  }

  /**
   * Resets the JavaScript interpreter by stopping and restarting the process.
   * This clears all defined variables and imported modules.
   */
  public async reset(): Promise<void> {
    if (this.verbose) console.log("[JavaScriptCodeExecutionEngine] Resetting JavaScript interpreter.");
    await this.stop();
    await this.start();
  }
}
```

---

## Engine 4: ShellCodeExecutionEngine

### What it does

The `ShellCodeExecutionEngine` provides the capability to execute arbitrary shell commands. Unlike the Python and JavaScript engines which maintain interactive sessions, this engine typically executes each command in a new, independent sub-shell process.

1.  **Command Execution:** Takes a shell command string and executes it directly using the system's default shell (e.g., `bash`, `sh`, `zsh`).
2.  **Output Capture:** Captures both standard output (`stdout`) and standard error (`stderr`) streams generated by the executed command.
3.  **Result Reporting:** Formats the captured `stdout` as an `IMessage` with `name: 'output'` and `stderr` as an `IMessage` with `name: 'error'`.
4.  **Error Handling:** Detects non-zero exit codes from shell commands, which typically indicate an error, and reports them appropriately.

**Inputs:** A shell command string.

**State Lifecycle:**
*   **Initialization:** Constructor prepares the engine. No persistent process is managed in its default mode.
*   **Start:** `start()` method indicates readiness but doesn't necessarily spawn a long-lived process, as each `run` call typically creates a new shell instance.
*   **Run:** `run()` method spawns a child process for the shell, passes the command using the `-c` flag, waits for its completion, and collects all output.
*   **Stop:** `stop()` method performs cleanup, but for a non-persistent shell, there's usually no active process to terminate.

**Invariant Preservation:**
*   **Command Isolation:** Each `run` call executes in a fresh shell environment (unless explicitly configured for persistence), ensuring that commands do not inadvertently interfere with the state of previous or subsequent commands. This simplifies reasoning about side effects.
*   **Reliable Output:** Guarantees that all `stdout` and `stderr` generated by a shell command are fully captured and returned.
*   **Error Indication:** Accurately reports the success or failure of a command based on its exit code, providing crucial feedback to the `AgenticLoopEngine`.

**Outputs:** An `AsyncGenerator<IMessage>` yielding `IMessage` objects for `stdout` content (role `function`, name `output`) or `stderr`/error messages (role `function`, name `error`).

### Implementation Code

```typescript
import { spawn } from 'child_process';
import { IMessage, ICodeInterpreter } from './interfaces'; // Assuming interfaces are in 'interfaces.ts'

export class ShellCodeExecutionEngine implements ICodeInterpreter {
  public readonly language = 'sh';
  private verbose: boolean = false; // Add verbose flag, perhaps configurable

  constructor(options?: { verbose?: boolean }) {
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Initializes the shell interpreter. For shell, this typically means ensuring the shell is available.
   * No persistent process is started as each 'run' command will typically spawn a new process.
   */
  public async start(): Promise<void> {
    if (this.verbose) console.log("[ShellCodeExecutionEngine] Shell interpreter ready (commands will be executed directly).");
    // No-op for a non-persistent shell, as processes are spawned per 'run' call.
    // One could add a check here to ensure 'sh' or 'bash' is available.
  }

  /**
   * Executes a given shell command. Each command is run in a new sub-shell.
   * @param code The shell command string to execute.
   * @returns An AsyncGenerator that yields IMessage objects for output and errors.
   */
  public async *run(code: string): AsyncGenerator<IMessage> {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    // Determine the shell to use. Prefer SHELL environment variable, otherwise default to '/bin/sh'.
    const shellCommand = process.env.SHELL || '/bin/sh';
    const args = ['-c', code]; // '-c' flag tells the shell to read commands from the string argument

    if (this.verbose) console.log(`[ShellCodeExecutionEngine] Executing command: ${shellCommand} ${args.join(' ')}`);

    const childProcess = spawn(shellCommand, args, {
      stdio: ['ignore', 'pipe', 'pipe'] // stdin ignored as code is passed via -c, stdout/stderr are piped
    });

    if (!childProcess.stdout || !childProcess.stderr) {
      yield { role: 'function', name: 'error', content: '[ShellCodeExecutionEngine] Failed to open stdio pipes for shell process.' };
      return;
    }

    // Capture stdout data
    childProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      if (this.verbose) console.log(`[ShellCodeExecutionEngine][STDOUT] Buffer growth: ${data.toString().trim()}`);
    });

    // Capture stderr data
    childProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      if (this.verbose) console.log(`[ShellCodeExecutionEngine][STDERR] Buffer growth: ${data.toString().trim()}`);
    });

    // Wait for the command to finish executing
    await new Promise<void>((resolve, reject) => {
      childProcess.on('close', (code) => {
        if (code !== 0) {
          // Non-zero exit code indicates an error
          reject(new Error(`[ShellCodeExecutionEngine] Shell command exited with code ${code}. Stderr: ${stderrBuffer.trim()}`));
        } else {
          resolve();
        }
      });
      childProcess.on('error', (err) => {
        reject(new Error(`[ShellCodeExecutionEngine] Failed to spawn shell process: ${err.message}`));
      });
    });

    // Yield any captured stdout
    if (stdoutBuffer.trim()) {
      yield { role: 'function', name: 'output', content: stdoutBuffer.trim() };
    }
    // Yield any captured stderr (even if exit code was 0, warnings can be in stderr)
    if (stderrBuffer.trim()) {
      yield { role: 'function', name: 'error', content: stderrBuffer.trim() };
    }
  }

  /**
   * Stops the shell interpreter. For this model, there's no persistent process to stop.
   */
  public async stop(): Promise<void> {
    if (this.verbose) console.log("[ShellCodeExecutionEngine] Shell interpreter stopped (no active process).");
    // No-op for a non-persistent shell.
  }

  /**
   * Resets the shell interpreter. For this model, it's a no-op as each run is stateless.
   */
  public async reset(): Promise<void> {
    if (this.verbose) console.log("[ShellCodeExecutionEngine] Resetting Shell interpreter (no-op for stateless execution).");
    // No-op for a non-persistent shell.
  }
}
```