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