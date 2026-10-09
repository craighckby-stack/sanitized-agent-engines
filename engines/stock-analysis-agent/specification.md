/* GLM-Engine-Harvester [2026-10-09T04:26:15.161Z] */
# Stock Analysis Agent Runtime Engine Specification

*Sanitized Clean-Room Architectural Engine Specification & Complete Implementation Code*

> Source origin: A multi-market stock analysis system with LLM-powered agent interface, real-time data integration, and automated decision support.

## 1. Architectural Topology & Component Overview

The Stock Analysis Agent Runtime Engine is a modular architecture designed for autonomous stock market analysis. It consists of five core engines:

1. **Lifecycle Kernel** - Dependency injection, hook dispatch, and resource management
2. **ReAct Agent Loop** - Multi-turn reasoning with tool execution and step budgeting
3. **Model Stream Adapter** - Unified interface for LLM interactions with token streaming
4. **Tool Sandbox & VFS** - Secure execution environment with virtual file system
5. **Session Tree & Token Budget** - Non-linear conversation management with memory pruning

## Engine 1: Lifecycle Kernel

### What it does
The Lifecycle Kernel manages the application's dependency injection system, service registration, lifecycle hooks, and execution scopes. It provides a clean way to manage resources and their dependencies throughout the application's lifecycle.

### Inputs & Outputs
- **Inputs**: Service instances, hook callbacks, scope definitions
- **Outputs**: Resolved service instances, hook execution results, scope management

### Implementation Code
```typescript
import { Disposable, EventEmitter } from 'events';

/**
 * Core lifecycle kernel for the Stock Analysis Agent
 * Handles dependency injection, hook dispatch, and resource management
 */
export class stockAnalysisAgentLifecycleContext extends Disposable {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private scopes: Map<string, Set<string>> = new Map();
  
  /**
   * Register a service with the DI container
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
    this.emit('serviceRegistered', { name, service });
  }
  
  /**
   * Retrieve a service from the DI container
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name);
  }
  
  /**
   * Register a lifecycle hook
   */
  addHook(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }
  
  /**
   * Execute all hooks for a given event
   */
  async executeHooks(event: string, ...args: any[]): Promise<any[]> {
    const callbacks = this.hooks.get(event) || [];
    return Promise.all(callbacks.map(cb => cb(...args)));
  }
  
  /**
   * Create a new execution scope
   */
  createScope(name: string): void {
    this.scopes.set(name, new Set());
  }
  
  /**
   * Add a service to a scope
   */
  addToScope(scopeName: string, serviceName: string): void {
    const scope = this.scopes.get(scopeName);
    if (scope) {
      scope.add(serviceName);
    }
  }
  
  /**
   * Dispose of a scope and its services
   */
  disposeScope(scopeName: string): void {
    const scope = this.scopes.get(scopeName);
    if (scope) {
      for (const serviceName of scope) {
        this.services.delete(serviceName);
      }
      this.scopes.delete(scopeName);
    }
  }
  
  /**
   * Clean up all resources
   */
  protected dispose(): void {
    this.services.clear();
    this.hooks.clear();
    this.scopes.clear();
  }
}
```

## Engine 2: ReAct Agent Loop

### What it does
The ReAct Agent Loop implements the reasoning and acting cycle that powers the stock analysis agent. It manages multi-turn conversations, executes tools based on reasoning, and maintains a trajectory of the agent's thought process. The loop includes step budgeting to prevent infinite reasoning.

### Inputs & Outputs
- **Inputs**: User query, conversation context, available tools
- **Outputs**: Analysis results, tool execution results, trajectory history

