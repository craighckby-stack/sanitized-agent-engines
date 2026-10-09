/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Nanobot Autonomous Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: HKUDS/nanobot
 */

import { Disposable, DisposableRegistry } from './disposables';
import { ScopeContext, ScopeTree } from './scope-tree';
import { HookRegistry } from './hooks';

/**
 * Lifecycle kernel for the Nanobot agent runtime.
 * Manages dependency injection, hook dispatch, and component lifecycle.
 */
export class NanobotLifecycleContext implements Disposable {
  private readonly scopes = new ScopeTree();
  private readonly disposables = new DisposableRegistry();
  private readonly hooks = new HookRegistry();
  
  /**
   * Create a new scope for isolated component lifetimes
   */
  createScope(parent?: ScopeContext): ScopeContext {
    return this.scopes.create(parent);
  }
  
  /**
   * Register a disposable component
   */
  register<T extends Disposable>(disposable: T): T {
    this.disposables.add(disposable);
    return disposable;
  }
  
  /**
   * Register a hook for agent lifecycle events
   */
  registerHook<T>(event: string, handler: (data: T) => Promise<void>): void {
    this.hooks.register(event, handler);
  }
  
  /**
   * Dispatch a hook event
   */
  async dispatchHook<T>(event: string, data: T): Promise<void> {
    await this.hooks.dispatch(event, data);
  }
  
  /**
   * Dispose all registered components and clear scopes
   */
  async dispose(): Promise<void> {
    await this.disposables.dispose();
    this.scopes.clear();
    this.hooks.clear();
  }
}
