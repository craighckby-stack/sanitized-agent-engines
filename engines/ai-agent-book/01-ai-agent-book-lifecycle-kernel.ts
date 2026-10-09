/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: AI Agent Book Companion Engine — Lifecycle Kernel
 * Source Origin: bojieli/ai-agent-book
 */

import { Disposable, LifecycleContext } from './types';

/**
 * Lifecycle Kernel for the AI Agent Book Companion Engine
 * Handles dependency injection, hook dispatch, disposable registry, and scope tree
 */
export class AiAgentBookLifecycleContext implements LifecycleContext {
  private disposables: Disposable[] = [];
  private scopes: Map<string, any> = new Map();
  
  /**
   * Register a disposable resource to be cleaned up
   */
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  /**
   * Create a new scope for isolated resources
   */
  createScope(name: string): void {
    this.scopes.set(name, new Map());
  }
  
  /**
   * Get a resource from a specific scope
   */
  getFromScope<T>(scopeName: string, key: string): T | undefined {
    const scope = this.scopes.get(scopeName);
    return scope?.get(key);
  }
  
  /**
   * Set a resource in a specific scope
   */
  setInScope(scopeName: string, key: string, value: any): void {
    const scope = this.scopes.get(scopeName) || new Map();
    scope.set(key, value);
    this.scopes.set(scopeName, scope);
  }
  
  /**
   * Dispatch lifecycle hooks
   */
  async dispatchHook(hookName: string, ...args: any[]): Promise<any> {
    // Implementation would iterate through registered hooks
    // and execute them in order
    return null;
  }
  
  /**
   * Clean up all registered disposables
   */
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    this.disposables = [];
    this.scopes.clear();
  }
}