### Implementation Code
```typescript
import { EventEmitter } from 'events';
import { stockAnalysisAgentLifecycleContext } from './stockAnalysisAgentLifecycleContext';

/**
 * ReAct agent loop engine for stock analysis
 * Implements multi-turn reasoning with tool execution
 */
export class stockAnalysisAgentLoopEngine extends EventEmitter {
  private context: stockAnalysisAgentLifecycleContext;
  private stepBudget: number;
  private trajectory: any[] = [];
  
  constructor(context: stockAnalysisAgentLifecycleContext, stepBudget = 20) {
    super();
    this.context = context;
    this.stepBudget = stepBudget;
  }
  
  /**
   * Execute the ReAct loop with given input
   */
  async execute(input: string, context?: any): Promise<any> {
    this.trajectory = [];
    let remainingSteps = this.stepBudget;
    let currentThought = input;
    
    while (remainingSteps > 0) {
      remainingSteps--;
      
      // Reason step
      const reasoning = await this.reason(currentThought, context);
      this.trajectory.push({ type: 'reason', content: reasoning });
      
      // Check if reasoning contains action
      if (this.needsAction(reasoning)) {
        // Action step
        const action = this.extractAction(reasoning);
        const observation = await this.executeAction(action, context);
        this.trajectory.push({ type: 'action', content: action, result: observation });
        
        // Update thought with observation
        currentThought = `${reasoning}\nObservation: ${observation}`;
      } else {
        // Final answer
        return {
          result: reasoning,
          trajectory: this.trajectory,
          stepsUsed: this.stepBudget - remainingSteps
        };
      }
    }
    
    throw new Error('Step budget exceeded');
  }
  
  /**
   * Reasoning step - analyze current state and determine next action
   */
  private async reason(input: string, context?: any): Promise<string> {
    // In a real implementation, this would call the LLM
    // For now, return a placeholder response
    return `Analyzing stock data based on input: ${input}`;
  }
  
  /**
   * Check if reasoning requires an action
   */
  private needsAction(reasoning: string): boolean {
    // Simple heuristic - check for action keywords
    return reasoning.toLowerCase().includes('get') || 
           reasoning.toLowerCase().includes('analyze') ||
           reasoning.toLowerCase().includes('search');
  }
  
  /**
   * Extract action from reasoning
   */
  private extractAction(reasoning: string): any {
    // In a real implementation, parse the action from reasoning
    return {
      tool: 'get_stock_info',
      params: { symbol: 'AAPL' }
    };
  }
  
  /**
   * Execute the extracted action
   */
  private async executeAction(action: any, context?: any): Promise<any> {
    // In a real implementation, this would call the appropriate tool
    // For now, return a placeholder response
    return `Executed ${action.tool} with params: ${JSON.stringify(action.params)}`;
  }
  
  /**
   * Get the current trajectory
   */
  getTrajectory(): any[] {
    return [...this.trajectory];
  }
}
```

## Engine 3: Model Stream Adapter

### What it does
The Model Stream Adapter provides a unified interface for interacting with language models. It handles streaming responses, token management, and reconstruction of tool calls from partial JSON. The adapter supports both regular and streaming chat modes.

### Inputs & Outputs
- **Inputs**: Conversation history, model parameters, tool definitions
- **Outputs**: Streaming response chunks, reconstructed tool calls, complete responses

