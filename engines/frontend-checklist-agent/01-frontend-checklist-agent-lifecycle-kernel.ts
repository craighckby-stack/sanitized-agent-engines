/* GLM-Engine-Harvester [2026-10-09T03:30:29.651Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Frontend Checklist Agent Engine — Lifecycle Kernel
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistLifecycleContext {
  private disposables: Array<() => void> = [];
  private hooks: Map<string, Array<(...args: any[]) => any>> = new Map();

  /** Register a disposable resource to be cleaned up */
  registerDisposable(dispose: () => void) {
    this.disposables.push(dispose);
  }

  /** Register a hook for a specific event */
  registerHook(event: string, callback: (...args: any[]) => any) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }

  /** Trigger all hooks for a specific event */
  async triggerHooks(event: string, ...args: any[]) {
    const callbacks = this.hooks.get(event) || [];
    await Promise.all(callbacks.map(cb => cb(...args)));
  }

  /** Clean up all registered disposables */
  dispose() {
    this.disposables.forEach(dispose => dispose());
    this.disposables = [];
    this.hooks.clear();
  }
}
