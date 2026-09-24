/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OpenInterpreterRuntimeEngine (Orchestration Engine)
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

// The main orchestration engine for the AI runtime system.
class OpenInterpreterRuntimeEngine {
    private messages: Message[] = [];
    private llm: LLMService;
    private executors: Map<string, BaseExecutorEngine> = new Map();
    private _active: boolean = false;
    private _interrupt: boolean = false;

    constructor(options?: { llm?: LLMService; }) {
        this.llm = options?.llm || new MockLLMService(); // Use a mock LLM by default
        this.registerExecutor('python', new InteractiveCodeExecutionEngine('python'));
        this.registerExecutor('javascript', new InteractiveCodeExecutionEngine('node')); // For JS, use 'node' command
        this.registerExecutor('terminal', new TerminalCommandExecutionEngine());
    }

    /**
     * Registers an executor engine with a specific language/type identifier.
     * @param language The identifier for the executor (e.g., 'python', 'terminal').
     * @param executor The executor engine instance.
     */
    public registerExecutor(language: string, executor: BaseExecutorEngine): void {
        this.executors.set(language, executor);
    }

    /**
     * Adds a message to the conversation history.
     * @param message The message to add.
     */
    private addMessage(message: Message): void {
        this.messages.push(message);
    }

    /**
     * Processes a user message and orchestrates the AI's response and actions.
     * This is the core interaction loop.
     * @param message The user's input message.
     * @returns An async iterable of output messages from the system.
     */
    public async *chat(message: string): AsyncIterable<Message> {
        if (this._active) {
            throw new Error('An active chat session is already running. Please wait or interrupt.');
        }
        this._active = true;
        this._interrupt = false;

        const userMessage: Message = { type: 'user_message', content: message, sender: 'user' };
        this.addMessage(userMessage);
        yield userMessage; // Echo user message

        try {
            while (this._active && !this._interrupt) {
                // Get LLM response based on current conversation history
                const llmResponseStream = this.llm.chat(this.messages);
                let llmRespondedWithCode = false;
                let hasProcessedLLMResponseThisTurn = false;

                for await (const llmMessage of llmResponseStream) {
                    if (this._interrupt) break;

                    this.addMessage(llmMessage); // Add LLM's raw message to history
                    yield llmMessage; // Yield LLM's message
                    hasProcessedLLMResponseThisTurn = true;

                    if (llmMessage.type === 'code') {
                        llmRespondedWithCode = true;
                        const executor = this.executors.get(llmMessage.language || '');
                        if (executor) {
                            yield { type: 'text', content: `Executing ${llmMessage.language} code...`, sender: 'executor' };
                            const codeBlockId = `code_${Date.now()}`; // Generate a unique ID for the block
                            const executionResultStream = await executor.execute(llmMessage.content, codeBlockId);

                            // Handle both AsyncIterable and Promise<Message> results
                            if (executionResultStream && typeof (executionResultStream as AsyncIterable<Message>)[Symbol.asyncIterator] === 'function') {
                                for await (const outputMessage of executionResultStream as AsyncIterable<Message>) {
                                    if (this._interrupt) break;
                                    this.addMessage(outputMessage); // Add executor output to history
                                    yield outputMessage; // Yield executor output
                                }
                            } else if (executionResultStream && typeof executionResultStream === 'object' && 'content' in (executionResultStream as Message)) {
                                // Handle promise-based execution results (like TerminalCommandExecutionEngine)
                                const outputMessage = executionResultStream as Message;
                                this.addMessage(outputMessage);
                                yield outputMessage;
                            }
                            // After code execution, the loop will continue to allow the LLM to interpret the results
                        } else {
                            const errorMsg: Message = {
                                type: 'text',
                                content: `Error: No executor found for language '${llmMessage.language}'.`,
                                sender: 'executor',
                                error: `No executor found for language '${llmMessage.language}'`
                            };
                            this.addMessage(errorMsg);
                            yield errorMsg;
                        }
                    }
                }
                
                // If the LLM didn't respond with any messages or only with text, we can assume its turn is over.
                // If it responded with code, we loop again to get its interpretation of the code results.
                if (!llmRespondedWithCode && hasProcessedLLMResponseThisTurn) {
                    this._active = false; 
                }
                if (!this._active) break; // Exit the while loop if the LLM's turn is done
            }
        } catch (error: any) {
            const errorMsg: Message = { type: 'text', content: `An error occurred: ${error.message}`, sender: 'executor', error: error.message };
            this.addMessage(errorMsg);
            yield errorMsg;
        } finally {
            this._active = false;
            this._interrupt = false;
        }
    }

    /**
     * Interrupts any ongoing chat or code execution.
     */
    public async interrupt(): Promise<void> {
        if (this._active) {
            this._interrupt = true;
            // Also propagate interrupt to any active interactive executors
            for (const executor of this.executors.values()) {
                if (typeof (executor as any).interrupt === 'function') {
                    await (executor as any).interrupt();
                }
            }
            console.log('OpenInterpreterRuntimeEngine: Interrupted.');
        }
    }

    /**
     * Resets the conversation history and all registered executors.
     */
    public async reset(): Promise<void> {
        this.messages = [];
        this._active = false;
        this._interrupt = false;
        for (const executor of this.executors.values()) {
            await executor.reset();
        }
        console.log('OpenInterpreterRuntimeEngine: Reset.');
    }

    /**
     * Starts all registered executors. This should be called once before `chat`.
     */
    public async start(): Promise<void> {
        for (const executor of this.executors.values()) {
            await executor.start();
        }
        console.log('OpenInterpreterRuntimeEngine: All executors started.');
    }

    /**
     * Stops all registered executors. This should be called when the system is no longer needed.
     */
    public async stop(): Promise<void> {
        for (const executor of this.executors.values()) {
            await executor.stop();
        }
        this._active = false;
        this._interrupt = false;
        console.log('OpenInterpreterRuntimeEngine: All executors stopped.');
    }
}
