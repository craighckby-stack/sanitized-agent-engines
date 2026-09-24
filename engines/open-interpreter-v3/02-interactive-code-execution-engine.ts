/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive Code Execution Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

// A generic interactive code execution engine that manages a persistent subprocess.
export class InteractiveCodeExecutionEngine implements BaseExecutorEngine {
    private process: ChildProcessWithoutNullStreams | null = null;
    private languageCommand: string; // e.g., 'python', 'node'
    private prompt: string = ''; // Expected prompt from the interactive shell
    private continuePrompt: string = ''; // Expected multiline prompt
    private sessionStarted: boolean = false;
    private outputBuffer: string = '';
    private outputResolvers: Map<string, (message: Message) => void> = new Map(); // blockId -> resolver for active outputs
    private outputQueues: Map<string, Message[]> = new Map(); // blockId -> queued messages for output that arrived before listener
    private currentBlockId: string | null = null;
    private readonly HISTORY_FILE_NAME = '.history'; // For Python history

    constructor(languageCommand: 'python' | 'node') {
        this.languageCommand = languageCommand;
        if (languageCommand === 'python') {
            this.prompt = '>>> ';
            this.continuePrompt = '... ';
        } else if (languageCommand === 'node') {
            this.prompt = '> ';
            this.continuePrompt = '... ';
        }
    }

    /**
     * Starts the interactive interpreter subprocess.
     * For Python, it also manages a history file to persist the session context.
     */
    public async start(): Promise<void> {
        if (this.sessionStarted && this.process) {
            console.log(`Interactive Code Executor (${this.languageCommand}): Session already started.`);
            return;
        }

        console.log(`Interactive Code Executor (${this.languageCommand}): Starting session...`);
        
        const commandArgs: string[] = ['-i', '-u']; // -i for interactive, -u for unbuffered
        const env = { ...process.env };

        if (this.languageCommand === 'python') {
            // For Python, set up history management
            const historyPath = path.join(process.cwd(), this.HISTORY_FILE_NAME);
            env.PYTHONSTARTUP = `
import os, readline
try:
    readline.read_history_file('${historyPath.replace(/\\/g, '\\\\')}')
except FileNotFoundError:
    pass
import atexit
atexit.register(lambda: readline.write_history_file('${historyPath.replace(/\\/g, '\\\\')}'))
`;
        }

        this.process = spawn(this.languageCommand, commandArgs, { 
            stdio: ['pipe', 'pipe', 'pipe'],
            env: env 
        });
        this.sessionStarted = true;

        this.process.stdout.on('data', (data) => this.handleOutput(data, 'stdout'));
        this.process.stderr.on('data', (data) => this.handleOutput(data, 'stderr'));
        this.process.on('close', (code) => {
            console.log(`Interactive Code Executor (${this.languageCommand}): Process exited with code ${code}`);
            this.sessionStarted = false;
            this.process = null;
            // Resolve any pending resolvers with an error message
            this.outputResolvers.forEach(resolve => resolve({ type: 'code_output', content: 'Interpreter session closed unexpectedly.', sender: 'executor', error: 'Session closed', exitCode: code || 1 }));
            this.outputResolvers.clear();
            this.outputQueues.clear();
            this.currentBlockId = null;
        });
        this.process.on('error', (err) => {
            console.error(`Interactive Code Executor (${this.languageCommand}): Process error:`, err);
            this.sessionStarted = false;
            this.process = null;
            this.outputResolvers.forEach(resolve => resolve({ type: 'code_output', content: `Interpreter process error: ${err.message}`, sender: 'executor', error: err.message, exitCode: 1 }));
            this.outputResolvers.clear();
            this.outputQueues.clear();
            this.currentBlockId = null;
        });

        // Wait for the initial prompt to appear
        await this.waitForPrompt();
        console.log(`Interactive Code Executor (${this.languageCommand}): Session started and ready.`);
    }

