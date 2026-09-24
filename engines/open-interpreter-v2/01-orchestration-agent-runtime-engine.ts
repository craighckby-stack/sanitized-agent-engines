/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Orchestration & Agent Runtime Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs

// --- Utility Types / Interfaces ---

/** Represents a single message in the conversation history. */
interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  code?: string; // For assistant-generated code blocks (python, shell)
  language?: 'python' | 'shell'; // For code blocks
  tool_code?: string; // For assistant-generated tool call code (e.g., Python snippet to call a tool)
  tool_name?: string; // Extracted tool name from tool_code
  tool_args?: Record<string, any>; // Extracted tool arguments from tool_code
  execution_result?: ExecutionResult; // For results of code or tool execution
}

/** Represents the result of an execution (code or tool). */
interface ExecutionResult {
  stdout: string;
  stderr: string;
  error?: string;
  status: 'success' | 'error';
}

/** Message format for interacting with the LLM. */
interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

/** A chunk of data streamed from the LLM. */
interface LLMResponseChunk {
  type: 'text' | 'code' | 'tool_code' | 'end';
  value: string; // The content (text, code, tool_code)
  language?: 'python' | 'shell'; // Specific to 'code' type
}

/** Definition of a callable tool. */
interface ToolDefinition {
  name: string;
  description: string;
  parameters: any; // JSON Schema for arguments
  func: (...args: any[]) => Promise<any>; // The actual function to execute
}

// --- Engine 2: Code Execution Runtime Engine (Python) (Simulated) ---
/**
 * A simulated engine for executing Python code. In a real scenario, this would
 * involve managing a Python subprocess, its stdin/stdout/stderr, and maintaining
 * a persistent interpreter state for a given session.
 */
class CodeExecutionRuntimeEngine {
  // In a real implementation, this would map sessionId to a Python process handle
  // and manage its I/O streams and persistent state.
  private sessionState: Map<string, string[]> = new Map(); // Simulates accumulated code

  constructor() {
    console.log("CodeExecutionRuntimeEngine initialized (simulated).");
  }

  /**
   * Executes a block of Python code within a specific session context.
   * Simulates accumulating code and returning an execution result.
   */
  public async execute(sessionId: string, code: string): Promise<ExecutionResult> {
    console.log(`[Python Executor] Session: ${sessionId}, Executing:\n${code}`);
    let accumulatedCode = this.sessionState.get(sessionId) || [];
    accumulatedCode.push(code);
    this.sessionState.set(sessionId, accumulatedCode);

    // Simulate execution success or failure
    if (code.includes('raise Exception') || code.includes('error')) {
      return {
        stdout: '',
        stderr: `Simulated Python error during execution for session ${sessionId}.`,
        error: 'Simulated runtime error',
        status: 'error',
      };
    }

    const output = `Simulated Python output for session ${sessionId}:\n${code}\n(Accumulated lines: ${accumulatedCode.length})`;
    return {
      stdout: output,
      stderr: '',
      status: 'success',
    };
  }

  /** Resets the execution state for a given session. */
  public reset(sessionId: string): void {
    console.log(`[Python Executor] Resetting session: ${sessionId}`);
    this.sessionState.delete(sessionId);
  }
}

// --- Engine 3: Shell Execution Runtime Engine (Simulated) ---
/**
 * A simulated engine for executing shell commands. In a real scenario, this would
 * use Node.js `child_process.exec` or `spawn` to run commands and capture output.
 */
class ShellExecutionRuntimeEngine {
  constructor() {
    console.log("ShellExecutionRuntimeEngine initialized (simulated).");
  }

  /**
   * Executes a shell command.
   * Simulates running a command and returning its output.
   */
  public async execute(sessionId: string, command: string, cwd?: string): Promise<ExecutionResult> {
    console.log(`[Shell Executor] Session: ${sessionId}, Executing: ${command} (CWD: ${cwd || '.'})`);

    // Simulate execution success or failure
    if (command.startsWith('rm -rf') || command.includes('fail')) {
      return {
        stdout: '',
        stderr: `Simulated shell error: Command "${command}" not permitted or failed for session ${sessionId}.`,
        error: 'Simulated shell command error',
        status: 'error',
      };
    }

    const output = `Simulated shell output for session ${sessionId}:\nCommand: ${command}\nPath: ${cwd || '/app'}`;
    return {
      stdout: output,
      stderr: '',
      status: 'success',
    };
  }
  // No explicit reset needed as shell commands are generally stateless per execution,
  // though a real system might manage CWD or environment vars per session.
}

