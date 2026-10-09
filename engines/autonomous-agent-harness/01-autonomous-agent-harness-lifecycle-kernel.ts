/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Autonomous Agent Harness Engine — Lifecycle Kernel
 * Source Origin: zhayujie/CowAgent
 */

import { Disposable, IDisposable } from './types';

/**
 * Lifecycle Kernel - Dependency injection, hook dispatch, disposable registry, and scope tree
 */
export class autonomousAgentHarnessLifecycleContext implements Disposable {
  private parent?: autonomousAgentHarnessLifecycleContext;
  private children: Set<autonomousAgentHarnessLifecycleContext> = new Set();
  private services: Map<string, any> = new Map();
  private disposables: Set<IDisposable> = new Set();
  private hooks: Map<string, Function[]> = new Map();

  constructor(parent?: autonomousAgentHarnessLifecycleContext) {
    this.parent = parent;
    if (parent) {
      parent.children.add(this);
    }
  }

  /**
   * Register a service instance in this scope
   */
  registerService<T>(name: string, instance: T): T {
    this.services.set(name, instance);
    return instance;
  }

  /**
   * Get a service from this scope or parent scopes
   */
  getService<T>(name: string): T | undefined {
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    return this.parent?.getService<T>(name);
  }

  /**
   * Add a hook function for a specific event
   */
  addHook(event: string, fn: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(fn);
  }

  /**
   * Dispatch an event to all registered hooks
   */
  dispatch(event: string, ...args: any[]): void {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      try {
        hook(...args);
      } catch (err) {
        console.error(`Error in hook ${event}:`, err);
      }
    }
    this.parent?.dispatch(event, ...args);
  }

  /**
   * Register a disposable resource
   */
  registerDisposable(disposable: IDisposable): void {
    this.disposables.add(disposable);
  }

  /**
   * Create a child scope
   */
  createChild(): autonomousAgentHarnessLifecycleContext {
    return new autonomousAgentHarnessLifecycleContext(this);
  }

  /**
   * Dispose this scope and all children
   */
  dispose(): void {
    for (const child of this.children) {
      child.dispose();
    }
    
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (err) {
        console.error('Error disposing resource:', err);
      }
    }
    
    this.disposables.clear();
    this.children.clear();
    this.services.clear();
    this.hooks.clear();
    
    if (this.parent) {
      this.parent.children.delete(this);
    }
  }
}
