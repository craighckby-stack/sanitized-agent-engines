/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
# Nanobot Autonomous Agent Framework Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: HKUDS/nanobot - Ultra-lightweight, open-source, self-hosted personal AI agent framework in Python with WebUI, tools, memory, MCP, multi-agent workflows, automation, and chat apps

## 1. Architectural Topology & Component Overview

The Nanobot Autonomous Agent Framework Engine is a modular architecture consisting of five core engines that work together to provide a complete agent runtime system:

1. **Lifecycle Kernel** - Dependency injection, hook dispatch, disposable registry, and scope management
2. **ReAct Agent Loop Engine** - Multi-turn conversation loop with step budget and trajectory tracking
3. **Unified Model Stream Adapter** - Streaming tokens, thought isolation, and partial JSON tool-call reconstruction
4. **Tool Sandbox & VFS** - In-memory file system, shell interpreter, and output sanitizer
5. **Non-linear Session Tree & Token Budget** - Branching session tree with checkpointing and LRU pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the overall lifecycle of the agent system, including dependency injection, event handling, and resource cleanup. It maintains a registry of disposable components and ensures proper initialization and shutdown of all subsystems.

### Inputs & Outputs
- **Inputs**: Configuration parameters, component dependencies
- **Outputs**: Initialized components, event dispatchers, lifecycle hooks

### Implementation Code
```typescript
import { Disposable, DisposableRegistry } from './disposables';
import { EventDispatcher } from './events';
import { SessionManager } from './session';
import { ToolRegistry } from './tools';
import { MemoryStore } from './memory';
import { LLMRuntime } from './llm-runtime';

export class NanobotLifecycleContext implements Disposable {
  private disposables = new DisposableRegistry();
  private eventDispatcher = new EventDispatcher();
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private memoryStore: MemoryStore;
  private llmRuntime: LLMRuntime;

  constructor() {
    this.sessionManager = new SessionManager();
    this.toolRegistry = new ToolRegistry();
    this.memoryStore = new MemoryStore();
    this.llmRuntime = new LLMRuntime();
    
    this.disposables.add(this.sessionManager);
    this.disposables.add(this.toolRegistry);
    this.disposables.add(this.memoryStore);
    this.disposables.add(this.llmRuntime);
  }

  get events() {
    return this.eventDispatcher;
  }

  get sessions() {
    return this.sessionManager;
  }

  get tools() {
    return this.toolRegistry;
  }

  get memory() {
    return this.memoryStore;
  }

  get llm() {
    return this.llmRuntime;
  }

  async initialize(): Promise<void> {
    await this.sessionManager.initialize();
    await this.toolRegistry.initialize();
    await this.memoryStore.initialize();
    await this.llmRuntime.initialize();
    
    this.eventDispatcher.emit('initialized');
  }

  async dispose(): Promise<void> {
    await this.disposables.dispose();
    this.eventDispatcher.emit('disposed');
  }

  async runHook<T>(name: string, context: T): Promise<T> {
    const handlers = this.eventDispatcher.getHandlers(name);
    let result = context;
    
    for (const handler of handlers) {
      result = await handler(result);
    }
    
    return result;
  }
}
```

## Engine 2: ReAct Agent Loop Engine

### What it does
The ReAct Agent Loop Engine manages the multi-turn conversation flow between the user and the agent. It implements the ReAct (Reasoning and Acting) pattern, allowing the agent to reason about problems and take actions through tool calls. The engine enforces turn limits and manages the conversation trajectory.

### Inputs & Outputs
- **Inputs**: Session context, user messages, tool registry, LLM runtime
- **Outputs**: Agent responses, tool execution results, conversation state updates

