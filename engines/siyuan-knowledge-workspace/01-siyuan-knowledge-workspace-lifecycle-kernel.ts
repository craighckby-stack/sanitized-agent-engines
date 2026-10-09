/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Siyuan Knowledge Workspace Engine — Lifecycle Kernel
 * Source Origin: siyuan-note/siyuan
 */

export class siyuanLifecycleContext {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private scopes: Map<string, any> = new Map();
  private disposables: (() => void)[] = [];

  /**
   * Register a service with the lifecycle context
   */
  registerService<T>(name: string, service: T): T {
    this.services.set(name, service);
    return service;
  }

  /**
   * Get a registered service
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /**
   * Register a lifecycle hook
   */
  addHook(name: string, callback: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(callback);
  }

  /**
   * Execute all hooks for a given event
   */
  async executeHooks(name: string, ...args: any[]): Promise<void> {
    const callbacks = this.hooks.get(name) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  /**
   * Create a new scope
   */
  createScope(name: string, parent?: any): any {
    const scope = Object.create(parent || null);
    this.scopes.set(name, scope);
    return scope;
  }

  /**
   * Get a scope by name
   */
  getScope(name: string): any | undefined {
    return this.scopes.get(name);
  }

  /**
   * Register a disposable function to be called on teardown
   */
  registerDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }

  /**
   * Dispose all registered disposables and clean up resources
   */
  async dispose(): Promise<void> {
    for (const dispose of this.disposables.reverse()) {
      try {
        await dispose();
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.services.clear();
    this.hooks.clear();
    this.scopes.clear();
    this.disposables = [];
  }
}
