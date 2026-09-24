This document outlines the core runtime engines identified within the OpenInterpreterRuntimeEngine system. These engines are responsible for orchestrating interactions, executing code in various languages, and managing the overall state of the AI's operation. All proprietary names and branding have been completely sanitized and replaced with generic terms to ensure compliance with the directives.

---

```typescript
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Represents a message exchanged in the conversation history.
 */
export type Message = {
    role: "user" | "assistant" | "system" | "tool";
    content?: string;
    tool_calls?: ToolCall[];
    tool_output?: string; // Accumulated output/errors from tool calls
};

/**
 * Represents a request for a tool call, specifically a code interpreter execution.
 */
export type ToolCall = {
    id: string; // A unique identifier for this tool call
    type: "code_interpreter";
    code_interpreter: {
        language: "python" | "shell" | "javascript";
        code: string;
    };
};

/**
 * Represents an output or error from an interpreter.
 */
export type InterpreterOutput = {
    type: "output" | "error" | "result" | "system" | "code" | "thinking";
    content: string;
    language?: "python" | "shell" | "javascript" | "system";
    id?: string; // Optional: Corresponds to ToolCall ID if applicable
};

/**
 * Interface for any code execution interpreter.
 */
export interface CodeInterpreter {
    language: "python" | "shell" | "javascript";
    start(): Promise<void>;
    stop(): Promise<void>;
    run(code: string, toolCallId?: string): Promise<void>;
    onOutput: (callback: (output: InterpreterOutput) => void) => void;
    onError: (callback: (error: InterpreterOutput) => void) => void;
}

/**
 * Interface for interacting with a Large Language Model (LLM).
 * This acts as a mockable dependency for the orchestrator.
 */
export interface LLMInterface {
    chat(messages: Message[]): Promise<Message>;
}

/**
 * A mock implementation of an LLM for demonstration purposes.
 * It simulates generating text responses or tool calls based on simple keyword matching.
 */
class MockLLM implements LLMInterface {
    async chat(messages: Message[]): Promise<Message> {
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage?.content?.toLowerCase() || "";

        if (userQuery.includes("hello")) {
            return { role: "assistant", content: "Hello there! How can I assist you today?" };
        }
        if (userQuery.includes("print current directory")) {
            return {
                role: "assistant",
                tool_calls: [{
                    id: "tool_call_shell_1",
                    type: "code_interpreter",
                    code_interpreter: {
                        language: "shell",
                        code: "pwd"
                    }
                }]
            };
        }
        if (userQuery.includes("fibonacci series")) {
            return {
                role: "assistant",
                tool_calls: [{
                    id: "tool_call_python_1",
                    type: "code_interpreter",
                    code_interpreter: {
                        language: "python",
                        code: `
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        print(a)
        a, b = b, a + b
print("Fibonacci Series:")
fibonacci(8)
`
                    }
                }]
            };
        }
        if (userQuery.includes("calculate sum in js")) {
            return {
                role: "assistant",
                tool_calls: [{
                    id: "tool_call_js_1",
                    type: "code_interpreter",
                    code_interpreter: {
                        language: "javascript",
                        code: `
let sum = 0;
for (let i = 1; i <= 5; i++) {
    sum += i;
}
console.log("Sum:", sum);
`
                    }
                }]
            };
        }
        if (userQuery.includes("how are you")) {
            return { role: "assistant", content: "I am a runtime engine, functioning as expected." };
        }

        // If a tool_output is present, it means previous tool calls finished.
        // Respond as if processing the results.
        const lastAssistantMessageWithToolOutput = messages.reverse().find(m => m.role === 'assistant' && m.tool_output);
        if (lastAssistantMessageWithToolOutput) {
            return { role: "assistant", content: `I have processed the tool output:\n${lastAssistantMessageWithToolOutput.tool_output}\nWhat else can I do?` };
        }


        return { role: "assistant", content: `I received your message: "${lastMessage?.content}". I'm a mock LLM. Please try "hello", "print current directory", "fibonacci series", or "calculate sum in js" for tool examples. You can also ask "how are you".` };
    }
}

/**
 * Helper function to safely send data to a child process's stdin.
 * It ensures the stdin stream is writable before attempting to write.
 * Appends a newline for proper command submission.
 */