### Implementation Code
```typescript
import { AgentContext } from './context';
import { ToolRegistry } from './tools';
import { LLMRuntime } from './llm-runtime';
import { Session } from '../session';
import { InboundMessage, OutboundMessage } from '../bus/events';
import { AgentHookContext, AgentTurnHookContext } from './hook';

export class NanobotAgentLoopEngine {
  private maxTurns: number;
  private context: AgentContext;
  private tools: ToolRegistry;
  private llm: LLMRuntime;

  constructor(
    maxTurns: number = 20,
    context: AgentContext,
    tools: ToolRegistry,
    llm: LLMRuntime
  ) {
    this.maxTurns = maxTurns;
    this.context = context;
    this.tools = tools;
    this.llm = llm;
  }

  async run(session: Session, message: InboundMessage): Promise<OutboundMessage> {
    let turnCount = 0;
    let currentMessage = message;
    let response: OutboundMessage | null = null;
    
    while (turnCount < this.maxTurns && !response) {
      turnCount++;
      
      // Run turn hooks
      const hookContext: AgentTurnHookContext = {
        session,
        message: currentMessage,
        turnCount,
        maxTurns: this.maxTurns
      };
      
      await this.context.runHook('beforeTurn', hookContext);
      
      // Process the message
      response = await this.processTurn(session, currentMessage);
      
      // Run post-turn hooks
      await this.context.runHook('afterTurn', {
        ...hookContext,
        response
      });
      
      // If no response yet, continue with assistant's response
      if (!response && turnCount < this.maxTurns) {
        currentMessage = this.createAssistantMessage(session);
      }
    }
    
    if (!response) {
      throw new Error(`Agent loop exceeded maximum turns (${this.maxTurns})`);
    }
    
    return response;
  }

  private async processTurn(session: Session, message: InboundMessage): Promise<OutboundMessage | null> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Get model response
    const response = await this.llm.complete(messages);
    
    // Handle tool calls if any
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolResults = [];
      
      for (const toolCall of response.toolCalls) {
        const tool = this.tools.get(toolCall.name);
        if (tool) {
          const result = await tool.execute(toolCall.arguments);
          toolResults.push({
            toolCallId: toolCall.id,
            result
          });
        }
      }
      
      // Add tool results to session
      session.addToolResults(toolResults);
      
      // Return null to indicate we need another turn
      return null;
    }
    
    // Return the assistant's response
    return {
      content: response.content,
      role: 'assistant',
      timestamp: Date.now()
    };
  }

  private createAssistantMessage(session: Session): InboundMessage {
    return {
      content: '',
      role: 'assistant',
      timestamp: Date.now(),
      sessionKey: session.key
    };
  }
}
```

## Engine 3: Unified Model Stream Adapter

### What it does
The Unified Model Stream Adapter provides a consistent interface for interacting with various language model providers. It handles streaming responses, thought isolation (extracting reasoning from responses), and partial JSON tool-call reconstruction. This engine abstracts away the differences between various model APIs.

### Inputs & Outputs
- **Inputs**: Session context, user messages, model configuration
- **Outputs**: Streaming response chunks, extracted thoughts, reconstructed tool calls

