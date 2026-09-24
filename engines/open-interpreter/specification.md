This document details the core runtime engines identified within the OpenInterpreterRuntimeEngine project, originally hosted by KillianLucas. The analysis focuses on isolating the operational components responsible for executing code and orchestrating conversational interactions, abstracting away proprietary naming and branding.

---

## Engine 1: Code Execution Engine

### What it does

The Code Execution Engine is responsible for managing and executing code snippets in various programming languages (Python, JavaScript, and Shell). It provides an isolated, persistent execution environment for each supported language, allowing variables, functions, and session state to be maintained across multiple code submissions.

**Key responsibilities and features:**
*   **Language-Specific Sessions**: It maintains separate, long-running processes for each language (e.g., a Python interpreter, a Node.js runtime, a shell instance).
*   **Persistent State**: For Python and JavaScript, the engine ensures that code executed in one call affects the environment for subsequent calls within the same session (e.g., declared variables remain accessible).
*   **Input/Output Handling**: It accepts code as input, executes it, and captures all standard output (stdout), standard error (stderr), and results.
*   **Structured Communication**: It communicates with the language-specific runtime processes using a JSON-based protocol over standard input/output streams, allowing for structured code submission and result retrieval.
*   **Error Reporting**: Catches and reports execution errors, including exceptions and non-zero exit codes.
*   **Interruption/Termination**: Provides mechanisms to interrupt currently running code or stop a language session entirely.

**Inputs:**
*   `language`: A string specifying the target language ("python", "javascript", "shell").
*   `code`: A string containing the code snippet to be executed.
*   `action`: An action type ("execute", "interrupt", "stop").

**State Lifecycle:**
1.  **Start Session**: A new process is spawned for the specified language. For Python and JavaScript, a lightweight client script is run within this process to facilitate JSON communication and persistent context management.
2.  **Execute Code**: Code is sent to the active session.
3.  **Output Capture**: The session captures all output until execution completes.
4.  **Error Handling**: If an error occurs during execution, it's captured and returned.
5.  **Stop Session**: The language process is terminated.

**Invariant Preservation:**
*   Each language session maintains its independent execution context, preventing cross-language state leakage.
*   The communication protocol ensures consistent parsing of inputs and outputs.
*   Errors during code execution are isolated and reported without crashing the engine itself.

**Outputs:**
*   A string containing the combined standard output and error from the executed code.
*   Error messages if execution fails.

### Implementation Code

