/* GLM-Engine-Harvester [2026-10-09T02:42:13.566Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Hermes Autonomous Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: NousResearch/hermes-agent
 */

import { Disposable, IDisposable } from './disposable';

class hermesLifecycleContext {
  private disposables: Set<IDisposable> = new Set();
  private hooks: Map<string, Function[]> = new Map();
  private scopes: Map<string, hermesLifecycleContext> = new Map();
  
  constructor(private parent?: hermesLifecycleContext) {}
  
  registerDisposable(disposable: IDisposable): void {
    this.disposables.add(disposable);
  }
  
  addHook(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }
  
  async triggerHook(event: string, ...args: any[]): Promise<void> {
    const callbacks = this.hooks.get(event) || [];
    for (const callback of callbacks) {
      try {
        await callback(...args);
      } catch (error) {
        console.error(`Hook ${event} failed:`, error);
      }
    }
    if (this.parent) {
      await this.parent.triggerHook(event, ...args);
    }
  }
  
  createScope(name: string): hermesLifecycleContext {
    const scope = new hermesLifecycleContext(this);
    this.scopes.set(name, scope);
    return scope;
  }
  
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      try {
        if (typeof disposable.dispose === 'function') {
          await disposable.dispose();
        }
      } catch (error) {
        console.error('Error during disposal:', error);
      }
    }
    this.disposables.clear();
    
    for (const [name, scope] of this.scopes) {
      await scope.dispose();
      this.scopes.delete(name);
    }
    
    this.hooks.clear();
  }
}