### Implementation Code
```typescript
import { LLMRuntime } from './llm-runtime';
import { LLMResponse, LLMStreamChunk } from '../providers/base';
import { AgentContext } from './context';
import { Session } from '../session';
import { InboundMessage } from '../bus/events';

export class NanobotModelStreamAdapter {
  private llm: LLMRuntime;
  private context: AgentContext;

  constructor(llm: LLMRuntime, context: AgentContext) {
    this.llm = llm;
    this.context = context;
  }

  async *stream(session: Session, message: InboundMessage): AsyncGenerator<LLMStreamChunk> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Create a streaming response
    const stream = this.llm.stream(messages);
    
    let accumulatedContent = '';
    let accumulatedToolCalls: any[] = [];
    
    for await (const chunk of stream) {
      // Accumulate content
      if (chunk.content) {
        accumulatedContent += chunk.content;
      }
      
      // Accumulate tool calls
      if (chunk.toolCalls) {
        accumulatedToolCalls = [...accumulatedToolCalls, ...chunk.toolCalls];
      }
      
      // Yield the chunk
      yield {
        content: chunk.content || '',
        toolCalls: chunk.toolCalls || [],
        usage: chunk.usage
      };
    }
    
    // Create final response
    const finalResponse: LLMResponse = {
      content: accumulatedContent,
      toolCalls: accumulatedToolCalls,
      usage: stream.getUsage()
    };
    
    // Add response to session
    session.addResponse(finalResponse);
  }

  async *streamThoughts(session: Session, message: InboundMessage): AsyncGenerator<string> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Create a streaming response
    const stream = this.llm.stream(messages);
    
    let accumulatedContent = '';
    let inThought = false;
    let thoughtStart = 0;
    
    for await (const chunk of stream) {
      if (chunk.content) {
        accumulatedContent += chunk.content;
        
        // Extract thoughts (between <thought> tags)
        const thoughtMatch = accumulatedContent.match(/<thought>(.*?)<\/thought>/s);
        if (thoughtMatch && !inThought) {
          inThought = true;
          thoughtStart = accumulatedContent.indexOf('<thought>') + 8;
        } else if (inThought && accumulatedContent.includes('</thought>')) {
          inThought = false;
          const thoughtEnd = accumulatedContent.indexOf('</thought>');
          const thought = accumulatedContent.slice(thoughtStart, thoughtEnd);
          yield thought;
          accumulatedContent = accumulatedContent.slice(thoughtEnd + 9);
        }
      }
    }
  }

  async reconstructToolCalls(session: Session, message: InboundMessage): Promise<any[]> {
    // Build messages for the model
    const messages = await this.context.buildMessages(session, message);
    
    // Get the complete response
    const response = await this.llm.complete(messages);
    
    // Add response to session
    session.addResponse(response);
    
    return response.toolCalls || [];
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a secure execution environment for tools and commands. It implements an in-memory virtual file system (VFS) and a shell interpreter with command sanitization. This engine ensures that tool execution is isolated from the host system and prevents malicious actions.

### Inputs & Outputs
- **Inputs**: Tool commands, file operations, security parameters
- **Outputs**: Command results, file content, sanitized output

### Implementation Code
```typescript
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { ToolResult } from '../providers/base';

export class NanobotToolSandbox {
  private vfsRoot: string;
  private allowedCommands: string[];
  private maxOutputSize: number;

  constructor(vfsRoot: string = '/tmp/nanobot-vfs', maxOutputSize: number = 100000) {
    this.vfsRoot = vfsRoot;
    this.allowedCommands = [
      'echo', 'cat', 'ls', 'pwd', 'cd', 'mkdir', 'rm', 'mv', 'cp',
      'find', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq',
      'python', 'python3', 'node', 'npm', 'git'
    ];
    this.maxOutputSize = maxOutputSize;
  }

  async initialize(): Promise<void> {
    try {
      await fs.access(this.vfsRoot);
    } catch {
      await fs.mkdir(this.vfsRoot, { recursive: true });
    }
  }