```typescript
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Interface for a language-specific execution session.
 * Manages a child process and its communication protocol.
 */
interface ILanguageSession {
    /** The language this session is for. */
    readonly language: string;
    /** Starts the underlying process for the session. */
    start(): Promise<void>;
    /** Executes a given code string within the session. */
    execute(code: string): Promise<string>;
    /** Sends an interrupt signal to the running code, if supported. */
    interrupt(): Promise<void>;
    /** Stops and cleans up the session's process. */
    stop(): Promise<void>;
    /** Returns true if the session is currently active/running. */
    isActive(): boolean;
}

/**
 * Base class for common session management.
 */
abstract class BaseLanguageSession extends EventEmitter implements ILanguageSession {
    public readonly language: string;
    protected process: ChildProcessWithoutNullStreams | null = null;
    protected outputBuffer: string[] = [];
    protected isActiveSession: boolean = false;
    protected currentExecutionPromise: { resolve: (value: string) => void; reject: (reason?: any) => void } | null = null;

    constructor(language: string) {
        super();
        this.language = language;
    }

    public abstract start(): Promise<void>;

    public abstract execute(code: string): Promise<string>;

    public async interrupt(): Promise<void> {
        if (this.process && !this.process.killed) {
            // A more robust interrupt might send a specific signal or message
            // For now, we'll terminate the current process and restart, or just kill.
            // This behavior depends on the client script's interrupt handling.
            this.emit('log', `[${this.language}]: Attempting to interrupt process.`);
            this.process.kill('SIGINT'); // Send interrupt signal
            if (this.currentExecutionPromise) {
                this.currentExecutionPromise.reject(new Error(`[${this.language}]: Execution interrupted.`));
                this.currentExecutionPromise = null;
            }
            await this.stop(); // Stop and potentially restart for clean state
            await this.start();
        }
    }

    public async stop(): Promise<void> {
        if (this.process && !this.process.killed) {
            this.emit('log', `[${this.language}]: Stopping process.`);
            this.process.kill('SIGKILL'); // Force kill
        }
        this.process = null;
        this.isActiveSession = false;
        this.outputBuffer = [];
        if (this.currentExecutionPromise) {
            this.currentExecutionPromise.reject(new Error(`[${this.language}]: Session stopped during execution.`));
            this.currentExecutionPromise = null;
        }
    }

    public isActive(): boolean {
        return this.isActiveSession;
    }

    protected setupProcess(process: ChildProcessWithoutNullStreams): void {
        this.process = process;
        this.isActiveSession = true;
        this.outputBuffer = [];

        this.process.stdout.on('data', (data) => {
            const chunk = data.toString();
            this.outputBuffer.push(chunk);
            this.emit('output', { language: this.language, type: 'stdout', value: chunk });
        });

        this.process.stderr.on('data', (data) => {
            const chunk = data.toString();
            this.outputBuffer.push(chunk); // Often stderr is also part of "output" for LLM
            this.emit('output', { language: this.language, type: 'stderr', value: chunk });
        });

        this.process.on('close', (code) => {
            this.emit('log', `[${this.language}]: Process exited with code ${code}.`);
            this.isActiveSession = false;
            if (this.currentExecutionPromise) {
                this.currentExecutionPromise.reject(
                    new Error(`[${this.language}]: Process exited unexpectedly with code ${code}. Output: ${this.outputBuffer.join('')}`)
                );
                this.currentExecutionPromise = null;
            }
        });

        this.process.on('error', (err) => {
            this.emit('log', `[${this.language}]: Process error: ${err.message}`);
            this.isActiveSession = false;
            if (this.currentExecutionPromise) {
                this.currentExecutionPromise.reject(err);
                this.currentExecutionPromise = null;
            }
        });
    }

    protected waitForOutputEnd(resolve: (value: string) => void, reject: (reason?: any) => void): void {
        // Implement specific logic for each client to detect end of output,
        // often via a specific marker or by listening for the "output" message type.
        // This base method is a placeholder; derived classes must implement.
        // For simplicity here, we resolve after a short delay or when process exits.
        // A robust solution involves parsing JSON responses from the client script.
    }
}

/**
 * Python client script injected into the Python interpreter.
 * It manages persistent state and JSON communication.
 */
const pythonClientScript = `
import json
import sys
import os
import io
import traceback

# This dictionary holds the global state (variables, functions)
_global_vars = {}
# Initialize with some common built-ins
_global_vars['__builtins__'] = __builtins__

# Redirect stdout/stderr to an in-memory buffer
class CodeOutputBuffer(io.StringIO):
    def write(self, s):
        sys.__stdout__.write(s) # Also write to actual stdout for debugging
        super().write(s)

# Function to execute code and capture output
def execute_code_in_context(code_string):
    global _global_vars
    
    # Temporarily redirect stdout and stderr
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = sys.stderr = CodeOutputBuffer()

    try:
        exec(code_string, _global_vars)
        output_value = sys.stdout.getvalue()
    except Exception as e:
        output_value = sys.stdout.getvalue() + traceback.format_exc()
        sys.__stdout__.write(f"\\nError during execution:\\n{output_value}\\n")
        # Do not exit; send error back to parent
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr
    
    return output_value.strip()

if __name__ == "__main__":
    # Ensure stdout/stderr are unbuffered for real-time communication
    sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', 1, encoding='utf-8')
    sys.stderr = os.fdopen(sys.stderr.fileno(), 'w', 1, encoding='utf-8')

    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break # EOF, parent process terminated
            
            message = json.loads(line)
            
            if message["type"] == "code":
                code = message["code"]
                output = execute_code_in_context(code)
                response = {"type": "output", "value": output}
                sys.stdout.write(json.dumps(response) + "\\n")
                sys.stdout.flush()
            elif message["type"] == "interrupt":
                # In this simple client, interrupt is handled by process termination for now
                # A more complex setup would use signals or thread management within Python
                sys.stdout.write(json.dumps({"type": "message", "value": "Python interpreter interrupted."}) + "\\n")
                sys.stdout.flush()
                # A real interrupt might raise KeyboardInterrupt or similar, or just terminate this loop.
                # For robustness, we might exit, letting the parent restart a clean session.
                sys.exit(0)
            
        except json.JSONDecodeError:
            error_msg = f"Invalid JSON input: {line.strip()}"
            sys.stderr.write(json.dumps({"type": "error", "value": error_msg}) + "\\n")
            sys.stderr.flush()
        except Exception as e:
            error_msg = f"Python client internal error: {traceback.format_exc()}"
            sys.stderr.write(json.dumps({"type": "error", "value": error_msg}) + "\\n")
            sys.stderr.flush()
            # If a critical client error, exit to prevent further issues
            sys.exit(1)
