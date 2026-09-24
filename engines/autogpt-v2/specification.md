This document details the core runtime engines extracted from an open-source autonomous agent system, formerly known as "AutoGPT". All proprietary branding and specific repository links have been sanitized according to the provided directives, replacing them with generic, descriptive terms. Each identified engine is presented with a description of its function and a complete TypeScript implementation.

---

## Engine 1: Autonomous Agent Planning & Action Engine

### What it does

This engine serves as the central orchestrator and decision-maker for the entire autonomous agent system. It implements the core "observe, think, act, reflect" loop.
The engine initializes with a set of goals and an understanding of its environment. In each step, it observes the current state (including past actions and their results), generates a thought process, reasons about the next best action to take to achieve its goals, and then formulates a concrete command. This command is then passed to an external execution mechanism. After execution, the engine receives feedback and updates its internal state and memory, preparing for the next iteration.

*   **Inputs:** A list of initial goals, available tools (commands), an LLM client, and a memory engine. In each step, it receives the `command_result` from the previous action.
*   **State Lifecycle:** Manages the agent's ongoing `currentGoal`, `previousThought`, `currentThought`, `reasoning`, `plan`, and the `command` it intends to execute. It transitions through states of planning, acting, and reflecting.
*   **Invariant Preservation:** Ensures that the agent always works towards its defined goals, maintains a coherent thought process, and attempts to make progress. It prioritizes safety and goal achievement, leveraging memory to avoid redundant actions or known pitfalls.
*   **Outputs:** A structured `AgentAction` object containing a `commandName`, `args`, and associated `thought` details, or a signal indicating the completion of its goals.

### Implementation Code