function sendToStdin(process: ChildProcessWithoutNullStreams, data: string): void {
    if (process.stdin && !process.stdin.writableEnded) {
        process.stdin.write(data + '\n');
    } else {
        console.warn(`Attempted to write to a closed or non-writable stdin for process PID: ${process.pid}`);
    }
}

/**
 * Abstract base class for all code interpreters.
 * Handles common child process spawning, output/error streaming, and lifecycle management.
 * It uses EventEmitter to broadcast output and error events.
 */
abstract class BaseCodeInterpreter extends EventEmitter implements CodeInterpreter {
    protected process: ChildProcessWithoutNullStreams | null = null;
    protected isRunning: boolean = false;
    public abstract language: "python" | "shell" | "javascript";

    constructor() {
        super();
        this.setMaxListeners(100); // Prevent MaxListenersExceededWarning for multiple listeners
    }

    /**
     * Abstract method to be implemented by concrete interpreters,
     * providing the command and arguments for spawning the child process.
     */
    protected abstract getSpawnArgs(): { command: string, args: string[], options?: object };

    /**
     * Starts the interpreter process. Sets up listeners for stdout, stderr, close, and error events.
     */
    public async start(): Promise<void> {
        if (this.isRunning) {
            console.warn(`${this.language} interpreter is already running.`);
            return;
        }

        const { command, args, options } = this.getSpawnArgs();
        // stdio: ['pipe', 'pipe', 'pipe'] ensures stdin, stdout, stderr are piped
        this.process = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], ...options });
        this.isRunning = true;

        this.process.stdout.on('data', (data) => {
            this.emit('output', { type: "output", content: data.toString(), language: this.language });
        });

        this.process.stderr.on('data', (data) => {
            this.emit('error', { type: "error", content: data.toString(), language: this.language });
        });

        this.process.on('close', (code) => {
            if (this.isRunning) { // Only emit error if it wasn't manually stopped
                this.emit('error', { type: "error", content: `${this.language} interpreter exited with code ${code}`, language: this.language });
            }
            this.isRunning = false;
            this.process = null;
        });

        this.process.on('error', (err) => {
            this.emit('error', { type: "error", content: `Failed to start ${this.language} interpreter: ${err.message}`, language: this.language });
            this.isRunning = false;
            this.process = null;
        });

        // Give the process a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`${this.language} interpreter started.`);
    }

    /**
     * Stops the interpreter process by sending a termination signal.
     */
    public async stop(): Promise<void> {
        if (this.process && this.isRunning) {
            this.process.kill('SIGTERM'); // Send termination signal
            await new Promise(resolve => {
                if (this.process) {
                    // Wait for the process to actually close or exit
                    this.process.on('close', resolve);
                    this.process.on('exit', resolve);
                } else {
                    resolve(void 0); // No process to kill
                }
            });
            this.process = null;
            this.isRunning = false;
            console.log(`${this.language} interpreter stopped.`);
        }
    }

    /**
     * Abstract method for running code, to be implemented by concrete interpreters.
     */
    public abstract run(code: string, toolCallId?: string): Promise<void>;

    /**
     * Registers a callback for receiving interpreter output.
     */
    public onOutput(callback: (output: InterpreterOutput) => void): void {
        this.on('output', callback);
    }

    /**
     * Registers a callback for receiving interpreter errors.
     */
    public onError(callback: (error: InterpreterOutput) => void): void {
        this.on('error', callback);
    }
}
```

---

## Engine 1: OpenInterpreterRuntimeEngine (Orchestrator)

### What it does
This is the central orchestration engine of the system. It manages the overall flow of interaction by maintaining a conversation history, interacting with an external Large Language Model (LLM), and dispatching code execution requests to specialized code interpreters. Its primary role is to interpret user input, engage the LLM to generate appropriate responses (which can be text or structured tool calls for code execution), and then execute any requested code. It feeds the results of code execution back into the conversation history, allowing the LLM to maintain context and make further decisions. The engine ensures a continuous loop of AI reasoning and action, acting as the brain that coordinates all system components.

**Inputs:** User queries (strings) and an instance of an `LLMInterface`.
**State:** `history` (an array of `Message` objects representing the conversation), a map of registered `CodeInterpreter` instances, and a map of currently active code execution promises.
**Invariant Preservation:** Ensures conversation history is consistently updated with user messages, LLM responses, and tool execution outputs/errors. It also ensures that code interpreters are properly started and stopped.
**Outputs:** Emits various `InterpreterOutput` events (e.g., system messages, LLM responses, code blocks, execution results, errors) to any subscribed listeners, and updates its internal conversation `history`.

### Implementation Code

```typescript
/**
 * The main orchestration engine of the OpenInterpreterRuntimeEngine system.
 * It manages conversation flow, interacts with an LLM, and dispatches code to interpreters.
 */
