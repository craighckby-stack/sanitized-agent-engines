/* GLM-Engine-Harvester [2026-10-09T02:47:39.180Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Front-End Checklist Engine — Lifecycle Kernel
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class frontendChecklistLifecycleContext {
  private disposables: Set<() => void> = new Set();
  private hooks: Map<string, Function[]> = new Map();
  
  /**
   * Register a new hook function
   * @param name - Hook name
   * @param fn - Hook function to register
   */
  registerHook(name: string, fn: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(fn);
  }
  
  /**
   * Execute all hooks for a given name
   * @param name - Hook name
   * @param args - Arguments to pass to hooks
   */
  executeHooks(name: string, ...args: any[]): void {
    const hooks = this.hooks.get(name) || [];
    hooks.forEach(hook => hook(...args));
  }
  
  /**
   * Register a disposable function
   * @param dispose - Function to call when disposing
   */
  registerDisposable(dispose: () => void): void {
    this.disposables.add(dispose);
  }
  
  /**
   * Dispose all registered disposables
   */
  dispose(): void {
    this.disposables.forEach(dispose => dispose());
    this.disposables.clear();
    this.hooks.clear();
  }
}