```typescript
import { IMemoryEngine } from './MemoryEngine'; // Assuming MemoryEngine is defined elsewhere
import { CommandExecutor, CommandFunction } from './CommandExecutionEngine'; // Assuming CommandExecutionEngine is defined elsewhere

// --- Types and Interfaces ---

/** Represents the details of a planned action by the agent. */
export interface AgentAction {
  commandName: string;
  args: Record<string, any>;
  thought: string;
  reasoning: string;
  plan: string;
  speak: string; // What the agent says aloud
}

/** Represents the core capabilities of an LLM used by the agent. */
export interface ILLMClient {
  /**
   * Sends a prompt to the LLM and returns the raw string response.
   * @param prompt The prompt string to send.
   * @returns A promise that resolves to the LLM's string response.
   */
  getCompletion(prompt: string): Promise<string>;
}

/** Represents a structured response from the LLM after parsing. */
export interface LLMResponse {
  thoughts: {
    text: string;
    reasoning: string;
    plan: string;
    speak: string;
    command: {
      name: string;
      args: Record<string, any>;
    };
  };
}

/** Represents a structured command result. */
export interface CommandResult {
  status: 'success' | 'failure';
  output: string;
}

// --- Mock LLM Client Implementation ---
// In a real system, this would interact with an actual LLM API (e.g., OpenAI).
class MockLLMClient implements ILLMClient {
  async getCompletion(prompt: string): Promise<string> {
    console.log(`[MockLLMClient] Prompting LLM with: ${prompt.substring(0, 200)}...`);
    // Simulate LLM processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // A very simplified mock response based on common AutoGPT output structure
    if (prompt.includes("Goal: 'Write a simple greeting message to a file'")) {
      return JSON.stringify({
        thoughts: {
          text: "My goal is to write a greeting. I should use the 'write_to_file' command.",
          reasoning: "The goal explicitly states writing to a file, so this command is appropriate.",
          plan: "- Identify the file name.\n- Identify the content.\n- Execute write_to_file.",
          speak: "I will now write a greeting message to a file.",
          command: {
            name: "write_to_file",
            args: {
              file_path: "greeting.txt",
              text_content: "Hello from the Autonomous Agent System!"
            }
          }
        }
      });
    } else if (prompt.includes("Goal: 'Search for information about TypeScript'")) {
      return JSON.stringify({
        thoughts: {
          text: "I need to search for information about TypeScript. The 'browse_website' command can be used for this.",
          reasoning: "To get current information, a web search is the most effective method.",
          plan: "- Formulate a search query.\n- Use browse_website to execute the search.\n- Summarize results.",
          speak: "I will now search the web for information about TypeScript.",
          command: {
            name: "browse_website",
            args: {
              url: "https://www.google.com/search?q=TypeScript+features"
            }
          }
        }
      });
    } else if (prompt.includes("Goal: 'Analyze existing files for system configuration'")) {
        return JSON.stringify({
            thoughts: {
                text: "I need to list files to find configuration. The 'read_file' or 'list_files' command would be useful.",
                reasoning: "To analyze existing files, I first need to know what files are present or read specific ones.",
                plan: "- Use 'list_files' to see available files.\n- If a config file is identified, use 'read_file'.",
                speak: "I will start by listing files in the current directory.",
                command: {
                    name: "list_files",
                    args: {}
                }
            }
        });
    }


    // Default fallback for other prompts
    return JSON.stringify({
      thoughts: {
        text: "I'm not sure what to do next. My previous command result: " + prompt.slice(-100),
        reasoning: "I need more information or a clearer goal.",
        plan: "Re-evaluate the current situation and my goals.",
        speak: "I am evaluating my next steps.",
        command: {
          name: "do_nothing",
          args: {}
        }
      }
    });
  }
}

/** Represents the context and history for the LLM prompt. */
export interface PromptContext {
  goals: string[];
  previousCommandResult: CommandResult | null;
  memorySummary: string;
  availableCommands: string;
  currentTask: string;
  previousThought: AgentAction | null;
}

export class AutonomousAgentPlanningAndActionEngine {
  private goals: string[];
  private llmClient: ILLMClient;
  private memoryEngine: IMemoryEngine;
  private commandExecutor: CommandExecutor;
  private previousThought: AgentAction | null = null;
  private currentTask: string = '';

  constructor(
    goals: string[],
    llmClient: ILLMClient,
    memoryEngine: IMemoryEngine,
    commandExecutor: CommandExecutor
  ) {
    this.goals = goals;
    this.llmClient = llmClient;
    this.memoryEngine = memoryEngine;
    this.commandExecutor = commandExecutor;
  }

  /**
   * Constructs the full prompt to be sent to the LLM based on the current context.
   * @param context The current prompt context.
   * @returns The formatted prompt string.
   */
  private constructFullPrompt(context: PromptContext): string {
    let prompt = "You are an autonomous agent system designed to achieve the following goals:\n";
    context.goals.forEach((goal, index) => {
      prompt += `${index + 1}. ${goal}\n`;
    });

    prompt += "\nYour current task is: " + context.currentTask;

    if (context.previousThought) {
      prompt += `\n\nLast thought: ${context.previousThought.thought}`;
      prompt += `\nLast command: ${context.previousThought.commandName} with args ${JSON.stringify(context.previousThought.args)}`;
    }

    if (context.previousCommandResult) {
      prompt += `\n\nPrevious command result: Status: ${context.previousCommandResult.status}, Output: ${context.previousCommandResult.output}\n`;
    }

    prompt += `\n\nRelevant memories:\n${context.memorySummary}\n`;
    prompt += `\nAvailable commands:\n${context.availableCommands}\n`;

    prompt += "\nBased on the above, please provide your next thought, reasoning, plan, what you will say (speak), and the command to execute, in JSON format. Your response should strictly follow this structure:\n";
    prompt += `\`\`\`json\n{\n  "thoughts": {\n    "text": "Your thought process",\n    "reasoning": "Why you chose this action",\n    "plan": "- Short bulleted list of future steps",\n    "speak": "What you will say to the user/console",\n    "command": {\n      "name": "command_name",\n      "args": {\n        "arg_name": "arg_value"\n      }\n    }\n  }\n}\n\`\`\`\n`;

    return prompt;
  }

  /**
   * Parses the raw LLM response string into a structured LLMResponse object.
   * Handles potential JSON parsing errors.
   * @param rawResponse The raw string response from the LLM.
   * @returns A structured LLMResponse object or null if parsing fails.
   */
  private parseLLMResponse(rawResponse: string): LLMResponse | null {
    try {
      // LLM might include markdown fences around JSON, remove them
      const jsonString = rawResponse.replace(/```json\n|\n```/g, '').trim();
      return JSON.parse(jsonString) as LLMResponse;
    } catch (error) {
      console.error("Error parsing LLM response:", error);
      console.error("Raw LLM Response:", rawResponse);
      return null;
    }
  }

  /**
   * Performs a single step in the agent's execution loop.
   * @param previousCommandResult The result from the last executed command, if any.
   * @returns A promise that resolves to the next action or null if the agent decides to stop.
   */
  public async runStep(previousCommandResult: CommandResult | null): Promise<AgentAction | null> {
    console.log("\n--- Agent Step ---");
    console.log(`Current Goals: ${this.goals.join(', ')}`);
    console.log(`Previous Command Result: ${previousCommandResult ? JSON.stringify(previousCommandResult) : 'None'}`);

    // Update current task based on goals and previous actions
    this.currentTask = this.goals[0] || 'No specific task, re-evaluating goals.'; // Simplistic task management

    // 1. Observe: Get relevant memories
    const query = this.currentTask + (previousCommandResult ? ` ${previousCommandResult.output}` : '');
    const relevantMemories = await this.memoryEngine.getRelevantMemories(query, 5);
    const memorySummary = relevantMemories.length > 0
      ? relevantMemories.map(m => `- ${m}`).join('\n')
      : "No relevant memories found.";

    // 2. Formulate Prompt
    const promptContext: PromptContext = {
      goals: this.goals,
      previousCommandResult: previousCommandResult,
      memorySummary: memorySummary,
      availableCommands: this.commandExecutor.getAvailableCommandsDescription(),
      currentTask: this.currentTask,
      previousThought: this.previousThought,
    };

    const fullPrompt = this.constructFullPrompt(promptContext);
    console.log(`Sending prompt to LLM...`);

    // 3. Think: Get LLM response
    const rawLLMResponse = await this.llmClient.getCompletion(fullPrompt);
    const llmResponse = this.parseLLMResponse(rawLLMResponse);

    if (!llmResponse) {
      console.error("Failed to get a valid LLM response. Agent cannot proceed.");
      return {
        commandName: "error_agent",
        args: { message: "Failed to parse LLM response" },
        thought: "I failed to parse the LLM's response, I cannot continue.",
        reasoning: "The LLM's output was not valid JSON.",
        plan: "Stop execution or try again with a refined prompt.",
        speak: "Critical error: LLM response parsing failed."
      };
    }

    const { thoughts } = llmResponse;
    const action: AgentAction = {
      commandName: thoughts.command.name,
      args: thoughts.command.args,
      thought: thoughts.text,
      reasoning: thoughts.reasoning,
      plan: thoughts.plan,
      speak: thoughts.speak,
    };

    console.log(`Agent Thought: ${action.thought}`);
    console.log(`Agent Says: ${action.speak}`);
    console.log(`Agent Command: ${action.commandName} ${JSON.stringify(action.args)}`);

    // Add agent's thought and action to memory
    await this.memoryEngine.addMemory(`Agent thought: ${action.thought}. Chose command: ${action.commandName} with args: ${JSON.stringify(action.args)}.`);

    this.previousThought = action; // Update previous thought for next iteration

    // Check for "end_agent" command to stop
    if (action.commandName === "end_agent") {
      console.log("Agent decided to end execution.");
      return null;
    }

    // 4. Act: Return the planned action to be executed externally
    return action;
  }
}