### Implementation Code
```typescript
import { EventEmitter } from 'events';
import { stockAnalysisAgentLifecycleContext } from './stockAnalysisAgentLifecycleContext';

/**
 * Unified model stream adapter for LLM interactions
 * Handles streaming tokens, thought isolation, and tool-call reconstruction
 */
export class stockAnalysisAgentModelStream extends EventEmitter {
  private context: stockAnalysisAgentLifecycleContext;
  private activeStreams: Map<string, AbortController> = new Map();
  
  constructor(context: stockAnalysisAgentLifecycleContext) {
    super();
    this.context = context;
  }
  
  /**
   * Create a new streaming chat session
   */
  async createStream(
    messages: any[],
    options: {
      temperature?: number;
      maxTokens?: number;
      tools?: any[];
    } = {}
  ): Promise<ReadableStream> {
    const streamId = this.generateStreamId();
    const controller = new AbortController();
    this.activeStreams.set(streamId, controller);
    
    try {
      // In a real implementation, this would connect to the actual LLM API
      // For now, create a mock stream
      const mockStream = this.createMockStream(messages, options);
      
      return new ReadableStream({
        async start(controller) {
          for await (const chunk of mockStream) {
            if (controller.signal.aborted) break;
            controller.enqueue(chunk);
          }
          controller.close();
        },
        cancel() {
          controller.abort();
        }
      });
    } catch (error) {
      this.activeStreams.delete(streamId);
      throw error;
    }
  }
  
  /**
   * Cancel an active stream
   */
  cancelStream(streamId: string): void {
    const controller = this.activeStreams.get(streamId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(streamId);
    }
  }
  
  /**
   * Process streaming tokens and reconstruct tool calls
   */
  private async* processStream(stream: ReadableStream): AsyncGenerator<any> {
    let buffer = '';
    let inToolCall = false;
    let currentToolCall: any = null;
    
    for await (const chunk of stream) {
      buffer += chunk;
      
      // Check for tool call start
      if (buffer.includes('tool_call:')) {
        inToolCall = true;
        const startIndex = buffer.indexOf('tool_call:') + 'tool_call:'.length;
        buffer = buffer.substring(startIndex);
      }
      
      // If in tool call, accumulate content
      if (inToolCall) {
        const endIndex = buffer.indexOf('tool_call_end');
        if (endIndex !== -1) {
          const toolContent = buffer.substring(0, endIndex);
          currentToolCall = JSON.parse(toolContent);
          yield {
            type: 'tool_call',
            content: currentToolCall
          };
          buffer = buffer.substring(endIndex + 'tool_call_end'.length);
          inToolCall = false;
          currentToolCall = null;
        }
      } else {
        // Regular content
        yield {
          type: 'content',
          content: chunk
        };
      }
    }
  }
  
  /**
   * Create a mock stream for demonstration
   */
  private async* createMockStream(messages: any[], options: any): AsyncGenerator<any> {
    const responses = [
      'I need to analyze the stock data for you.',
      'Let me get the real-time quote for the requested stock.',
      'Based on the analysis, I recommend considering this stock for investment.'
    ];
    
    for (const response of responses) {
      // Simulate streaming response
      for (const char of response) {
        yield char;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Simulate tool call
      if (response.includes('get the real-time quote')) {
        yield '\n\ntool_call: {"tool": "get_realtime_quote", "params": {"symbol": "AAPL"}}\n\ntool_call_end';
      }
      
      yield '\n\n';
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  /**
   * Generate a unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Engine 4: Tool Sandbox & VFS

### What it does
The Tool Sandbox & VFS provides a secure execution environment for stock analysis tools. It implements a virtual file system for data management and isolates tool execution to prevent security risks. The sandbox includes output sanitization to prevent injection attacks.

### Inputs & Outputs
- **Inputs**: Tool names, parameters, file system operations
- **Outputs**: Tool results, file system state, sanitized outputs

### Implementation Code
```typescript
import { EventEmitter } from 'events';
import { stockAnalysisAgentLifecycleContext } from './stockAnalysisAgentLifecycleContext';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool sandbox and virtual file system for safe tool execution
 */
export class stockAnalysisAgentToolSandbox extends EventEmitter {
  private context: stockAnalysisAgentLifecycleContext;
  private vfs: Map<string, any> = new Map();
  private allowedTools: Set<string> = new Set([
    'get_realtime_quote',
    'get_daily_history',
    'get_chip_distribution',
    'get_analysis_context',
    'get_stock_info',
    'search_stock_news',
    'search_comprehensive_intel',
    'analyze_trend',
    'calculate_ma',
    'get_volume_analysis',
    'analyze_pattern',
    'get_market_indices',
    'get_sector_rankings',
    'get_skill_backtest_summary',
    'get_strategy_backtest_summary',
    'get_stock_backtest_summary'
  ]);
  
  constructor(context: stockAnalysisAgentLifecycleContext) {
    super();
    this.context = context;
    this.initializeVFS();
  }
  
  /**
   * Initialize the virtual file system
   */
  private initializeVFS(): void {
    // Create root directories
    this.vfs.set('/', { type: 'directory', children: new Set() });
    this.vfs.set('/data', { type: 'directory', children: new Set() });
    this.vfs.set('/tmp', { type: 'directory', children: new Set() });
    
    // Add some initial data
    this.vfs.set('/data/stocks', { 
      type: 'directory', 
      children: new Set(['AAPL.json', 'GOOGL.json', 'MSFT.json']) 
    });
    
    // Add sample stock data
    this.vfs.set('/data/stocks/AAPL.json', {
      type: 'file',
      content: JSON.stringify({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 175.25,
        change: 1.23,
        changePercent: 0.71
      })
    });
  }
  