`;

/**
 * Manages a persistent Python execution session.
 */
class PythonSession extends BaseLanguageSession {
    constructor() {
        super('python');
    }

    public async start(): Promise<void> {
        if (this.isActive()) {
            await this.stop(); // Ensure clean start
        }
        // Execute python with -u for unbuffered output and -c to run the client script directly.
        const proc = spawn('python', ['-u', '-c', pythonClientScript]);
        this.setupProcess(proc);
        // Wait for a ready signal from the client or just assume it's ready after a short delay
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for process to initialize
    }

    public async execute(code: string): Promise<string> {
        if (!this.process || !this.isActive()) {
            throw new Error(`[${this.language}]: Session not active. Call 'start()' first.`);
        }

        return new Promise((resolve, reject) => {
            this.currentExecutionPromise = { resolve, reject };
            this.outputBuffer = []; // Clear buffer for new execution

            const onData = (data: { language: string, type: string, value: string }) => {
                if (data.language === this.language && data.type === 'stdout') {
                    try {
                        const message = JSON.parse(data.value);
                        if (message.type === 'output') {
                            this.process?.stdout.off('output', onData); // Remove listener once we get the result
                            resolve(message.value);
                            this.currentExecutionPromise = null;
                        } else if (message.type === 'error') {
                            this.process?.stdout.off('output', onData);
                            reject(new Error(`[${this.language}]: Execution error: ${message.value}`));
                            this.currentExecutionPromise = null;
                        }
                    } catch (e) {
                        // Not JSON, just regular stdout data from the client script itself, or partial JSON.
                        // Accumulate and wait for a full JSON message.
                        // For robustness, this needs more careful parsing, potentially with a line buffer.
                    }
                }
            };

            this.process?.stdout.on('data', onData); // Listen for client's JSON output
            
            const message = JSON.stringify({ type: 'code', code: code });
            this.process?.stdin.write(message + '\n');
        });
    }

    protected setupProcess(process: ChildProcessWithoutNullStreams): void {
        super.setupProcess(process);
        // Custom stdout listener for PythonSession to parse JSON
        this.process.stdout.removeAllListeners('data'); // Remove base listener
        let lineBuffer = '';
        this.process.stdout.on('data', (data) => {
            lineBuffer += data.toString();
            let newlineIndex;
            while ((newlineIndex = lineBuffer.indexOf('\n')) !== -1) {
                const line = lineBuffer.substring(0, newlineIndex).trim();
                lineBuffer = lineBuffer.substring(newlineIndex + 1);
                if (line) {
                    try {
                        const parsed = JSON.parse(line);
                        this.emit('output', { language: this.language, type: 'stdout', value: line, parsed: parsed });
                        // If it's the final output, resolve the promise
                        if (this.currentExecutionPromise && parsed.type === 'output') {
                             this.currentExecutionPromise.resolve(parsed.value);
                             this.currentExecutionPromise = null;
                        } else if (this.currentExecutionPromise && parsed.type === 'error') {
                            this.currentExecutionPromise.reject(new Error(`[${this.language}]: Execution error: ${parsed.value}`));
                            this.currentExecutionPromise = null;
                        }
                    } catch (e) {
                        // Not JSON, or partial JSON. Treat as raw output.
                        this.emit('output', { language: this.language, type: 'stdout', value: line });
                    }
                }
            }
        });
    }
}

/**
 * JavaScript client script injected into the Node.js interpreter.
 * It manages persistent state using Node's `vm` module and JSON communication.
 */
const javascriptClientScript = `
const readline = require('readline');
const vm = require('vm');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

// Create a persistent VM context
const context = vm.createContext({});
// Make console accessible in the VM context
context.console = console;
// Expose common globals if needed, e.g., setTimeout, clearTimeout
context.setTimeout = setTimeout;
context.clearTimeout = clearTimeout;
context.setInterval = setInterval;
context.clearInterval = clearInterval;
context.process = {
    stdout: {
        write: (chunk) => {
            // Intercept console.log and other stdout from VM code
            if (typeof chunk === 'string') {
                vmStdoutBuffer += chunk;
            } else {
                vmStdoutBuffer += String(chunk);
            }
        }
    }
};