    /**
     * Waits for the interpreter's initial prompt to ensure it's ready for input.
     * This is crucial to avoid sending commands before the interpreter is fully initialized.
     */
    private async waitForPrompt(): Promise<void> {
        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.warn(`Interactive Code Executor (${this.languageCommand}): Timed out waiting for initial prompt. Assuming ready.`);
                this.process?.stdout.off('data', onData);
                resolve();
            }, 10000); // Wait up to 10 seconds for prompt

            const onData = (data: Buffer) => {
                const output = data.toString();
                // Check for primary or secondary prompts
                if (output.includes(this.prompt) || output.includes(this.continuePrompt) || (this.languageCommand === 'python' && output.includes('>>>'))) {
                    clearTimeout(timeout);
                    this.process?.stdout.off('data', onData);
                    resolve();
                }
            };
            this.process?.stdout.on('data', onData);
        });
    }

    /**
     * Handles incoming data from stdout/stderr, buffers it, and attempts to resolve outputs
     * for the currently executing block.
     */
    private handleOutput(data: Buffer, streamType: 'stdout' | 'stderr') {
        const chunk = data.toString();
        this.outputBuffer += chunk;

        // The original Open Interpreter uses a marker like `print("__CODE_OUTPUT_DELIMITER__")`
        // We'll use a similar approach to detect the end of a block's output.
        const endMarker = `_EOB_CODE_ID_${this.currentBlockId}`;
        let outputContent = '';
        let finalOutput = false;

        if (this.currentBlockId && this.outputBuffer.includes(endMarker)) {
            const parts = this.outputBuffer.split(endMarker);
            outputContent = parts[0];
            this.outputBuffer = parts.slice(1).join(endMarker); // Keep any remaining buffer
            finalOutput = true;
        } else {
            // If no specific end marker or not yet complete, try to trim prompts.
            // This ensures we don't send prompts as part of the output unless they are actual output.
            const promptIndex = Math.max(
                this.outputBuffer.lastIndexOf(this.prompt),
                this.outputBuffer.lastIndexOf(this.continuePrompt)
            );

            if (promptIndex > -1) {
                // If a prompt is found, it usually means the previous command output finished.
                // Take content up to the prompt and retain the prompt in buffer.
                outputContent = this.outputBuffer.substring(0, promptIndex);
                this.outputBuffer = this.outputBuffer.substring(promptIndex);
            } else {
                // No prompt, no marker, just buffer it until more data or a prompt appears.
                // If it's a very long output without prompts, this might cause delays.
                // A more advanced parsing might be needed for such cases.
                return; 
            }
        }
        
        outputContent = outputContent.trim(); // Trim whitespace from extracted content

        if (outputContent) {
            const message: Message = {
                type: 'code_output',
                content: outputContent,
                sender: 'executor',
                language: this.languageCommand,
                codeBlockId: this.currentBlockId || undefined
            };
            if (this.currentBlockId && this.outputResolvers.has(this.currentBlockId)) {
                // If there's an active resolver, send it immediately
                this.outputResolvers.get(this.currentBlockId)!(message);
            } else {
                // Otherwise, queue it up (e.g., if output arrives before execute method sets resolver)
                if (!this.outputQueues.has(this.currentBlockId || 'default')) {
                    this.outputQueues.set(this.currentBlockId || 'default', []);
                }
                this.outputQueues.get(this.currentBlockId || 'default')?.push(message);
            }
        }

        if (finalOutput && this.currentBlockId) {
            // Signal the end of this block, including an exitCode
            if (this.outputResolvers.has(this.currentBlockId)) {
                this.outputResolvers.get(this.currentBlockId)!({
                    type: 'code_output',
                    content: '', // Empty content to signify completion, actual output is in previous messages
                    sender: 'executor',
                    language: this.languageCommand,
                    codeBlockId: this.currentBlockId,
                    exitCode: 0 // Assume success for interactive blocks unless explicitly failed
                });
                this.outputResolvers.delete(this.currentBlockId); // Resolve and remove it
            }
            this.currentBlockId = null; // Reset current block ID
            this.outputBuffer = ''; // Clear buffer entirely after a block finishes cleanly
        }
    }


    /**
     * Executes a block of code in the interactive interpreter.
     * It injects a unique marker to detect the end of execution for each block.
     * @param code The code string to execute.
     * @param blockId A unique identifier for this code block.
     * @returns An async iterable of output messages.
     */
    public async *execute(code: string, blockId?: string): AsyncIterable<Message> {
        if (!this.sessionStarted || !this.process?.stdin) {
            yield { type: 'text', content: `Error: Interactive Code Executor (${this.languageCommand}) is not running.`, sender: 'executor', error: 'Executor not running' };
            return;
        }
        if (!blockId) {
            blockId = `anon_${Date.now()}`; // Generate if not provided
        }

        this.currentBlockId = blockId; // Set the current block being executed

        // Inject a unique end marker after the code for easier parsing of output
        const endMarker = `_EOB_CODE_ID_${blockId}`;
        const markedCode = `${code}\nprint('${endMarker}')\n`; // Append marker print statement

        this.process.stdin.write(markedCode);

        // Clear existing buffer and yield any pre-buffered messages for this block
        this.outputBuffer = '';
        if (this.outputQueues.has(blockId)) {
            for (const msg of this.outputQueues.get(blockId)!) {
                yield msg;
            }
            this.outputQueues.delete(blockId);
        }

        // Custom AsyncIterator to yield messages as they arrive
        let isDone = false;
        while (!isDone) {
            const nextMessagePromise = new Promise<Message>((resolve) => {
                this.outputResolvers.set(blockId!, resolve);
            });

            const message = await nextMessagePromise;
            if (message.exitCode !== undefined) { // Exit code signifies the explicit end of block processing
                isDone = true;
            }
            yield message;
        }

        this.outputResolvers.delete(blockId!); // Ensure resolver is cleaned up
        this.currentBlockId = null; // Reset after block completion
    }

    /**
     * Sends an interrupt signal (e.g., Ctrl+C) to the underlying process.
     * This attempts to gracefully stop current execution.
     */
    public async interrupt(): Promise<void> {
        if (this.process) {
            console.log(`Interactive Code Executor (${this.languageCommand}): Sending interrupt...`);
            this.process.kill('SIGINT'); // Send Ctrl+C
            this.outputBuffer = ''; // Clear buffer on interrupt
            this.outputQueues.clear();
            // Resolve any pending resolvers with an interrupt message
            this.outputResolvers.forEach(resolve => resolve({ type: 'code_output', content: 'Execution interrupted.', sender: 'executor', error: 'Interrupted', exitCode: 130 })); // 130 for Ctrl+C
            this.outputResolvers.clear();
            this.currentBlockId = null;
        }
    }

    /**
     * Stops the interpreter subprocess.
     */
    public async stop(): Promise<void> {
        if (this.process && this.sessionStarted) {
            console.log(`Interactive Code Executor (${this.languageCommand}): Stopping session...`);
            this.process.kill('SIGTERM'); // Terminate gracefully
            await new Promise(resolve => this.process?.on('close', resolve));
            this.sessionStarted = false;
            this.process = null;
            this.outputBuffer = '';
            this.outputQueues.clear();
            this.outputResolvers.clear();
            this.currentBlockId = null;
            console.log(`Interactive Code Executor (${this.languageCommand}): Session stopped.`);
        }
        // Clean up history file if it exists
        if (this.languageCommand === 'python') {
            const historyPath = path.join(process.cwd(), this.HISTORY_FILE_NAME);
            if (fs.existsSync(historyPath)) {
                fs.unlinkSync(historyPath);
                console.log(`Interactive Code Executor (${this.languageCommand}): Cleaned up history file.`);
            }
        }
    }

    /**
     * Resets the interpreter by stopping and then restarting it.
     * This clears the session state.
     */
    public async reset(): Promise<void> {
        console.log(`Interactive Code Executor (${this.languageCommand}): Resetting...`);
        await this.stop();
        await this.start();
        console.log(`Interactive Code Executor (${this.languageCommand}): Reset complete.`);
    }
}
