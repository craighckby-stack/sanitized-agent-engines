/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Terminal Command Execution Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

// An engine for executing single, non-interactive terminal commands.
export class TerminalCommandExecutionEngine implements BaseExecutorEngine {
    constructor() {
        // No persistent process to manage for terminal commands.
    }

    /**
     * Terminal commands do not have a persistent session, so this is a no-op.
     */
    public async start(): Promise<void> {
        console.log('Terminal Command Executor: No persistent session to start.');
        return Promise.resolve();
    }

    /**
     * Executes a single shell command and returns its output and exit code.
     * @param command The shell command string to execute.
     * @returns A promise resolving to a Message containing stdout, stderr, and exit code.
     */
    public async execute(command: string): Promise<Message> {
        console.log(`Terminal Command Executor: Executing command: "${command}"`);
        return new Promise<Message>((resolve) => {
            exec(command, (error, stdout, stderr) => {
                const outputContent = (stdout || stderr).trim();
                let exitCode = 0;
                let errorMessage: string | undefined;

                if (error) {
                    console.error(`Terminal Command Executor: Command failed: ${error.message}`);
                    exitCode = error.code || 1;
                    errorMessage = error.message;
                }

                resolve({
                    type: 'code_output',
                    content: outputContent,
                    sender: 'executor',
                    language: 'terminal',
                    exitCode: exitCode,
                    error: errorMessage
                });
            });
        });
    }

    /**
     * Terminal commands do not have a persistent session, so this is a no-op.
     */
    public async stop(): Promise<void> {
        console.log('Terminal Command Executor: No persistent session to stop.');
        return Promise.resolve();
    }

    /**
     * Terminal commands do not have a persistent session, so this is a no-op.
     */
    public async reset(): Promise<void> {
        console.log('Terminal Command Executor: No persistent session to reset.');
        return Promise.resolve();
    }
}