let vmStdoutBuffer = ''; // Buffer for output from vm.runInContext

rl.on('line', (line) => {
    try {
        const message = JSON.parse(line);

        if (message.type === 'code') {
            const code = message.code;
            vmStdoutBuffer = ''; // Clear buffer for new execution

            let output = '';
            try {
                // Execute code in the persistent context
                const result = vm.runInContext(code, context, {
                    displayErrors: true,
                    filename: 'vm-script.js'
                });
                
                output = vmStdoutBuffer; // Capture anything written to context.process.stdout
                if (result !== undefined) {
                    output += String(result); // Append the explicit return value
                }
            } catch (e) {
                output = vmStdoutBuffer + (e.stack || e.message || String(e));
            } finally {
                vmStdoutBuffer = ''; // Clear buffer after capturing
            }

            process.stdout.write(JSON.stringify({ type: 'output', value: output.trim() }) + '\\n');
        } else if (message.type === 'interrupt') {
            process.stdout.write(JSON.stringify({ type: 'message', value: 'JavaScript interpreter interrupted.' }) + '\\n');
            process.exit(0); // Exit for a clean restart
        }
    } catch (e) {
        process.stderr.write(JSON.stringify({ type: 'error', value: 'JavaScript client internal error: ' + (e.stack || e.message || String(e)) }) + '\\n');
    }
});