  /**
   * Execute a tool in the sandbox
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    if (!this.allowedTools.has(toolName)) {
      throw new Error(`Tool ${toolName} is not allowed`);
    }
    
    try {
      // Create a temporary file for the tool execution
      const tempFile = `/tmp/tool_${Date.now()}.json`;
      this.writeFile(tempFile, JSON.stringify(params));
      
      // Execute the tool
      const result = await this.runTool(toolName, tempFile);
      
      // Clean up
      this.deleteFile(tempFile);
      
      return result;
    } catch (error) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }
  
  /**
   * Run the actual tool implementation
   */
  private async runTool(toolName: string, inputFile: string): Promise<any> {
    // In a real implementation, this would call the actual tool functions
    // For now, return mock responses based on tool name
    
    switch (toolName) {
      case 'get_realtime_quote':
        return {
          symbol: 'AAPL',
          price: 175.25,
          change: 1.23,
          changePercent: 0.71,
          volume: '52.3M',
          timestamp: new Date().toISOString()
        };
        
      case 'get_stock_info':
        return {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          marketCap: '2.74T',
          pe: 29.84,
          dividend: 0.96
        };
        
      case 'search_stock_news':
        return [
          {
            title: 'Apple Announces New Product Line',
            source: 'Tech News',
            date: new Date().toISOString(),
            summary: 'Apple unveiled its latest product lineup...'
          },
          {
            title: 'Analysts Raise Price Target for Apple',
            source: 'Market Watch',
            date: new Date(Date.now() - 86400000).toISOString(),
            summary: 'Several investment firms increased their price targets...'
          }
        ];
        
      default:
        return { result: `Mock result for ${toolName}` };
    }
  }
  