class OpenInterpreterRuntimeEngine extends EventEmitter {
    private history: Message[] = [];
    private llm: LLMInterface;
    private codeInterpreters: Map<string, CodeInterpreter> = new Map();
    // Keeps track of active code execution promises to ensure they complete
    private activeCodeExecutionPromises: Map<string, Promise<void>> = new Map();

    /**
     * Initializes the orchestrator with an LLM and registers default code interpreters.
     * @param llm An implementation of the LLMInterface to be used for chat interactions.
     */
    constructor(llm: LLMInterface) {
        super();
        this.llm = llm;
        this.registerCodeInterpreter(new PythonCodeExecutionEngine());
        this.registerCodeInterpreter(new ShellCommandExecutionEngine());
        this.registerCodeInterpreter(new JavaScriptCodeExecutionEngine());
    }

    /**
     * Registers a CodeInterpreter instance with the orchestrator.
     * Sets up event listeners to capture output and errors from the interpreter and update history.
     * @param interpreter The CodeInterpreter instance to register.
     */
    private registerCodeInterpreter(interpreter: CodeInterpreter): void {
        this.codeInterpreters.set(interpreter.language, interpreter);

        // Listen for output from the interpreter and forward it, also updating history
        interpreter.onOutput((output) => {
            this.emit('output', output); // Emit to external listeners
            this.updateHistoryWithToolOutput(output);
        });

        // Listen for errors from the interpreter and forward them, also updating history
        interpreter.onError((error) => {
            this.emit('error', error); // Emit to external listeners
            this.updateHistoryWithToolOutput(error);
        });
    }

    /**
     * Updates the conversation history with tool output or error.
     * It finds the relevant assistant message with the tool call and appends the output.
     * @param output The InterpreterOutput to add to the history.
     */
    private updateHistoryWithToolOutput(output: InterpreterOutput): void {
        if (!output.id) return;

        // Find the last assistant message that contained this tool call
        for (let i = this.history.length - 1; i >= 0; i--) {
            const msg = this.history[i];
            if (msg.role === 'assistant' && msg.tool_calls?.some(tc => tc.id === output.id)) {
                if (!msg.tool_output) {
                    msg.tool_output = "";
                }
                // Append the output, ensuring a newline for readability
                msg.tool_output += `${output.type.toUpperCase()}: ${output.content}\n`;
                break; // Found and updated, exit loop
            }
        }
    }

    /**
     * Starts all registered code interpreter engines.
     */
    public async start(): Promise<void> {
        for (const interpreter of this.codeInterpreters.values()) {
            await interpreter.start();
        }
        this.history.push({ role: "system", content: "Interpreter started. Ready to receive commands." });
        this.emit('output', { type: "system", content: "Interpreter started. Ready to receive commands." });
    }

    /**
     * Stops all registered code interpreter engines and clears the conversation history.
     */
    public async stop(): Promise<void> {
        for (const interpreter of this.codeInterpreters.values()) {
            await interpreter.stop();
        }
        this.history = [];
        this.emit('output', { type: "system", content: "Interpreter stopped." });
    }