rl.on('close', () => {
    process.exit(0);
});
`;

/**
 * Manages a persistent JavaScript execution session using Node.js.
 */
class JavaScriptSession extends PythonSession { // Reusing PythonSession's structured communication for JS
    constructor() {
        super();
        this.language = 'javascript';
    }

    public async start(): Promise<void> {
        if (this.isActive()) {
            await this.stop();
        }
        // Execute node with -e to run the client script directly.
        // Node's stdin/stdout are unbuffered by default, which is good.
        const proc = spawn('node', ['-e', javascriptClientScript]);
        this.setupProcess(proc);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for process to initialize
    }
}

/**
 * Manages a simple shell command execution.
 * Shell commands are typically ephemeral and don't maintain a persistent state
 * across executions in the same way Python/JS do. Each command runs in a new subshell.
 */
class ShellSession extends BaseLanguageSession {
    constructor() {
        super('shell');
    }

    public async start(): Promise<void> {
        // For shell, we don't start a long-running client.
        // Each `execute` call will spawn a new process.
        this.isActiveSession = true; // Mark as active, though no background process runs
        this.emit('log', `[${this.language}]: Shell session started (on-demand execution).`);
    }

    public async execute(code: string): Promise<string> {
        if (!this.isActive()) {
            throw new Error(`[${this.language}]: Session not active. Call 'start()' first.`);
        }

        return new Promise((resolve, reject) => {
            this.outputBuffer = []; // Clear buffer for new execution

            // For shell, just execute the command directly
            const proc = spawn('bash', ['-c', code]);
            let combinedOutput = '';

            proc.stdout.on('data', (data) => {
                combinedOutput += data.toString();
                this.emit('output', { language: this.language, type: 'stdout', value: data.toString() });
            });

            proc.stderr.on('data', (data) => {
                combinedOutput += data.toString();
                this.emit('output', { language: this.language, type: 'stderr', value: data.toString() });
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(combinedOutput.trim());
                } else {
                    reject(new Error(`Shell command exited with code ${code}. Output: ${combinedOutput.trim()}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start shell process: ${err.message}`));
            });
        });
    }

    public async interrupt(): Promise<void> {
        // Since shell commands are short-lived, interrupt usually means killing the currently running one.
        // If an execution is in progress (i.e., `currentExecutionPromise` is set), try to kill its process.
        this.emit('log', `[${this.language}]: Interrupt not directly supported for shell in this model, terminating current command if any.`);
        // For actual running commands, you'd need to keep track of the spawned `proc` for each execute call.
        // Given that each `execute` is a new process, the "interrupt" effectively just cancels the promise.
        if (this.currentExecutionPromise) {
            this.currentExecutionPromise.reject(new Error(`[${this.language}]: Shell command interrupted.`));
            this.currentExecutionPromise = null;
        }
    }

    public async stop(): Promise<void> {
        this.isActiveSession = false;
        this.emit('log', `[${this.language}]: Shell session stopped.`);
        if (this.currentExecutionPromise) {
            this.currentExecutionPromise.reject(new Error(`[${this.language}]: Session stopped during execution.`));
            this.currentExecutionPromise = null;
        }
    }
}

/**
 * The main Code Execution Engine orchestrating different language sessions.
 */
export class CodeExecutionEngine {
    private sessions: Map<string, ILanguageSession> = new Map();
    private readonly availableLanguages: string[] = ['python', 'javascript', 'shell'];

    constructor() {
        this.initializeSessions();
    }

    private initializeSessions(): void {
        this.sessions.set('python', new PythonSession());
        this.sessions.set('javascript', new JavaScriptSession());
        this.sessions.set('shell', new ShellSession());
    }

    /**
     * Starts a session for a given language.
     * @param language The language to start ('python', 'javascript', 'shell').
     */
    public async startSession(language: string): Promise<void> {
        const session = this.sessions.get(language);
        if (!session) {
            throw new Error(`Unsupported language: ${language}`);
        }
        if (!session.isActive()) {
            await session.start();
            console.log(`[CodeExecutionEngine]: ${language} session started.`);
        } else {
            console.log(`[CodeExecutionEngine]: ${language} session already active.`);
        }
    }

    /**
     * Executes code in a specified language session.
     * @param language The language to use.
     * @param code The code string to execute.
     * @returns A promise that resolves with the output of the code execution.
     */
    public async executeCode(language: string, code: string): Promise<string> {
        const session = this.sessions.get(language);
        if (!session) {
            throw new Error(`Unsupported language: ${language}`);
        }
        if (!session.isActive()) {
            await this.startSession(language); // Auto-start if not active
        }
        console.log(`[CodeExecutionEngine]: Executing ${language} code:\n${code}`);
        try {
            const output = await session.execute(code);
            console.log(`[CodeExecutionEngine]: ${language} output:\n${output}`);
            return output;
        } catch (error: any) {
            console.error(`[CodeExecutionEngine]: ${language} execution error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Interrupts the execution in a specified language session.
     * @param language The language session to interrupt.
     */
    public async interruptSession(language: string): Promise<void> {
        const session = this.sessions.get(language);
        if (!session || !session.isActive()) {
            console.warn(`[CodeExecutionEngine]: No active ${language} session to interrupt.`);
            return;
        }
        await session.interrupt();
        console.log(`[CodeExecutionEngine]: ${language} session interrupted.`);
    }

    /**
     * Stops and cleans up a session for a given language.
     * @param language The language to stop.
     */
    public async stopSession(language: string): Promise<void> {
        const session = this.sessions.get(language);
        if (!session || !session.isActive()) {
            console.warn(`[CodeExecutionEngine]: No active ${language} session to stop.`);
            return;
        }
        await session.stop();
        console.log(`[CodeExecutionEngine]: ${language} session stopped.`);
    }

    /**
     * Stops all active language sessions.
     */
    public async stopAllSessions(): Promise<void> {
        const stopPromises = Array.from(this.sessions.values()).map(session => session.stop());
        await Promise.allSettled(stopPromises);
        console.log('[CodeExecutionEngine]: All sessions stopped.');
    }
}
```

---

## Engine 2: Interaction Orchestration Engine

### What it does

The Interaction Orchestration Engine manages the entire conversational flow within the OpenInterpreterRuntimeEngine. It acts as the central coordinator, mediating between user input, an external Language Model (LLM), and the Code Execution Engine. Its primary role is to interpret and respond to user requests, deciding whether to generate a natural language reply or to execute code via the Code Execution Engine based on the LLM's directives.

**Key responsibilities and features:**
*   **Conversational State Management**: Maintains a chronological history of messages, including user input, LLM responses, code snippets, and code outputs (observations).
*   **LLM Integration**: Interacts with an external LLM (abstracted by the `LLMClient` interface) by feeding it the conversation history and receiving its responses.
*   **Response Interpretation**: Parses the LLM's output to determine if it's natural language to be displayed to the user or a structured request to execute code. It supports extracting code blocks (e.g., Python, JavaScript, Shell) from LLM-generated text.
*   **Code Execution Delegation**: When the LLM requests code execution, it delegates the task to the Code Execution Engine, passing the extracted code and language.
*   **Observation Feedback Loop**: Takes the output (observation) from the Code Execution Engine and feeds it back into the conversation history, making it available to the LLM for subsequent turns.
*   **Turn-Based Processing**: Manages the iterative nature of the conversation, processing one message at a time and yielding intermediate results (like code execution requests or LLM thoughts) as an asynchronous generator.
*   **Lifecycle Management**: Initializes and manages the lifecycle of the Code Execution Engine.

**Inputs:**
*   `input`: A string representing the user's message.
*   `LLMClient`: An implementation of an external language model client.
*   `CodeExecutionEngine`: An instance of the Code Execution Engine.

**State Lifecycle:**
1.  **Initialization**: The engine starts with an empty message history and initializes the Code Execution Engine.
2.  **User Input**: A user message is received and added to the history.
3.  **LLM Query**: The entire message history is sent to the LLM.
4.  **LLM Response Processing**: The LLM's response is parsed.
    *   If text, it's added to history and yielded as output.
    *   If code, it's added to history as a "tool_code" message, delegated to the Code Execution Engine.
5.  **Code Execution & Observation**: The Code Execution Engine runs the code. Its output is captured, added to history as a "tool_output" message (observation), and the process loops back to "LLM Query" (the LLM receives the observation).
6.  **Loop Termination**: The loop continues until the LLM produces a final text response or a specific termination condition is met.

**Invariant Preservation:**
*   Conversation history is always maintained in chronological order.
*   All LLM interactions and code executions are recorded within the history.
*   The system always attempts to process LLM-generated code, feeding back observations.

**Outputs:**
*   An asynchronous generator yielding `Message` objects representing each step of the interaction (LLM thoughts, code execution requests, code outputs, final natural language responses).

### Implementation Code

```typescript
import { CodeExecutionEngine } from './CodeExecutionEngine'; // Assuming CodeExecutionEngine is in a separate file

