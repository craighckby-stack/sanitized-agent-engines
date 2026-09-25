/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * aider Lifecycle Kernel
 * Source Origin: Aider-AI/aider
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface Disposable {
  dispose(): void | Promise<void>;
}

export type LifecycleHookName =
  | 'session:create'
  | 'session:dispose'
  | 'step:before'
  | 'step:after'
  | 'model:stream:chunk'
  | 'tool:invoke:before'
  | 'tool:invoke:after';

export class aiderLifecycleContext {
  public readonly id: string;
  public readonly parent: aiderLifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';
  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: aiderLifecycleContext) => void | Promise<void>>>();
  private disposables = new Set<Disposable>();
  private children = new Set<aiderLifecycleContext>();
  private _isDisposed = false;

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: aiderLifecycleContext | null = null) {
    this.scope = scope;
    this.parent = parent;
    const entropy = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    this.id = `${scope}_${entropy}_${timestamp}`;

    if (parent) {
      if (parent.isDisposed) {
        throw new Error(`[aiderLifecycleContext] Cannot extend a disposed parent context '${parent.id}'.`);
      }
      parent.registerChild(this);
    }
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  private assertNotDisposed(operation: string): void {
    if (this._isDisposed) {
      throw new Error(`[aiderLifecycleContext] Operation '${operation}' forbidden: context '${this.id}' is disposed.`);
    }
  }

  protected registerChild(child: aiderLifecycleContext): void {
    if (!this._isDisposed) {
      this.children.add(child);
    }
  }

  protected unregisterChild(child: aiderLifecycleContext): void {
    this.children.delete(child);
  }

  public provide<T>(id: string, service: T): void {
    this.assertNotDisposed(`provide(${id})`);
    if (!id || typeof id !== 'string') {
      throw new TypeError(`[aiderLifecycleContext] Service identifier must be a non-empty string.`);
    }
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    this.assertNotDisposed(`inject(${id})`);
    if (!id || typeof id !== 'string') {
      throw new TypeError(`[aiderLifecycleContext] Service identifier must be a non-empty string.`);
    }

    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.inject<T>(id);
    }
    throw new Error(`[aiderLifecycleContext] Service '${id}' not registered in context hierarchy.`);
  }

  public has(id: string): boolean {
    if (!id || typeof id !== 'string' || this._isDisposed) {
      return false;
    }
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: aiderLifecycleContext) => void | Promise<void>): Disposable {
    this.assertNotDisposed(`on(${event})`);
    if (!event || typeof event !== 'string') {
      throw new TypeError(`[aiderLifecycleContext] Event name must be a valid string.`);
    }
    if (typeof handler !== 'function') {
      throw new TypeError(`[aiderLifecycleContext] Handler for event '${event}' must be an executable function.`);
    }

    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    const handlers = this.hooks.get(event)!;
    handlers.add(handler as any);

    let disposed = false;
    const d: Disposable = {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        handlers.delete(handler as any);
        if (handlers.size === 0) {
          this.hooks.delete(event);
        }
        this.disposables.delete(d);
      },
    };
    this.disposables.add(d);
    return d;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    if (!event || typeof event !== 'string') {
      throw new TypeError(`[aiderLifecycleContext] Cannot emit invalid event.`);
    }

    const handlers = this.hooks.get(event);
    if (handlers && handlers.size > 0) {
      const snapshot = Array.from(handlers);
      for (const h of snapshot) {
        try {
          await h(payload, this);
        } catch (err) {
          console.error(`[aiderLifecycleContext] Error in hook '${event}' on context '${this.id}':`, err);
        }
      }
    }

    if (this.parent && !this.parent.isDisposed) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): aiderLifecycleContext {
    this.assertNotDisposed(`extend(${scope})`);
    return new aiderLifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    if (this.parent) {
      this.parent.unregisterChild(this);
    }

    // Cascade dispose to active children first
    const activeChildren = Array.from(this.children);
    this.children.clear();
    for (const child of activeChildren) {
      try {
        await child.dispose();
      } catch (err) {
        console.warn(`[aiderLifecycleContext] Child context '${child.id}' dispose error:`, err);
      }
    }

    // Dispose local disposables
    const activeDisposables = Array.from(this.disposables);
    this.disposables.clear();
    for (const d of activeDisposables) {
      try {
        await d.dispose();
      } catch (err) {
        console.warn(`[aiderLifecycleContext] Disposable release error on context '${this.id}':`, err);
      }
    }

    this.hooks.clear();
    this.services.clear();
  }
}