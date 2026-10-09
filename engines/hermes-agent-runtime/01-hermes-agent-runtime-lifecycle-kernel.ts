/* GLM-Engine-Harvester [2026-10-09T02:52:52.183Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Hermes Autonomous Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: NousResearch/hermes-agent
 */

import { Disposable, Scope } from './types';

class HermesLifecycleContext implements Disposable {
  private scopes: Map<string, Scope> = new Map();
  private disposables: Set<Disposable> = new Set();
  private hooks: Map<string, Function[]> = new Map();
  
  constructor(private rootScope: Scope = 'root') {
    this.scopes.set(rootScope, { parent: null, children: new Set() });
  }
  
  createScope(name: string, parent?: string): Scope {
    const parentScope = parent || this.rootScope;
    if (!this.scopes.has(parentScope)) {
      throw new Error(`Parent scope '${parentScope}' not found`);
    }
    
    const scope: Scope = { parent: parentScope, children: new Set() };
    this.scopes.set(name, scope);
    this.scopes.get(parentScope)!.children.add(name);
    
    return name;
  }
  
  addDisposable(disposable: Disposable): void {
    this.disposables.add(disposable);
  }
  
  addHook(hookName: string, callback: Function): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push(callback);
  }
  
  async triggerHook(hookName: string, ...args: any[]): Promise<any[]> {
    const results: any[] = [];
    const callbacks = this.hooks.get(hookName) || [];
    
    for (const callback of callbacks) {
      try {
        const result = await callback(...args);
        results.push(result);
      } catch (error) {
        console.error(`Error in hook '${hookName}':`, error);
      }
    }
    
    return results;
  }
  
  dispose(): void {
    // Dispose in reverse order of creation
    const disposeStack = Array.from(this.scopes.keys()).reverse();
    
    for (const scopeName of disposeStack) {
      const scope = this.scopes.get(scopeName);
      if (scope && scope.parent) {
        this.scopes.get(scope.parent)!.children.delete(scopeName);
      }
      this.scopes.delete(scopeName);
    }
    
    for (const disposable of this.disposables) {
      try {
        if (typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
      } catch (error) {
        console.error('Error during disposal:', error);
      }
    }
    
    this.disposables.clear();
    this.hooks.clear();
  }
}