/**
 * Represents a single message in the conversation history.
 */
export interface Message {
    role: "user" | "assistant" | "tool"; // 'assistant' for LLM, 'user' for human, 'tool' for code execution/output
    content?: string; // Natural language content or LLM's thoughts
    tool_code?: { language: string, code: string }; // For assistant's tool calls (code to execute)
    tool_output?: string; // For tool's output (observation from code execution)
}

/**
 * Abstract interface for an external Language Model client.
 * Replace with actual LLM client integration (e.g., OpenAI API, local LLM).
 */
export interface LLMClient {
    /**
     * Generates a response from the LLM based on the provided conversation history.
     * @param messages The current conversation history.
     * @returns A promise resolving to the LLM's generated message.
     */
    generate(messages: Message[]): Promise<Message>;
}

/**
 * Dummy LLM client for demonstration purposes.
 * It simulates an LLM that can generate text and simple code blocks.
 */
class DummyLLMClient implements LLMClient {
    private turn = 0;

    async generate(messages: Message[]): Promise<Message> {
        // Simulate LLM latency
        await new Promise(resolve => setTimeout(resolve, 500));

        // Simple logic to simulate LLM behavior
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase();

        if (!lastUserMessage) {
            return { role: 'assistant', content: "Hello! How can I help you today?" };
        }

        if (lastUserMessage.includes('hello')) {
            return { role: 'assistant', content: "Hi there! I'm an AI assistant. What can I do for you?" };
        }

        if (lastUserMessage.includes('time in python')) {
            this.turn++;
            if (this.turn === 1) {
                return {
                    role: 'assistant',
                    content: "I can help with that. Here's a Python script to get the current time:\n\n```python\nimport datetime\nprint(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'))\n```"
                };
            } else if (this.turn === 2 && messages.some(m => m.tool_output && m.tool_output.includes('20'))) { // Assuming a time output
                this.turn = 0; // Reset
                return { role: 'assistant', content: `The current time according to Python is: ${messages.filter(m => m.tool_output).pop()?.tool_output}. Is there anything else?` };
            }
        }
        
        if (lastUserMessage.includes('sum in js')) {
            this.turn++;
            if (this.turn === 1) {
                return {
                    role: 'assistant',
                    content: "Sure, I can execute JavaScript. Here's a simple sum:\n\n```javascript\nlet a = 10;\nlet b = 20;\nconsole.log('The sum is:', a + b);\n```"
                };
            } else if (this.turn === 2 && messages.some(m => m.tool_output && m.tool_output.includes('The sum is: 30'))) {
                this.turn = 0;
                return { role: 'assistant', content: `The JavaScript interpreter returned: ${messages.filter(m => m.tool_output).pop()?.tool_output}. Anything else?` };
            }
        }

        if (lastUserMessage.includes('list files')) {
             this.turn++;
             if (this.turn === 1) {
                return {
                    role: 'assistant',
                    content: "I can list files in the current directory using a shell command.\n\n```shell\nls -l\n```"
                };
            } else if (this.turn === 2 && messages.some(m => m.tool_output && m.tool_output.includes('total'))) { // Typical ls -l output
                this.turn = 0;
                return { role: 'assistant', content: `Here's what I found in the current directory:\n${messages.filter(m => m.tool_output).pop()?.tool_output}\nWhat's next?` };
            }
        }

        if (lastUserMessage.includes('exit') || lastUserMessage.includes('bye')) {
            return { role: 'assistant', content: "Goodbye! It was a pleasure assisting you." };
        }

        return { role: 'assistant', content: `I received your message: "${lastUserMessage}". I'm not sure how to respond to that, could you try asking about the time in Python or a sum in JS?` };
    }
}

