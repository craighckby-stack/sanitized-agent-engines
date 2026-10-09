/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Nanobot Autonomous Agent Framework Engine — Lifecycle Kernel
 * Source Origin: HKUDS/nanobot
 */

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
