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