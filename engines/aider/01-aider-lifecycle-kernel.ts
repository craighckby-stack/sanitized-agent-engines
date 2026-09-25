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
  private _isDisposed = false;

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: aiderLifecycleContext | null = null) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    this.id = `${scope}_${timestamp}_${randomStr}`;
    this.scope = scope;
    this.parent = parent;
  }

  public provide<T>(id: string, service: T): void {
    if (this._isDisposed) {
      throw new Error(`[aiderLifecycleContext] Cannot provide service '${id}' on a disposed context.`);
    }
    if (!id || typeof id !== 'string') {
      throw new Error(`[aiderLifecycleContext] Invalid service id provided.`);
    }
    if (this.services.has(id)) {
      console.warn(`[aiderLifecycleContext] Warning: Overwriting existing service '${id}'.`);
    }
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this._isDisposed) {
      throw new Error(`[aiderLifecycleContext] Cannot inject service '${id}' from a disposed context.`);
    }
    if (!id || typeof id !== 'string') {
      throw new Error(`[aiderLifecycleContext] Invalid service id requested.`);
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
    if (this._isDisposed) return false;
    if (!id || typeof id !== 'string') return false;
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: aiderLifecycleContext) => void | Promise<void>): Disposable {
    if (this._isDisposed) {
      throw new Error(`[aiderLifecycleContext] Cannot register hook for '${event}' on a disposed context.`);
    }
    if (!event || typeof handler !== 'function') {
      throw new Error(`[aiderLifecycleContext] Invalid event name or handler function.`);
    }

    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    const handlers = this.hooks.get(event)!;
    handlers.add(handler as any);

    const d: Disposable = {
      dispose: () => {
        if (this.hooks.has(event)) {
          this.hooks.get(event)!.delete(handler as any);
        }
        this.disposables.delete(d);
      },
    };
    this.disposables.add(d);
    return d;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    if (this._isDisposed) {
      console.warn(`[aiderLifecycleContext] Warning: Attempted to emit event '${event}' on a disposed context.`);
      return;
    }
    if (!event) return;

    const handlers = this.hooks.get(event);
    if (handlers && handlers.size > 0) {
      const handlersSnapshot = Array.from(handlers);
      for (const h of handlersSnapshot) {
        try {
          await h(payload, this);
        } catch (err) {
          console.error(`[aiderLifecycleContext] Error in hook '${event}':`, err instanceof Error ? err.message : err);
        }
      }
    }
    if (this.parent) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): aiderLifecycleContext {
    if (this._isDisposed) {
      throw new Error(`[aiderLifecycleContext] Cannot extend a disposed context.`);
    }
    return new aiderLifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    if (this._isDisposed) return;
    this._isDisposed = true;

    const disposables = Array.from(this.disposables);
    this.disposables.clear();
    
    for (const d of disposables) {
      try {
        if (d && typeof d.dispose === 'function') {
          await d.dispose();
        }
      } catch (err) {
        console.warn(`[aiderLifecycleContext] Dispose error:`, err instanceof Error ? err.message : err);
      }
    }
    
    this.hooks.clear();
    this.services.clear();
  }
}