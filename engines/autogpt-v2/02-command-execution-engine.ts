/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Command Execution Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

// Re-using CommandResult from Engine 1 for consistency
export interface CommandResult {
  status: 'success' | 'failure';
  output: string;
}

/**
 * Type definition for a command function.
 * It takes an arguments object and returns a Promise resolving to a CommandResult.
 */
export type CommandFunction = (args: Record<string, any>) => Promise<CommandResult>;

/**
 * Represents a registered command, including its name, function, and description.
 */
export interface RegisteredCommand {
  name: string;
  func: CommandFunction;
  description: string;
}

export class CommandExecutor {
  private commands: Map<string, RegisteredCommand> = new Map();

  constructor() {
    // Optionally register a default error command
    this.registerCommand(
      'error_agent',
      async (args: Record<string, any>) => {
        const message = args.message || "An unspecified error occurred.";
        console.error(`[CommandExecutor] Error Agent invoked: ${message}`);
        return { status: 'failure', output: `Error command executed: ${message}` };
      },
      'Reports an internal error within the agent system.'
    );
  }

  /**
   * Registers a new command with the executor.
   * @param name The unique name of the command.
   * @param func The asynchronous function to execute when the command is called.
   * @param description A brief description of what the command does.
   * @throws Error if a command with the same name is already registered.
   */
  public registerCommand(name: string, func: CommandFunction, description: string): void {
    if (this.commands.has(name)) {
      throw new Error(`Command '${name}' is already registered.`);
    }
    this.commands.set(name, { name, func, description });
    console.log(`[CommandExecutor] Registered command: '${name}'`);
  }

  /**
   * Executes a registered command.
   * @param commandName The name of the command to execute.
   * @param args The arguments object to pass to the command function.
   * @returns A promise that resolves to a CommandResult.
   */
  public async executeCommand(commandName: string, args: Record<string, any>): Promise<CommandResult> {
    const command = this.commands.get(commandName);

    if (!command) {
      console.error(`[CommandExecutor] Attempted to execute unregistered command: '${commandName}'`);
      return { status: 'failure', output: `Unknown command: '${commandName}'` };
    }

    try {
      console.log(`[CommandExecutor] Executing command: '${commandName}' with args: ${JSON.stringify(args)}`);
      return await command.func(args);
    } catch (error: any) {
      console.error(`[CommandExecutor] Error executing command '${commandName}':`, error);
      return { status: 'failure', output: `Error during command execution: ${error.message || 'An unknown error occurred'}` };
    }
  }

  /**
   * Returns a formatted string describing all available commands.
   * This is typically used by the Agent Planning & Action Engine for prompt construction.
   * @returns A string listing all registered commands and their descriptions.
   */
  public getAvailableCommandsDescription(): string {
    if (this.commands.size === 0) {
      return "No commands available.";
    }

    let description = "Available Commands:\n";
    this.commands.forEach(cmd => {
      description += `- ${cmd.name}: ${cmd.description}\n`;
    });
    return description;
  }
}

// Example Usage (for testing purposes, would be integrated with Agent Engine)
/*
(async () => {
  const executor = new CommandExecutor();

  // Register some example commands
  executor.registerCommand(
    'create_file',
    async (args: { path: string; content: string }) => {
      console.log(`Mock: Creating file at ${args.path} with content: "${args.content}"`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async operation
      return { status: 'success', output: `File '${args.path}' created.` };
    },
    'Creates a new file with specified content at the given path.'
  );

  executor.registerCommand(
    'read_file',
    async (args: { path: string }) => {
      console.log(`Mock: Reading file from ${args.path}`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async operation
      if (args.path === 'test.txt') {
        return { status: 'success', output: 'Content of test.txt: Hello World!' };
      }
      return { status: 'failure', output: `File '${args.path}' not found.` };
    },
    'Reads the content of a file at the given path.'
  );

  executor.registerCommand(
    'search_web',
    async (args: { query: string }) => {
      console.log(`Mock: Searching web for: "${args.query}"`);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate async operation
      return { status: 'success', output: `Web search for '${args.query}' completed. Found 10 results.` };
    },
    'Performs a web search for the given query.'
  );

  // Demonstrate execution
  console.log('\n--- Demonstrating Command Execution ---');

  let result1 = await executor.executeCommand('create_file', { path: 'report.txt', content: 'Initial report data.' });
  console.log(`Result 1: ${JSON.stringify(result1)}`);

  let result2 = await executor.executeCommand('read_file', { path: 'test.txt' });
  console.log(`Result 2: ${JSON.stringify(result2)}`);

  let result3 = await executor.executeCommand('search_web', { query: 'latest AI trends' });
  console.log(`Result 3: ${JSON.stringify(result3)}`);

  let result4 = await executor.executeCommand('read_file', { path: 'non_existent.txt' });
  console.log(`Result 4: ${JSON.stringify(result4)}`);

  let result5 = await executor.executeCommand('unknown_command', { arg: 'value' });
  console.log(`Result 5: ${JSON.stringify(result5)}`);

  let result6 = await executor.executeCommand('error_agent', { message: 'Something went wrong internally.' });
  console.log(`Result 6: ${JSON.stringify(result6)}`);

  console.log('\n--- Available Commands ---');
  console.log(executor.getAvailableCommandsDescription());
})();
*/