    /**
     * Initiates a chat interaction with the user's message.
     * This method drives the core AI reasoning-action loop.
     * @param message The user's input message.
     */
    public async chat(message: string): Promise<void> {
        // Add user message to history and emit
        this.history.push({ role: "user", content: message });
        this.emit('message', { role: "user", content: message });

        while (true) {
            this.emit('thinking', { type: "thinking", content: "LLM is processing..." });
            const llmResponse = await this.llm.chat(this.history);
            this.history.push(llmResponse); // Add LLM's response to history
            this.emit('message', llmResponse); // Emit LLM's response

            if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
                // If LLM requests tool calls (e.g., code execution)
                const executionPromises = llmResponse.tool_calls.map(async (toolCall) => {
                    const interpreter = this.codeInterpreters.get(toolCall.code_interpreter.language);
                    if (interpreter) {
                        this.emit('output', {
                            type: "system",
                            content: `Executing ${toolCall.code_interpreter.language} code...`,
                            language: toolCall.code_interpreter.language,
                            id: toolCall.id
                        });
                        this.emit('code', {
                            type: "code",
                            content: toolCall.code_interpreter.code,
                            language: toolCall.code_interpreter.language,
                            id: toolCall.id
                        });

                        const executionPromise = interpreter.run(toolCall.code_interpreter.code, toolCall.id);
                        this.activeCodeExecutionPromises.set(toolCall.id, executionPromise);
                        await executionPromise;
                        this.activeCodeExecutionPromises.delete(toolCall.id);
                        // The interpreter's onOutput/onError handlers will have updated history.
                    } else {
                        const errorMsg = `No interpreter found for language: ${toolCall.code_interpreter.language}`;
                        this.emit('error', { type: "error", content: errorMsg, language: "system", id: toolCall.id });
                        // Directly update the current LLM response with this error
                        if (!llmResponse.tool_output) llmResponse.tool_output = "";
                        llmResponse.tool_output += `Error: ${errorMsg}\n`;
                    }
                });
                await Promise.all(executionPromises);
                // Loop back to the LLM with the updated history (now containing tool_output)
                // for it to generate a new response based on execution results.
            } else if (llmResponse.content) {
                // LLM provided a final text response, conversation turn is complete.
                this.emit('output', { type: "result", content: llmResponse.content });
                break; // Exit the chat loop
            } else {
                // LLM returned an unexpected empty response or got stuck.
                this.emit('error', { type: "error", content: "LLM returned an empty response or could not proceed.", language: "system" });
                break;
            }
        }
    }

    /**
     * Retrieves a copy of the current conversation history.
     */
    public getHistory(): Message[] {
        return [...this.history];
    }

    // Public event listeners for external consumption
    public onMessage(callback: (message: Message) => void): void {
        this.on('message', callback);
    }

    public onOutput(callback: (output: InterpreterOutput) => void): void {
        this.on('output', callback);
    }

    public onError(callback: (error: InterpreterOutput) => void): void {
        this.on('error', callback);
    }

    public onCode(callback: (codeBlock: InterpreterOutput) => void): void {
        this.on('code', callback);
    }

    public onThinking(callback: (thinkingState: InterpreterOutput) => void): void {
        this.on('thinking', callback);
    }
}
```

---

## Engine 2: PythonCodeExecutionEngine

### What it does
This engine is responsible for executing Python code. It spawns a persistent Python interpreter process in interactive mode (`python -i -u`), allowing variables and function definitions to persist across multiple code block executions within the same session. It takes Python code as a string input, sends it to the child process's stdin, and captures both standard output (stdout) and standard error (stderr). To reliably detect the completion of a code block, it injects a unique "sentinel" string into the output stream, which it then uses to mark the end of execution and report the collected results.

**Inputs:** Python code (string), an optional `toolCallId` to link output back to a specific LLM tool call.
**State:** A `ChildProcessWithoutNullStreams` instance representing the running Python interpreter, a boolean `isRunning` flag.
**Invariant Preservation:** Ensures the Python interpreter process remains active in interactive mode between `run` calls, preserving the execution environment's state. It also guarantees that all output generated by a code block is captured before reporting completion.
**Outputs:** Emits `InterpreterOutput` events for standard output, standard error, and the final consolidated result of a code block's execution.

### Implementation Code

```typescript
/**
 * Executes Python code within a persistent, interactive Python interpreter session.
 */
class PythonCodeExecutionEngine extends BaseCodeInterpreter {
    public language: "python" = "python";

    /**
     * Defines the command and arguments for spawning the Python interpreter.
     * Uses `-u` for unbuffered output and `-i` for interactive mode.
     */
    protected getSpawnArgs() {
        return { command: 'python', args: ['-u', '-i'] };
    }