// --- Engine 4: Large Language Model (LLM) Interface Engine (Simulated) ---
/**
 * A simulated engine for interacting with a Large Language Model.
 * In a real scenario, this would use an actual LLM API client (e.g., for OpenAI, Anthropic, etc.)
 * to send prompts and receive streaming responses.
 */
class LLMInterfaceEngine {
  private llmConfig: { apiKey: string; model: string; }; // Or other relevant configuration

  constructor(config: { apiKey: string; model: string; }) {
    this.llmConfig = config;
    console.log(`LLMInterfaceEngine initialized for model: ${config.model} (simulated).`);
  }

  /**
   * Simulates streaming a chat completion from an LLM.
   * In a real system, this would make an API call and parse streaming JSON responses.
   */
  public async *streamChatCompletion(messages: LLMMessage[]): AsyncGenerator<LLMResponseChunk, void, void> {
    console.log("[LLM Interface] Sending messages to LLM (simulated):", messages);

    // Simple heuristic for simulated LLM response:
    const lastUserMessage = messages.at(-1)?.content || '';
    let simulatedResponse: LLMResponseChunk[] = [];

    if (lastUserMessage.toLowerCase().includes('hello')) {
      simulatedResponse = [
        { type: 'text', value: 'Hello! How can I assist you today?' },
      ];
    } else if (lastUserMessage.toLowerCase().includes('python code')) {
      simulatedResponse = [
        { type: 'text', value: 'Here is some Python code for you:\n' },
        { type: 'code', language: 'python', value: 'print("Hello from Python!")\nx = 10\nprint(f"x is {x}")' },
      ];
    } else if (lastUserMessage.toLowerCase().includes('shell command')) {
      simulatedResponse = [
        { type: 'text', value: 'Running a shell command:\n' },
        { type: 'code', language: 'shell', value: 'ls -la\npwd' },
      ];
    } else if (lastUserMessage.toLowerCase().includes('tool call')) {
      simulatedResponse = [
        { type: 'text', value: 'I will call a tool for you.\n' },
        { type: 'tool_code', value: `OpenInterpreterRuntimeEngine.callRegisteredTool('search_web', { query: 'latest tech news' })` },
      ];
    } else if (lastUserMessage.toLowerCase().includes('error')) {
      simulatedResponse = [
        { type: 'text', value: 'I encountered an issue. Please try again.' },
      ];
    } else {
      simulatedResponse = [
        { type: 'text', value: `You said: "${lastUserMessage}". I'm a simulated AI ready to help.` },
      ];
    }

    for (const chunk of simulatedResponse) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
      yield chunk;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    yield { type: 'end', value: '' }; // Indicate end of stream
  }

  // In a real system, this would parse raw API responses into LLMResponseChunk
  // private parseStreamChunk(rawChunk: string): LLMResponseChunk | undefined { /* ... */ }
}

// --- Engine 1: Orchestration & Agent Runtime Engine ---

/**
 * The core orchestration engine that manages conversation flow,
 * interacts with the LLM, and dispatches tasks to execution engines.
 */
class OpenInterpreterRuntimeEngine {
  private history: Message[] = [];
  private llmInterface: LLMInterfaceEngine;
  private pythonExecutor: CodeExecutionRuntimeEngine;
  private shellExecutor: ShellExecutionRuntimeEngine;
  private tools: { [key: string]: ToolDefinition } = {};
  private sessionId: string; // Unique ID for managing state across executors
  private systemMessage: string;

  constructor(options?: {
    sessionId?: string;
    llmInterface?: LLMInterfaceEngine;
    pythonExecutor?: CodeExecutionRuntimeEngine;
    shellExecutor?: ShellExecutionRuntimeEngine;
    systemMessage?: string;
    llmConfig?: { apiKey: string; model: string; };
  }) {
    this.sessionId = options?.sessionId || uuidv4();
    this.llmInterface = options?.llmInterface || new LLMInterfaceEngine(options?.llmConfig || { apiKey: 'mock-api-key', model: 'mock-llm-model' });
    this.pythonExecutor = options?.pythonExecutor || new CodeExecutionRuntimeEngine();
    this.shellExecutor = options?.shellExecutor || new ShellExecutionRuntimeEngine();
    this.systemMessage = options?.systemMessage || "You are an AI assistant. You can write and execute code (Python or shell) to answer questions and perform tasks. Use the 'print()' function for Python output.";

    // Add initial system message to history
    this.history.push({ role: 'system', content: this.systemMessage });

    console.log(`OpenInterpreterRuntimeEngine initialized with session ID: ${this.sessionId}`);
  }

