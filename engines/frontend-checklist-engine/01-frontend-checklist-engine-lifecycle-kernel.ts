/* GLM-Engine-Harvester [2026-10-09T04:38:32.866Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Frontend Checklist Autonomous Agent Engine — Lifecycle Kernel
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistLifecycleContext {
  private disposables: Disposable[] = [];
  private scopes: Map<string, Scope> = new Map();
  
  constructor(private config: EngineConfig) {}
  
  /**
   * Register a disposable resource to be cleaned up when scope is disposed
   */
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  /**
   * Create a new execution scope with isolated state
   */
  createScope(id: string): Scope {
    const scope = new Scope(id);
    this.scopes.set(id, scope);
    return scope;
  }
  
  /**
   * Dispose of a scope and all its resources
   */
  disposeScope(id: string): void {
    const scope = this.scopes.get(id);
    if (scope) {
      scope.dispose();
      this.scopes.delete(id);
    }
  }
  
  /**
   * Hook dispatcher for lifecycle events
   */
  dispatchHook(event: LifecycleEvent, payload?: any): void {
    this.config.hooks?.[event]?.forEach(hook => hook(payload));
  }
  
  /**
   * Clean up all resources
   */
  dispose(): void {
    this.scopes.forEach(scope => scope.dispose());
    this.scopes.clear();
    
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (disposable && typeof disposable.dispose === 'function') {
        disposable.dispose();
      }
    }
  }
}

interface EngineConfig {
  hooks?: Partial<Record<LifecycleEvent, ((payload?: any) => void)[]>>;
}

type LifecycleEvent = 'beforeInit' | 'afterInit' | 'beforeDispose' | 'afterDispose';

interface Scope {
  id: string;
  state: Map<string, any>;
  dispose(): void;
}

class Scope {
  constructor(public id: string, public state = new Map<string, any>()) {}
  
  dispose(): void {
    this.state.clear();
  }
}

interface Disposable {
  dispose(): void;
}
