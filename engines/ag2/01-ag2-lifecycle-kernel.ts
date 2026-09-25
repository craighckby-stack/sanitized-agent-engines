/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ag2 Lifecycle Kernel
 * Source Origin: ag2ai/ag2
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

export type LifecycleHookHandler<T = any> = (
  payload: T,
  ctx: ag2LifecycleContext
) => void | Promise<void>;

export interface LifecycleKernelDiagnostic {
  contextId: string;
  scope: 'global' | 'session' | 'step';
  isDisposed: boolean;
  registeredServiceCount: number;
  activeHookCount: number;
  childContextCount: number;
}

export class ag2LifecycleContext implements Disposable {
  public readonly id: string;
  public readonly parent: ag2LifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';

  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: ag2LifecycleContext) => void | Promise<void>>>();
  private disposables = new Set<Disposable>();
  private children = new Set<ag2LifecycleContext>();
  private _isDisposed = false;

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: ag2LifecycleContext | null = null) {
    this.scope = scope;
    this.parent = parent;
    this.id = `${scope}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

    if (this.parent && !this.parent.isDisposed) {
      this.parent.registerChild(this);
    }
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  private registerChild(child: ag2LifecycleContext): void {
    if (!this._isDisposed) {
      this.children.add(child);
    }
  }

  private unregisterChild(child: ag2LifecycleContext): void {
    this.children.delete(child);
  }

  public provide<T>(id: string, service: T): void {
    if (this._isDisposed) {
      throw new Error(`[ag2LifecycleContext] Cannot provide service '${id}' on disposed context '${this.id}'.`);
    }
    if (!id || typeof id !== 'string') {
      throw new Error(`[ag2LifecycleContext] Service identifier must be a non-empty string.`);
    }
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this._isDisposed) {
      throw new Error(`[ag2LifecycleContext] Cannot inject service '${id}' from disposed context '${this.id}'.`);
    }
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.inject<T>(id);
    }
    const knownKeys = Array.from(this.services.keys()).join(', ');
    throw new Error(
      `[ag2LifecycleContext] Service '${id}' not registered in context hierarchy (local services: [${knownKeys}]).`
    );
  }

  public tryInject<T>(id: string): T | undefined {
    if (this._isDisposed) {
      return undefined;
    }
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.tryInject<T>(id);
    }
    return undefined;
  }

  public has(id: string): boolean {
    if (this._isDisposed) return false;
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: ag2LifecycleContext) => void | Promise<void>): Disposable {
    if (this._isDisposed) {
      console.warn(`[ag2LifecycleContext] Attempted to subscribe to hook '${event}' on disposed context '${this.id}'.`);
      return { dispose: () => {} };
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
      console.warn(`[ag2LifecycleContext] Hook emit ignored on disposed context '${this.id}' for event '${event}'.`);
      return;
    }

    const handlers = this.hooks.get(event);
    if (handlers && handlers.size > 0) {
      const activeHandlers = Array.from(handlers);
      for (const h of activeHandlers) {
        try {
          await h(payload, this);
        } catch (err) {
          console.error(`[ag2LifecycleContext] Error in hook '${event}' on context '${this.id}':`, err);
        }
      }
    }

    if (this.parent && !this.parent.isDisposed) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): ag2LifecycleContext {
    if (this._isDisposed) {
      throw new Error(`[ag2LifecycleContext] Cannot extend a disposed context '${this.id}'.`);
    }
    return new ag2LifecycleContext(scope, this);
  }

  public getDiagnostics(): LifecycleKernelDiagnostic {
    let activeHookCount = 0;
    for (const hSet of this.hooks.values()) {
      activeHookCount += hSet.size;
    }
    return {
      contextId: this.id,
      scope: this.scope,
      isDisposed: this._isDisposed,
      registeredServiceCount: this.services.size,
      activeHookCount,
      childContextCount: this.children.size,
    };
  }

  public async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    if (this.parent) {
      this.parent.unregisterChild(this);
    }

    // Recursively dispose children first
    const activeChildren = Array.from(this.children);
    this.children.clear();
    for (const child of activeChildren) {
      try {
        await child.dispose();
      } catch (err) {
        console.warn(`[ag2LifecycleContext] Error disposing child context '${child.id}':`, err);
      }
    }

    // Dispose all tracked disposables
    const activeDisposables = Array.from(this.disposables);
    this.disposables.clear();
    for (const d of activeDisposables) {
      try {
        await d.dispose();
      } catch (err) {
        console.warn(`[ag2LifecycleContext] Dispose error in context '${this.id}':`, err);
      }
    }

    // Dispose any disposable services
    for (const [serviceKey, service] of this.services.entries()) {
      if (service && typeof (service as any).dispose === 'function') {
        try {
          await (service as Disposable).dispose();
        } catch (err) {
          console.warn(`[ag2LifecycleContext] Error disposing service '${serviceKey}':`, err);
        }
      }
    }

    this.hooks.clear();
    this.services.clear();
  }
}