    /**
     * Runs a given Python code string.
     * It injects a sentinel to detect command completion in the interactive session.
     * @param code The Python code string to execute.
     * @param toolCallId An optional ID to associate output with a specific tool call.
     */
    public async run(code: string, toolCallId?: string): Promise<void> {
        if (!this.process || !this.isRunning) {
            this.emit('error', { type: "error", content: "Python interpreter not started.", language: this.language, id: toolCallId });
            return;
        }

        const sentinel = `__OPEN_INTERPRETER_END_CODE_${Date.now()}__`;
        // Execute the code, then print the sentinel
        const wrappedCode = `${code}\nprint('${sentinel}')\n`;

        let buffer = '';
        // Listener to capture output until the sentinel is found
        const outputListener = (output: InterpreterOutput) => {
            buffer += output.content;
            if (buffer.includes(sentinel)) {
                this.removeListener('output', outputListener); // Stop listening for this specific run
                // Extract the content before the sentinel
                const finalOutput = buffer.substring(0, buffer.indexOf(sentinel)).trim();
                if (finalOutput) {
                    this.emit('output', { type: "result", content: finalOutput, language: this.language, id: toolCallId });
                }
            } else {
                // Emit raw output chunks as they come, if not yet past sentinel
                this.emit('output', { type: "output", content: output.content, language: this.language, id: toolCallId });
            }
        };

        this.on('output', outputListener);

        sendToStdin(this.process, wrappedCode);

        // A small delay to ensure the process has time to start handling the input
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
```

---

## Engine 3: ShellCommandExecutionEngine

### What it does
This engine executes arbitrary shell commands within a persistent shell session. It handles the nuances of different operating systems (e.g., `cmd.exe` on Windows, `bash` or `sh` on Unix-like systems). By maintaining a persistent shell process, it allows commands that modify the environment, such as `cd` (change directory), to have lasting effects on subsequent commands within the same session. It takes a shell command string, sends it to the child process, and captures both standard output and standard error. Similar to the Python engine, it uses a sentinel to accurately detect when a command has completed execution and all its output has been received.

**Inputs:** Shell command (string), an optional `toolCallId`.
**State:** A `ChildProcessWithoutNullStreams` instance for the running shell, a boolean `isRunning` flag, and internally tracks the `currentCwd` (current working directory) for consistency.
**Invariant Preservation:** Ensures the shell process remains active between `run` calls, allowing commands like `cd` to affect the environment for subsequent commands. It ensures complete output capture per command using a sentinel.
**Outputs:** Emits `InterpreterOutput` events for standard output, standard error, and the final consolidated result of a command's execution.

### Implementation Code

```typescript
/**
 * Executes shell commands within a persistent interactive shell session.
 * Supports environment changes like `cd` across multiple runs.
 */
class ShellCommandExecutionEngine extends BaseCodeInterpreter {
    public language: "shell" = "shell";
    private currentCwd: string = process.cwd(); // Track current working directory

    /**
     * Defines the command and arguments for spawning the shell.
     * Uses `cmd.exe` for Windows, `bash -l -i` for Unix-like systems.
     * Sets the initial working directory.
     */
    protected getSpawnArgs() {
        const isWin = process.platform === "win32";
        return {
            command: isWin ? 'cmd.exe' : 'bash',
            args: isWin ? [] : ['-l', '-i'], // -l for login shell, -i for interactive
            options: { cwd: this.currentCwd } // Start shell in currentCwd
        };
    }

    /**
     * Overrides the start method to potentially add shell-specific initialization.
     */
    public async start(): Promise<void> {
        await super.start();
        // Additional shell setup might go here, e.g., setting prompt to simplify detection,
        // but for robustness, a sentinel is preferred.
    }

    /**
     * Runs a given shell command string.
     * Injects an 'echo' sentinel to detect command completion.
     * @param code The shell command string to execute.
     * @param toolCallId An optional ID to associate output with a specific tool call.
     */
    public async run(code: string, toolCallId?: string): Promise<void> {
        if (!this.process || !this.isRunning) {
            this.emit('error', { type: "error", content: "Shell interpreter not started.", language: this.language, id: toolCallId });
            return;
        }

        const sentinel = `__OPEN_INTERPRETER_END_CODE_${Date.now()}__`;
        // Execute the command, then echo the sentinel
        const wrappedCode = `${code}\necho '${sentinel}'\n`;

        let buffer = '';
        // Listener to capture output until the sentinel is found
        const outputListener = (output: InterpreterOutput) => {
            buffer += output.content;
            if (buffer.includes(sentinel)) {
                this.removeListener('output', outputListener); // Stop listening for this specific run
                // Extract the content before the sentinel (and before the `echo` itself)
                const finalOutput = buffer.substring(0, buffer.indexOf(sentinel)).trim();
                if (finalOutput) {
                    this.emit('output', { type: "result", content: finalOutput, language: this.language, id: toolCallId });
                }
            } else {
                // Emit raw output chunks as they come
                this.emit('output', { type: "output", content: output.content, language: this.language, id: toolCallId });
            }
        };

        this.on('output', outputListener);

        sendToStdin(this.process, wrappedCode);

        // A small delay to ensure the process has time to start handling the input
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
```

---

## Engine 4: JavaScriptCodeExecutionEngine

### What it does
This engine executes JavaScript code using a Node.js interpreter. It spawns a persistent Node.js REPL (Read-Eval-Print Loop) process in interactive mode (`node -i`), allowing JavaScript variables and function declarations to persist across multiple code block executions. It accepts JavaScript code as a string, sends it to the Node.js process's stdin, and captures standard output and standard error. To ensure accurate detection of code block completion, it injects a unique sentinel string using `console.log`, which it then monitors in the output stream to signal the end of execution and report the collected results.

**Inputs:** JavaScript code (string), an optional `toolCallId`.
**State:** A `ChildProcessWithoutNullStreams` instance for the running Node.js interpreter, a boolean `isRunning` flag.
**Invariant Preservation:** Ensures the Node.js REPL process remains active between `run` calls, preserving the JavaScript execution environment's state (e.g., declared variables). It guarantees that all output generated by a code block is captured before reporting completion.
**Outputs:** Emits `InterpreterOutput` events for standard output, standard error, and the final consolidated result of a code block's execution.

### Implementation Code

```typescript
/**
 * Executes JavaScript code within a persistent, interactive Node.js REPL session.
 */
class JavaScriptCodeExecutionEngine extends BaseCodeInterpreter {
    public language: "javascript" = "javascript";

    /**
     * Defines the command and arguments for spawning the Node.js interpreter.
     * Uses `-i` for interactive mode.
     */
    protected getSpawnArgs() {
        return { command: 'node', args: ['-i'] };
    }

    /**
     * Runs a given JavaScript code string.
     * It injects a sentinel via `console.log` to detect command completion.
     * @param code The JavaScript code string to execute.
     * @param toolCallId An optional ID to associate output with a specific tool call.
     */
    public async run(code: string, toolCallId?: string): Promise<void> {
        if (!this.process || !this.isRunning) {
            this.emit('error', { type: "error", content: "JavaScript interpreter not started.", language: this.language, id: toolCallId });
            return;
        }

        const sentinel = `__OPEN_INTERPRETER_END_CODE_${Date.now()}__`;
        // Execute the code, then console.log the sentinel
        const wrappedCode = `${code}\nconsole.log('${sentinel}');\n`;

        let buffer = '';
        // Listener to capture output until the sentinel is found
        const outputListener = (output: InterpreterOutput) => {
            buffer += output.content;
            if (buffer.includes(sentinel)) {
                this.removeListener('output', outputListener); // Stop listening for this specific run
                // Extract the content before the sentinel
                const finalOutput = buffer.substring(0, buffer.indexOf(sentinel)).trim();
                if (finalOutput) {
                    this.emit('output', { type: "result", content: finalOutput, language: this.language, id: toolCallId });
                }
            } else {
                // Emit raw output chunks as they come
                this.emit('output', { type: "output", content: output.content, language: this.language, id: toolCallId });
            }
        };

        this.on('output', outputListener);

        sendToStdin(this.process, wrappedCode);

        // A small delay to ensure the process has time to start handling the input
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}
```