  /**
   * Registers a tool that the LLM can call.
   * The tool code generated by the LLM will be in the format:
   * `OpenInterpreterRuntimeEngine.callRegisteredTool('tool_name', {param: 'value'})`
   */
  public registerTool(tool: ToolDefinition): void {
    if (this.tools[tool.name]) {
      console.warn(`Tool '${tool.name}' is already registered and will be overwritten.`);
    }
    this.tools[tool.name] = tool;
    console.log(`Tool '${tool.name}' registered.`);
  }

  /**
   * Main chat loop. Takes user input, interacts with LLM, executes code/tools,
   * and streams back the conversation in parts.
   */
  public async *chat(userInput: string): AsyncGenerator<Message, void, void> {
    const userMessage: Message = { role: 'user', content: userInput };
    this.history.push(userMessage);
    yield userMessage; // Yield the user message first

    let currentCodeBlock: { type: 'code' | 'tool_code', value: string, language?: 'python' | 'shell' } | null = null;
    let currentTextContent = '';

    const llmPrompt = this.formatPrompt();
    let llmStream: AsyncGenerator<LLMResponseChunk, void, void>;

    try {
      llmStream = this.llmInterface.streamChatCompletion(llmPrompt);
    } catch (llmError: any) {
      const errorMessage: Message = { role: 'assistant', content: `LLM API Error: ${llmError.message}`, status: 'error' };
      this.history.push(errorMessage);
      yield errorMessage;
      return;
    }

    for await (const chunk of llmStream) {
      if (chunk.type === 'text') {
        currentTextContent += chunk.value;
      } else if (chunk.type === 'code' || chunk.type === 'tool_code') {
        // If there's pending text, yield it before starting a code block
        if (currentTextContent) {
          const textMessage: Message = { role: 'assistant', content: currentTextContent };
          this.history.push(textMessage);
          yield textMessage;
          currentTextContent = '';
        }

        // Handle a new code block
        if (!currentCodeBlock) {
          currentCodeBlock = { type: chunk.type, value: chunk.value, language: chunk.language };
        } else {
          currentCodeBlock.value += chunk.value; // Append to existing code block
        }
      } else if (chunk.type === 'end') {
        // Yield any remaining text
        if (currentTextContent) {
          const textMessage: Message = { role: 'assistant', content: currentTextContent };
          this.history.push(textMessage);
          yield textMessage;
          currentTextContent = '';
        }

        // If a code block was being built, process it
        if (currentCodeBlock) {
          const codeMessage: Message = {
            role: 'assistant',
            code: currentCodeBlock.value,
            language: currentCodeBlock.language,
            tool_code: currentCodeBlock.type === 'tool_code' ? currentCodeBlock.value : undefined,
            content: currentCodeBlock.value, // Also add to content for display
          };
          this.history.push(codeMessage);
          yield codeMessage;

          // Now execute the code/tool
          let executionResult: ExecutionResult;
          if (currentCodeBlock.type === 'tool_code') {
            executionResult = await this.callTool(currentCodeBlock.value);
          } else { // type === 'code'
            executionResult = await this.executeCode(currentCodeBlock.value, currentCodeBlock.language || 'python');
          }

          const resultMessage: Message = {
            role: 'tool',
            content: executionResult.stdout || executionResult.stderr || executionResult.error || 'No output',
            execution_result: executionResult,
          };
          this.history.push(resultMessage);
          yield resultMessage;

          // Reset currentCodeBlock for next iteration
          currentCodeBlock = null;

          // If execution failed, the LLM might need to regenerate
          if (executionResult.status === 'error') {
            console.error("Code execution failed. LLM might need to re-evaluate.");
            // We could loop back to LLM here or simply continue the conversation
            // For this example, we continue, letting the user decide next steps
          }
        }
      }
    }
  }