// Example Usage (requires MemoryEngine and CommandExecutionEngine setup)
/*
(async () => {
  // Mock implementations for demonstration
  class MockMemoryEngine implements IMemoryEngine {
    private memories: string[] = [];
    async addMemory(text: string): Promise<void> {
      this.memories.push(text);
      console.log(`[MockMemoryEngine] Added memory: ${text}`);
    }
    async getRelevantMemories(query: string, limit: number): Promise<string[]> {
      console.log(`[MockMemoryEngine] Searching for memories relevant to: ${query}`);
      // Simple relevance: just return recent memories or all if query matches partially
      const filtered = this.memories.filter(m => m.includes(query) || query.includes(m));
      return filtered.length > 0 ? filtered.slice(-limit) : this.memories.slice(-limit);
    }
  }

  const memoryEngine = new MockMemoryEngine();
  const llmClient = new MockLLMClient();
  const commandExecutor = new CommandExecutor();

  // Register some mock commands for the executor
  commandExecutor.registerCommand('write_to_file', async (args: Record<string, any>) => {
    console.log(`[Command] Writing to file: ${args.file_path} with content: ${args.text_content}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { status: 'success', output: `File '${args.file_path}' written successfully.` };
  }, 'Writes content to a specified file.');

  commandExecutor.registerCommand('browse_website', async (args: Record<string, any>) => {
    console.log(`[Command] Browsing website: ${args.url}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { status: 'success', output: `Successfully browsed ${args.url}. Found information about TypeScript.` };
  }, 'Browses a given URL and returns its content summary.');

  commandExecutor.registerCommand('list_files', async (args: Record<string, any>) => {
      console.log(`[Command] Listing files...`);
      await new Promise(resolve => setTimeout(resolve, 100));
      return { status: 'success', output: `Files: config.json, main.ts, README.md` };
  }, 'Lists files in the current directory.');

  commandExecutor.registerCommand('read_file', async (args: Record<string, any>) => {
      console.log(`[Command] Reading file: ${args.file_path}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (args.file_path === 'config.json') {
          return { status: 'success', output: `Content of config.json: { "API_KEY": "mock_key" }` };
      }
      return { status: 'failure', output: `File not found: ${args.file_path}` };
  }, 'Reads content of a specified file.');


  commandExecutor.registerCommand('do_nothing', async (args: Record<string, any>) => {
    console.log(`[Command] Agent is doing nothing.`);
    return { status: 'success', output: 'No action performed.' };
  }, 'Does nothing for one step.');

  commandExecutor.registerCommand('end_agent', async (args: Record<string, any>) => {
    console.log(`[Command] Agent is ending execution.`);
    return { status: 'success', output: 'Agent requested to terminate.' };
  }, 'Ends the autonomous agent\'s execution.');


  const goals = ["Write a simple greeting message to a file named 'greeting.txt'", "Search for information about TypeScript", "Analyze existing files for system configuration", "Terminate the agent."];
  const agent = new AutonomousAgentPlanningAndActionEngine(goals, llmClient, memoryEngine, commandExecutor);

  let commandResult: CommandResult | null = null;
  let maxSteps = 10; // Prevent infinite loops for demo
  for (let i = 0; i < maxSteps; i++) {
    const nextAction = await agent.runStep(commandResult);
    if (!nextAction) {
      console.log("Agent has decided to stop or encountered a critical error.");
      break;
    }

    commandResult = await commandExecutor.executeCommand(nextAction.commandName, nextAction.args);
    console.log(`Executed command result: ${JSON.stringify(commandResult)}`);
    await agent.memoryEngine.addMemory(`Command '${nextAction.commandName}' executed with result: ${commandResult.output}`);
  }
  console.log("\n--- Agent Execution Finished ---");
})();
*/
```

## Engine 2: Command Execution Engine

### What it does

This engine is responsible for executing specific commands or tools as directed by the Autonomous Agent Planning & Action Engine. It acts as an interface between the agent's high-level decisions and the underlying system functionalities or external APIs. It maintains a registry of available commands, each associated with a callable function, and ensures that only registered commands can be invoked.

*   **Inputs:** A `commandName` (string) and an `args` object (a dictionary of arguments required by the command).
*   **State Lifecycle:** Predominantly stateless for the engine itself, as it primarily dispatches calls. However, the *executed commands* can have side effects on the environment (e.g., writing files, making API calls, browsing the web).
*   **Invariant Preservation:** Ensures that only authorized and registered commands are executed. It provides a consistent interface for the agent to interact with its environment, abstracting away the specifics of each tool's implementation.
*   **Outputs:** A `CommandResult` object indicating the `status` (`success` or `failure`) and an `output` string detailing the outcome of the command execution.

### Implementation Code

```typescript
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
```

## Engine 3: Semantic Memory Engine

### What it does

The Semantic Memory Engine provides the autonomous agent with long-term memory capabilities. It stores textual information and retrieves it based on semantic similarity rather than exact keyword matches. This is achieved by converting text into numerical vector embeddings and then performing vector similarity searches. This engine is crucial for the agent to recall relevant past experiences, facts, or instructions without being explicitly prompted for them, enabling more intelligent and context-aware decision-making.

*   **Inputs:** Text strings to be stored as memories, and query strings to retrieve relevant memories.
*   **State Lifecycle:** Maintains a persistent (or in-memory for this example) collection of memories, each comprising the original text and its vector embedding. The state evolves as new memories are added.
*   **Invariant Preservation:** Ensures that memories are accurately stored and that retrieval yields semantically relevant results. It aims to prevent data loss and maintain the integrity of the memory store.
*   **Outputs:** A list of relevant memory strings that semantically match the input query.

### Implementation Code

```typescript
// --- Types and Interfaces ---