/**
 * The core orchestration engine for OpenInterpreterRuntimeEngine.
 * Manages conversation flow, LLM interaction, and code execution.
 */
export class InteractionOrchestrationEngine {
    private messages: Message[] = [];
    private codeExecutor: CodeExecutionEngine;
    private llmClient: LLMClient;
    private readonly availableLanguages: string[] = ['python', 'javascript', 'shell'];

    constructor(llmClient: LLMClient = new DummyLLMClient(), codeExecutor?: CodeExecutionEngine) {
        this.llmClient = llmClient;
        this.codeExecutor = codeExecutor || new CodeExecutionEngine();
    }

    /**
     * Starts the code execution engine's sessions.
     */
    public async initialize(): Promise<void> {
        console.log("[InteractionOrchestrationEngine]: Initializing code execution sessions...");
        await Promise.all(this.availableLanguages.map(lang => this.codeExecutor.startSession(lang)));
        console.log("[InteractionOrchestrationEngine]: Code execution sessions initialized.");
    }

    /**
     * Clears the conversation history.
     */
    public reset(): void {
        this.messages = [];
        console.log("[InteractionOrchestrationEngine]: Conversation history reset.");
    }

    /**
     * Processes a user input and yields messages as the conversation progresses.
     * @param input The user's message.
     * @returns An AsyncGenerator yielding Message objects representing the interaction turns.
     */
    public async *chat(input: string): AsyncGenerator<Message, void, unknown> {
        this.messages.push({ role: 'user', content: input });
        yield this.messages[this.messages.length - 1]; // Yield user message

        while (true) {
            const llmResponse = await this.llmClient.generate(this.messages);
            this.messages.push(llmResponse);
            yield llmResponse; // Yield LLM's raw response (can be text or code instruction)

            if (llmResponse.content) {
                const codeBlocks = this.extractCodeBlocks(llmResponse.content);
                if (codeBlocks.length > 0) {
                    for (const block of codeBlocks) {
                        if (!this.availableLanguages.includes(block.language)) {
                            const errorMsg = `Unsupported language '${block.language}'. Available: ${this.availableLanguages.join(', ')}`;
                            const errorObservation: Message = { role: 'tool', tool_output: errorMsg };
                            this.messages.push(errorObservation);
                            yield errorObservation;
                            // Continue to LLM with error observation
                            continue;
                        }

                        const codeMessage: Message = { role: 'assistant', tool_code: block };
                        this.messages.push(codeMessage);
                        yield codeMessage; // Yield the code block as a tool call

                        let output: string;
                        try {
                            output = await this.codeExecutor.executeCode(block.language, block.code);
                        } catch (error: any) {
                            output = `Error during execution:\n${error.message || String(error)}`;
                        }

                        const observationMessage: Message = { role: 'tool', tool_output: output };
                        this.messages.push(observationMessage);
                        yield observationMessage; // Yield code output (observation)
                        // Loop will continue, LLM will see this observation
                    }
                    // If code was executed, the loop continues to feed observations back to LLM
                    continue;
                } else {
                    // LLM produced only text, no code. This is likely a final response.
                    // Check for explicit termination in LLM's response
                    if (llmResponse.content.toLowerCase().includes('goodbye') || llmResponse.content.toLowerCase().includes('exit')) {
                        console.log("[InteractionOrchestrationEngine]: LLM indicates conversation end.");
                        return; // Exit the generator
                    }
                    // Otherwise, LLM's text response is the final yield for this user turn.
                    return; // Exit the generator
                }
            } else if (llmResponse.tool_code) {
                // If LLM directly provides a tool_code (structured output)
                const block = llmResponse.tool_code;
                if (!this.availableLanguages.includes(block.language)) {
                    const errorMsg = `Unsupported language '${block.language}'. Available: ${this.availableLanguages.join(', ')}`;
                    const errorObservation: Message = { role: 'tool', tool_output: errorMsg };
                    this.messages.push(errorObservation);
                    yield errorObservation;
                    continue;
                }

                // LLM's tool_code is already represented by llmResponse. Yield it.
                // Yield the code block as a tool call
                yield llmResponse;

                let output: string;
                try {
                    output = await this.codeExecutor.executeCode(block.language, block.code);
                } catch (error: any) {
                    output = `Error during execution:\n${error.message || String(error)}`;
                }

                const observationMessage: Message = { role: 'tool', tool_output: output };
                this.messages.push(observationMessage);
                yield observationMessage;
                // Loop continues, LLM sees observation
                continue;

            } else {
                // LLM produced an empty or uninterpretable response.
                console.warn("[InteractionOrchestrationEngine]: LLM returned an empty or unhandled message type. Terminating turn.");
                return;
            }
        }
    }