  /**
   * Formats the conversation history into a list of messages suitable for the LLM API.
   * This includes encoding tool definitions as part of the system message if needed.
   */
  private formatPrompt(): LLMMessage[] {
    // In a real system, this would also include tool definitions as part of the system message
    // or as a separate 'tools' parameter in the LLM API call.
    // For now, we simplify and only include direct messages.

    const llmMessages: LLMMessage[] = [];
    for (const msg of this.history) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
        llmMessages.push({ role: msg.role, content: msg.content });
      } else if (msg.role === 'tool' && msg.execution_result) {
        // Represent tool execution results for LLM
        llmMessages.push({
          role: 'tool',
          content: JSON.stringify({
            stdout: msg.execution_result.stdout,
            stderr: msg.execution_result.stderr,
            error: msg.execution_result.error,
            status: msg.execution_result.status
          })
        });
      }
    }

    // Add tool definitions to the system message for LLM context, if any
    const toolDescriptions: string[] = [];
    if (Object.keys(this.tools).length > 0) {
      toolDescriptions.push("AVAILABLE TOOLS:");
      for (const toolName in this.tools) {
        const tool = this.tools[toolName];
        toolDescriptions.push(`- Tool: ${tool.name}\n  Description: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters)}`);
        // Instruct LLM how to call:
        toolDescriptions.push(`  Call format: OpenInterpreterRuntimeEngine.callRegisteredTool('${tool.name}', args_object)`);
      }
      // Replaces or appends to the initial system message.
      // For this simplified example, we'll append to ensure LLM sees it.
      const existingSystemMessageIndex = llmMessages.findIndex(m => m.role === 'system');
      if (existingSystemMessageIndex !== -1) {
        llmMessages[existingSystemMessageIndex].content += "\n\n" + toolDescriptions.join('\n');
      } else {
        llmMessages.unshift({ role: 'system', content: this.systemMessage + "\n\n" + toolDescriptions.join('\n') });
      }
    }

    return llmMessages;
  }


  /**
   * Dispatches code execution to the appropriate executor.
   */
  private async executeCode(code: string, language: 'python' | 'shell'): Promise<ExecutionResult> {
    if (language === 'python') {
      return this.pythonExecutor.execute(this.sessionId, code);
    } else if (language === 'shell') {
      return this.shellExecutor.execute(this.sessionId, code);
    } else {
      return {
        stdout: '',
        stderr: `Unsupported language: ${language}`,
        error: 'Unsupported language',
        status: 'error',
      };
    }
  }

  /**
   * Calls a registered tool function based on the LLM's tool_code output.
   * Expects tool_code in the format: `OpenInterpreterRuntimeEngine.callRegisteredTool('tool_name', {param: 'value'})`
   */
  private async callTool(toolCode: string): Promise<ExecutionResult> {
    // Simple regex to parse the tool_code string.
    // In a production system, a more robust parser or structured output from LLM is preferred.
    const regex = /OpenInterpreterRuntimeEngine\.callRegisteredTool\('([^']+)',\s*(\{.*?\})\s*\)/;
    const match = toolCode.match(regex);

    if (!match || match.length < 3) {
      return {
        stdout: '',
        stderr: `Failed to parse tool call: ${toolCode}`,
        error: 'Tool call parsing error',
        status: 'error',
      };
    }

    const toolName = match[1];
    let args: Record<string, any>;
    try {
      args = JSON.parse(match[2]);
    } catch (e: any) {
      return {
        stdout: '',
        stderr: `Failed to parse tool arguments JSON: ${e.message}`,
        error: 'Tool argument parsing error',
        status: 'error',
      };
    }

    const tool = this.tools[toolName];
    if (!tool) {
      return {
        stdout: '',
        stderr: `Tool '${toolName}' not found or registered.`,
        error: 'Tool not found',
        status: 'error',
      };
    }

    try {
      console.log(`[Tool Executor] Calling tool '${toolName}' with arguments:`, args);
      const result = await tool.func(...Object.values(args)); // Assuming func takes args in order of values
      const stdout = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return {
        stdout: `Tool '${toolName}' executed successfully. Result:\n${stdout}`,
        stderr: '',
        status: 'success',
      };
    } catch (e: any) {
      console.error(`Error executing tool '${toolName}':`, e);
      return {
        stdout: '',
        stderr: `Error executing tool '${toolName}': ${e.message}`,
        error: 'Tool execution error',
        status: 'error',
      };
    }
  }

  /** Resets the entire conversation history and execution contexts. */
  public reset(): void {
    this.history = [{ role: 'system', content: this.systemMessage }];
    this.pythonExecutor.reset(this.sessionId);
    // Shell executor typically doesn't need a reset, but could clear CWD if managed per session.
    this.sessionId = uuidv4(); // Generate a new session ID
    console.log(`OpenInterpreterRuntimeEngine reset. New session ID: ${this.sessionId}`);
  }
}