/** Represents a single memory entry. */
export interface MemoryEntry {
  text: string;
  embedding: number[]; // Vector representation of the text
}

/** Interface for an embedding model that converts text to a vector. */
export interface IEmbeddingModel {
  /**
   * Generates a numerical vector embedding for a given text.
   * @param text The text to embed.
   * @returns A promise that resolves to an array of numbers representing the embedding.
   */
  embed(text: string): Promise<number[]>;
}

/** Interface for the Memory Engine. */
export interface IMemoryEngine {
  /**
   * Adds a new memory entry to the store.
   * @param text The text to remember.
   * @returns A promise that resolves when the memory has been added.
   */
  addMemory(text: string): Promise<void>;

  /**
   * Retrieves a list of memories semantically similar to the query.
   * @param query The text to search for relevant memories.
   * @param limit The maximum number of relevant memories to return.
   * @returns A promise that resolves to an array of relevant memory strings.
   */
  getRelevantMemories(query: string, limit: number): Promise<string[]>;
}

// --- Mock Embedding Model Implementation ---
// In a real system, this would interact with an actual embedding API (e.g., OpenAI, Cohere).
class MockEmbeddingModel implements IEmbeddingModel {
  /**
   * Generates a simple, deterministic mock embedding for demonstration.
   * In a real scenario, this would be a high-dimensional vector from an AI model.
   * This mock uses ASCII values for a very basic "embedding".
   */
  async embed(text: string): Promise<number[]> {
    console.log(`[MockEmbeddingModel] Embedding text: ${text.substring(0, 50)}...`);
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 50));

    // A very basic, non-semantic mock embedding for demonstration
    // In a real system, this would be a complex process by an ML model.
    return text.split('').map(char => char.charCodeAt(0) / 100); // Normalize to smaller numbers
  }
}