    /**
     * Extracts code blocks from a markdown-formatted string.
     * @param text The text potentially containing code blocks.
     * @returns An array of objects, each with a language and the code content.
     */
    private extractCodeBlocks(text: string): { language: string, code: string }[] {
        const codeBlocks: { language: string, code: string }[] = [];
        const regex = /```(\w+)\n([\s\S]*?)```/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const language = match[1].toLowerCase();
            const code = match[2].trim();
            codeBlocks.push({ language, code });
        }
        return codeBlocks;
    }

    /**
     * Stops all active code execution engine sessions.
     */
    public async shutdown(): Promise<void> {
        console.log("[InteractionOrchestrationEngine]: Shutting down code execution sessions...");
        await this.codeExecutor.stopAllSessions();
        console.log("[InteractionOrchestrationEngine]: All sessions shut down.");
    }
}

// Example usage:
(async () => {
    console.log("Starting OpenInterpreterRuntimeEngine Demo...");
    const engine = new InteractionOrchestrationEngine(new DummyLLMClient());
    await engine.initialize();

    console.log("\n--- Chat with Python example ---");
    let chatGenerator = engine.chat("Hello, can you tell me the current time in Python?");
    for await (const message of chatGenerator) {
        if (message.role === 'user') console.log(`🧑 User: ${message.content}`);
        else if (message.role === 'assistant' && message.content) console.log(`🤖 Assistant: ${message.content}`);
        else if (message.role === 'assistant' && message.tool_code) console.log(`🤖 Assistant calls tool (${message.tool_code.language}):\n${message.tool_code.code}`);
        else if (message.role === 'tool' && message.tool_output) console.log(`🔧 Tool Output:\n${message.tool_output}`);
    }

    console.log("\n--- Chat with JavaScript example ---");
    chatGenerator = engine.chat("Can you calculate 10 + 20 in JavaScript?");
    for await (const message of chatGenerator) {
        if (message.role === 'user') console.log(`🧑 User: ${message.content}`);
        else if (message.role === 'assistant' && message.content) console.log(`🤖 Assistant: ${message.content}`);
        else if (message.role === 'assistant' && message.tool_code) console.log(`🤖 Assistant calls tool (${message.tool_code.language}):\n${message.tool_code.code}`);
        else if (message.role === 'tool' && message.tool_output) console.log(`🔧 Tool Output:\n${message.tool_output}`);
    }

    console.log("\n--- Chat with Shell example ---");
    chatGenerator = engine.chat("List files in the current directory.");
    for await (const message of chatGenerator) {
        if (message.role === 'user') console.log(`🧑 User: ${message.content}`);
        else if (message.role === 'assistant' && message.content) console.log(`🤖 Assistant: ${message.content}`);
        else if (message.role === 'assistant' && message.tool_code) console.log(`🤖 Assistant calls tool (${message.tool_code.language}):\n${message.tool_code.code}`);
        else if (message.role === 'tool' && message.tool_output) console.log(`🔧 Tool Output:\n${message.tool_output}`);
    }

    console.log("\n--- Conversation end ---");
    chatGenerator = engine.chat("Goodbye");
     for await (const message of chatGenerator) {
        if (message.role === 'user') console.log(`🧑 User: ${message.content}`);
        else if (message.role === 'assistant' && message.content) console.log(`🤖 Assistant: ${message.content}`);
     }

    await engine.shutdown();
    console.log("OpenInterpreterRuntimeEngine Demo Finished.");
})();
```