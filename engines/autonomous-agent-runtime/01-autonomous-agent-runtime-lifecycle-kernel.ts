/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Autonomous Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: NousResearch/hermes-agent
 */

import { Disposable, Scope } from './types';

/**
 * Lifecycle Kernel - Dependency injection, hook dispatch, and disposable registry
 */
export class AutonomousAgentLifecycleContext implements Disposable {
  private services = new Map<string, any>();
  private disposables: Disposable[] = [];
  private scopes = new Map<string, Scope>();
  private hooks = new Map<string, Function[]>();

  /** Register a service instance */
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
    if (service instanceof Disposable) {
      this.disposables.push(service);
    }
  }

  /** Retrieve a registered service */
  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  /** Create a new scope for isolated execution */
  createScope(name: string): Scope {
    const scope = new Scope(name);
    this.scopes.set(name, scope);
    return scope;
  }

  /** Get or create a scope */
  getOrCreateScope(name: string): Scope {
    return this.scopes.get(name) || this.createScope(name);
  }

  /** Register a lifecycle hook */
  onHook(name: string, callback: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(callback);
  }

  /** Execute all hooks for an event */
  async triggerHook(name: string, ...args: any[]): Promise<void> {
    const callbacks = this.hooks.get(name) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  /** Dispose all resources */
  async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      if (typeof disposable.dispose === 'function') {
        await disposable.dispose();
      }
    }
    this.services.clear();
    this.disposables = [];
    this.scopes.clear();
    this.hooks.clear();
  }
}

/** Scope for isolated execution contexts */
export class Scope {
  constructor(public name: string) {}

  private variables = new Map<string, any>();

  set<T>(key: string, value: T): void {
    this.variables.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.variables.get(key) as T | undefined;
  }

  clear(): void {
    this.variables.clear();
  }
}