// --- Utility: Cosine Similarity ---
/**
 * Calculates the cosine similarity between two vectors.
 * A value closer to 1 indicates higher similarity.
 * @param vec1 The first vector.
 * @param vec2 The second vector.
 * @returns The cosine similarity.
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must be of the same length to calculate cosine similarity.');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export class SemanticMemoryEngine implements IMemoryEngine {
  private memories: MemoryEntry[] = [];
  private embeddingModel: IEmbeddingModel;

  constructor(embeddingModel: IEmbeddingModel) {
    this.embeddingModel = embeddingModel;
    console.log("[SemanticMemoryEngine] Initialized.");
  }

  /**
   * Adds a new memory entry to the store by embedding the text.
   * @param text The text to remember.
   */
  public async addMemory(text: string): Promise<void> {
    const embedding = await this.embeddingModel.embed(text);
    this.memories.push({ text, embedding });
    console.log(`[SemanticMemoryEngine] Added memory: "${text.substring(0, 50)}..."`);
  }

  /**
   * Retrieves a list of memories semantically similar to the query.
   * Uses cosine similarity on the embeddings to find the most relevant memories.
   * @param query The text to search for relevant memories.
   * @param limit The maximum number of relevant memories to return.
   * @returns An array of relevant memory strings, sorted by similarity.
   */
  public async getRelevantMemories(query: string, limit: number = 5): Promise<string[]> {
    if (this.memories.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingModel.embed(query);

    const scoredMemories = this.memories
      .map(memory => ({
        memory,
        similarity: cosineSimilarity(queryEmbedding, memory.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity); // Sort in descending order of similarity

    console.log(`[SemanticMemoryEngine] Retrieved ${Math.min(limit, scoredMemories.length)} relevant memories for query: "${query.substring(0, 50)}..."`);

    return scoredMemories
      .slice(0, limit)
      .filter(entry => entry.similarity > 0.01) // Filter out very low similarity (tuneable threshold)
      .map(entry => entry.memory.text);
  }

  /**
   * Clears all memories from the engine.
   */
  public clearMemories(): void {
    this.memories = [];
    console.log("[SemanticMemoryEngine] All memories cleared.");
  }
}

// Example Usage
/*
(async () => {
  const embeddingModel = new MockEmbeddingModel();
  const memoryEngine = new SemanticMemoryEngine(embeddingModel);

  console.log('\n--- Adding Memories ---');
  await memoryEngine.addMemory("The capital of France is Paris.");
  await memoryEngine.addMemory("Eiffel Tower is a famous landmark in Paris.");
  await memoryEngine.addMemory("TypeScript is a superset of JavaScript.");
  await memoryEngine.addMemory("Learning new programming languages is challenging but rewarding.");
  await memoryEngine.addMemory("I need to write a new report for the project.");
  await memoryEngine.addMemory("The project requires a lot of documentation.");

  console.log('\n--- Retrieving Relevant Memories ---');

  let relevantToParis = await memoryEngine.getRelevantMemories("What do I know about Paris?", 2);
  console.log("Memories about Paris:", relevantToParis);
  // Expected: ["Eiffel Tower is a famous landmark in Paris.", "The capital of France is Paris."] (order depends on mock embedding and similarity)

  let relevantToTypescript = await memoryEngine.getRelevantMemories("Tell me about TypeScript development.", 3);
  console.log("Memories about TypeScript:", relevantToTypescript);
  // Expected: ["TypeScript is a superset of JavaScript.", "Learning new programming languages is challenging but rewarding."]

  let relevantToProject = await memoryEngine.getRelevantMemories("What's up with the project tasks?", 2);
  console.log("Memories about Project:", relevantToProject);
  // Expected: ["I need to write a new report for the project.", "The project requires a lot of documentation."]

  let noMatch = await memoryEngine.getRelevantMemories("Who invented the telephone?", 1);
  console.log("Memories with no strong match:", noMatch);
  // Expected: [] or very low similarity entries

  console.log('\n--- Clearing Memories ---');
  memoryEngine.clearMemories();
  let afterClear = await memoryEngine.getRelevantMemories("Anything?", 1);
  console.log("Memories after clear:", afterClear);
  // Expected: []
})();
*/
```