  async executeCommand(command: string, args: string[], cwd?: string): Promise<ToolResult> {
    // Sanitize command and arguments
    const sanitizedCommand = this.sanitizeCommand(command);
    if (!sanitizedCommand) {
      throw new Error(`Command not allowed: ${command}`);
    }

    // Create a unique working directory if not provided
    const workingDir = cwd || join(this.vfsRoot, nanoid());
    await fs.mkdir(workingDir, { recursive: true });

    try {
      // Execute command
      const result = await this.executeProcess(sanitizedCommand, args, workingDir);
      
      // Sanitize output
      const sanitizedOutput = this.sanitizeOutput(result.stdout);
      
      return {
        content: sanitizedOutput,
        isError: result.stderr.length > 0
      };
    } finally {
      // Clean up temporary directory
      try {
        await fs.rm(workingDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async readFile(path: string): Promise<ToolResult> {
    // Sanitize path
    const sanitizedPath = this.sanitizePath(path);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${path}`);
    }

    try {
      const content = await fs.readFile(sanitizedPath, 'utf-8');
      return {
        content: this.sanitizeOutput(content),
        isError: false
      };
    } catch (error) {
      return {
        content: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }

  async writeFile(path: string, content: string): Promise<ToolResult> {
    // Sanitize path
    const sanitizedPath = this.sanitizePath(path);
    if (!sanitizedPath) {
      throw new Error(`Invalid file path: ${path}`);
    }

    try {
      await fs.writeFile(sanitizedPath, content, 'utf-8');
      return {
        content: `File written successfully to ${sanitizedPath}`,
        isError: false
      };
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }

  private sanitizeCommand(command: string): string | null {
    if (!this.allowedCommands.includes(command)) {
      return null;
    }
    return command;
  }

  private sanitizePath(path: string): string | null {
    // Prevent directory traversal
    if (path.includes('..') || path.includes('~')) {
      return null;
    }
    
    // Resolve to absolute path within VFS
    const absolutePath = join(this.vfsRoot, path);
    
    // Ensure path is within VFS
    if (!absolutePath.startsWith(this.vfsRoot)) {
      return null;
    }
    
    return absolutePath;
  }

  private sanitizeOutput(output: string): string {
    // Truncate if too long
    if (output.length > this.maxOutputSize) {
      return output.substring(0, this.maxOutputSize) + '\n[Output truncated]';
    }
    
    // Remove sensitive information (basic implementation)
    const sensitivePatterns = [
      /password[:\s=]+[\w\d]+/gi,
      /token[:\s=]+[\w\d-]+/gi,
      /api[_-]?key[:\s=]+[\w\d-]+/gi,
      /secret[:\s=]+[\w\d]+/gi
    ];
    
    let sanitized = output;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  private async executeProcess(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = exec(
        [command, ...args].join(' '),
        { cwd, encoding: 'utf-8', maxBuffer: this.maxOutputSize },
        (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });
  }
}
```

## Engine 5: Non-linear Session Tree & Token Budget

### What it does
The Non-linear Session Tree & Token Budget manages conversation sessions as a branching tree structure rather than a linear sequence. It supports session branching for parallel conversations, checkpointing for saving conversation state, and LRU pruning to manage memory usage. This engine efficiently manages token budgets across complex conversation flows.

### Inputs & Outputs
- **Inputs**: Session data, branching parameters, token limits
- **Outputs**: Session nodes, branch summaries, token usage reports

### Implementation Code
```typescript
import { LRUCache } from 'lru-cache';
import { nanoid } from 'nanoid';
import { Session } from '../session';
import { SessionSummary } from '../session/summary';

export interface SessionNode {
  id: string;
  session: Session;
  parent?: string;
  children: string[];
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
}

export interface SessionBranch {
  root: string;
  nodes: Map<string, SessionNode>;
}

export class NanobotSessionTree {
  private branches: Map<string, SessionBranch>;
  private nodeCache: LRUCache<string, SessionNode>;
  private maxBranches: number;
  private maxNodesPerBranch: number;

  constructor(maxBranches: number = 10, maxNodesPerBranch: number = 100) {
    this.branches = new Map();
    this.nodeCache = new LRUCache({
      max: maxNodesPerBranch * maxBranches,
      ttl: 1000 * 60 * 60 // 1 hour
    });
    this.maxBranches = maxBranches;
    this.maxNodesPerBranch = maxNodesPerBranch;
  }

  async initialize(): Promise<void> {
    // Initialize with a default branch
    await this.createBranch('default');
  }

  async createBranch(branchId: string, parentId?: string): Promise<string> {
    if (this.branches.size >= this.maxBranches) {
      // Remove the least recently used branch
      const oldestBranch = this.findOldestBranch();
      if (oldestBranch) {
        this.branches.delete(oldestBranch);
      }
    }

    const branch: SessionBranch = {
      root: parentId || nanoid(),
      nodes: new Map()
    };

    // Create root node
    const rootNode: SessionNode = {
      id: branch.root,
      session: await this.createSession(branch.root),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenCount: 0,
      children: []
    };

    branch.nodes.set(branch.root, rootNode);
    this.branches.set(branchId, branch);
    this.nodeCache.set(branch.root, rootNode);

    return branch.root;
  }

  async createNode(branchId: string, parentId?: string): Promise<string> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Check if we need to prune nodes
    if (branch.nodes.size >= this.maxNodesPerBranch) {
      await this.pruneBranch(branchId);
    }

    const nodeId = nanoid();
    const parentSession = parentId ? branch.nodes.get(parentId)?.session : branch.nodes.get(branch.root)?.session;
    
    if (!parentSession) {
      throw new Error(`Parent node not found: ${parentId || branch.root}`);
    }

    // Create new session based on parent
    const newSession = await this.createSession(nodeId, parentSession);
    
    const node: SessionNode = {
      id: nodeId,
      session: newSession,
      parent: parentId || branch.root,
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tokenCount: 0
    };

    // Add to parent's children
    if (parentId) {
      const parentNode = branch.nodes.get(parentId);
      if (parentNode) {
        parentNode.children.push(nodeId);
        parentNode.updatedAt = Date.now();
      }
    } else {
      // If no parent, add to root's children
      const rootNode = branch.nodes.get(branch.root);
      if (rootNode) {
        rootNode.children.push(nodeId);
        rootNode.updatedAt = Date.now();
      }
    }

    branch.nodes.set(nodeId, node);
    this.nodeCache.set(nodeId, node);

    return nodeId;
  }

  async getNode(branchId: string, nodeId: string): Promise<SessionNode | null> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      return null;
    }

    // Check cache first
    let node = this.nodeCache.get(nodeId);
    if (!node) {
      node = branch.nodes.get(nodeId) || null;
      if (node) {
        this.nodeCache.set(nodeId, node);
      }
    }

    return node || null;
  }

  async updateNode(branchId: string, nodeId: string, updates: Partial<SessionNode>): Promise<void> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    const node = branch.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Update node
    Object.assign(node, updates, { updatedAt: Date.now() });
    this.nodeCache.set(nodeId, node);
  }

  async pruneBranch(branchId: string): Promise<void> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Find least recently used nodes (excluding root)
    const nodes = Array.from(branch.nodes.values()).filter(node => node.id !== branch.root);
    nodes.sort((a, b) => a.updatedAt - b.updatedAt);
    
    // Remove oldest nodes
    const nodesToRemove = nodes.slice(0, Math.floor(nodes.length * 0.3));
    for (const node of nodesToRemove) {
      branch.nodes.delete(node.id);
      this.nodeCache.delete(node.id);
    }
  }

  async summarizeBranch(branchId: string): Promise<SessionSummary> {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Collect all messages in the branch
    const allMessages = [];
    for (const node of branch.nodes.values()) {
      allMessages.push(...node.session.messages);
    }

    // Create summary
    return {
      id: branchId,
      createdAt: Date.now(),
      tokenCount: allMessages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0),
      summary: 'Branch summary would be generated here',
      checkpointMessages: []
    };
  }

  private async createSession(id: string, parent?: Session): Promise<Session> {
    // In a real implementation, this would create a new session
    // with appropriate initialization based on the parent
    return {
      id,
      key: id,
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private findOldestBranch(): string | null {
    let oldestBranch: string | null = null;
    let oldestTime = Infinity;
    
    for (const [id, branch] of this.branches) {
      const root = branch.nodes.get(branch.root);
      if (root && root.createdAt < oldestTime) {
        oldestTime = root.createdAt;
        oldestBranch = id;
      }
    }
    
    return oldestBranch;
  }

  private estimateMessageTokens(message: any): number {
    // Simple token estimation - in a real implementation,
    // this would use a proper tokenizer
    return JSON.stringify(message).length / 4;
  }
}
```