  /**
   * Write to the virtual file system
   */
  writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!this.vfs.has(dir)) {
      this.createDirectory(dir);
    }
    
    // Write file
    this.vfs.set(filePath, {
      type: 'file',
      content: content
    });
    
    // Update directory listing
    const parentDir = this.vfs.get(dir);
    if (parentDir && parentDir.type === 'directory') {
      parentDir.children.add(path.basename(filePath));
    }
  }
  
  /**
   * Read from the virtual file system
   */
  readFile(filePath: string): string {
    const file = this.vfs.get(filePath);
    if (!file || file.type !== 'file') {
      throw new Error(`File not found: ${filePath}`);
    }
    return file.content;
  }
  
  /**
   * Delete a file from the virtual file system
   */
  deleteFile(filePath: string): void {
    if (!this.vfs.has(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Remove file
    this.vfs.delete(filePath);
    
    // Update directory listing
    const dir = path.dirname(filePath);
    const parentDir = this.vfs.get(dir);
    if (parentDir && parentDir.type === 'directory') {
      parentDir.children.delete(path.basename(filePath));
    }
  }
  
  /**
   * Create a directory in the virtual file system
   */
  createDirectory(dirPath: string): void {
    if (this.vfs.has(dirPath)) {
      throw new Error(`Directory already exists: ${dirPath}`);
    }
    
    this.vfs.set(dirPath, {
      type: 'directory',
      children: new Set()
    });
    
    // Update parent directory listing
    const parentDir = path.dirname(dirPath);
    if (parentDir !== '/' && this.vfs.has(parentDir)) {
      const parent = this.vfs.get(parentDir);
      if (parent && parent.type === 'directory') {
        parent.children.add(path.basename(dirPath));
      }
    }
  }
  
  /**
   * Sanitize tool output to prevent injection attacks
   */
  sanitizeOutput(output: any): any {
    if (typeof output === 'string') {
      // Remove potentially dangerous characters
      return output.replace(/[<>"'&]/g, '');
    } else if (typeof output === 'object') {
      // Recursively sanitize object properties
      const sanitized: any = {};
      for (const key in output) {
        sanitized[key] = this.sanitizeOutput(output[key]);
      }
      return sanitized;
    }
    return output;
  }
}
```

## Engine 5: Session Tree & Token Budget

### What it does
The Session Tree & Token Budget manages non-linear conversation flows with memory efficiency. It maintains a branching tree of conversation nodes, tracks token usage, and implements pruning to stay within budget. This allows for complex multi-turn conversations while managing memory constraints.

### Inputs & Outputs
- **Inputs**: User messages, branching decisions, token limits
- **Outputs**: Current conversation state, tree structure, token usage report

### Implementation Code
```typescript
import { EventEmitter } from 'events';
import { stockAnalysisAgentLifecycleContext } from './stockAnalysisAgentLifecycleContext';

/**
 * Non-linear session tree with token budget management
 */
export class stockAnalysisAgentSessionTree extends EventEmitter {
  private context: stockAnalysisAgentLifecycleContext;
  private root: SessionNode;
  private currentNode: SessionNode;
  private tokenBudget: number;
  private usedTokens: number;
  private maxBranches: number;
  
  constructor(context: stockAnalysisAgentLifecycleContext, tokenBudget = 4000, maxBranches = 5) {
    super();
    this.context = context;
    this.tokenBudget = tokenBudget;
    this.usedTokens = 0;
    this.maxBranches = maxBranches;
    
    // Create root node
    this.root = {
      id: 'root',
      parentId: null,
      children: new Set(),
      messages: [],
      metadata: {},
      createdAt: new Date(),
      isLeaf: false
    };
    
    this.currentNode = this.root;
  }
  
  /**
   * Add a message to the current session node
   */
  addMessage(role: string, content: string, metadata?: any): void {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      metadata: metadata || {},
      timestamp: new Date()
    };
    
    this.currentNode.messages.push(message);
    this.usedTokens += this.estimateTokens(content);
    
    this.emit('messageAdded', { node: this.currentNode, message });
  }
  
  /**
   * Create a new branch from the current node
   */
  createBranch(branchId: string, metadata?: any): SessionNode {
    if (this.currentNode.children.size >= this.maxBranches) {
      throw new Error('Maximum number of branches reached');
    }
    
    const newNode: SessionNode = {
      id: branchId,
      parentId: this.currentNode.id,
      children: new Set(),
      messages: [...this.currentNode.messages],
      metadata: metadata || {},
      createdAt: new Date(),
      isLeaf: false
    };
    
    // Add to parent
    this.currentNode.children.add(branchId);
    
    // Add to node registry
    (this.root as any)[branchId] = newNode;
    
    this.emit('branchCreated', { parent: this.currentNode, child: newNode });
    return newNode;
  }
  
  /**
   * Switch to a different node in the session tree
   */
  switchNode(nodeId: string): void {
    const node = (this.root as any)[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    
    this.currentNode = node;
    this.emit('nodeSwitched', { node });
  }
  
  /**
   * Get the current session node
   */
  getCurrentNode(): SessionNode {
    return this.currentNode;
  }
  
  /**
   * Get the session tree structure
   */
  getTreeStructure(): SessionNode {
    return JSON.parse(JSON.stringify(this.root));
  }
  
  /**
   * Check if token budget is exceeded
   */
  isTokenBudgetExceeded(): boolean {
    return this.usedTokens > this.tokenBudget;
  }
  
  /**
   * Get remaining token budget
   */
  getRemainingTokens(): number {
    return Math.max(0, this.tokenBudget - this.usedTokens);
  }
  
  /**
   * Prune the tree to save memory
   */
  prune(): void {
    this.pruneNode(this.root);
    this.emit('treePruned');
  }
  
  /**
   * Recursively prune nodes
   */
  private pruneNode(node: SessionNode): void {
    if (node.children.size === 0 && node !== this.currentNode && node !== this.root) {
      // Remove leaf node that's not current or root
      const parent = (this.root as any)[node.parentId];
      if (parent) {
        parent.children.delete(node.id);
        delete (this.root as any)[node.id];
      }
    } else {
      // Recursively prune children
      for (const childId of node.children) {
        const child = (this.root as any)[childId];
        if (child) {
          this.pruneNode(child);
        }
      }
    }
  }
  
  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    // Simple approximation: 1 token ≈ 4 characters for English
    return Math.ceil(content.length / 4);
  }
}

/**
 * Session node interface
 */
interface SessionNode {
  id: string;
  parentId: string | null;
  children: Set<string>;
  messages: any[];
  metadata: any;
  createdAt: Date;
  isLeaf: boolean;
}
```
