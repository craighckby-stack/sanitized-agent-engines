/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * claude-seo Lifecycle Kernel
 * Source Origin: https://github.com/AgriciDaniel/claude-seo
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
  | 'tool:invoke:after'
  | (string & {});

export type LifecycleHookHandler<T = any> = (
  payload: T,
  ctx: ClaudeSeoLifecycleContext
) => void | Promise<void>;

export interface HookOptions {
  once?: boolean;
  priority?: number;
}

interface StoredHook {
  handler: LifecycleHookHandler<any>;
  once: boolean;
  priority: number;
}

export class ClaudeSeoLifecycleContext implements Disposable {
  public readonly id: string;
  public readonly parent: ClaudeSeoLifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';

  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<StoredHook>>();
  private disposables = new Set<Disposable>();
  private children = new Set<ClaudeSeoLifecycleContext>();
  private _isDisposed = false;
  private _isDisposing = false;

  constructor(
    scope: 'global' | 'session' | 'step' = 'global',
    parent: ClaudeSeoLifecycleContext | null = null
  ) {
    if (parent && parent._isDisposed) {
      throw new Error(`[ClaudeSeoLifecycleContext] Cannot extend a disposed parent context '${parent.id}'.`);
    }

    // Defensive loop check in parent hierarchy
    let ancestor = parent;
    let depth = 0;
    const maxDepth = 128;
    while (ancestor) {
      if (depth++ > maxDepth) {
        throw new Error(`[ClaudeSeoLifecycleContext] Context hierarchy depth limit (${maxDepth}) exceeded.`);
      }
      ancestor = ancestor.parent;
    }

    this.id = `${scope}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    this.scope = scope;
    this.parent = parent;

    if (parent) {
      parent.children.add(this);
    }
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public provide<T>(id: string, service: T): void {
    if (this._isDisposed) {
      throw new Error(`[ClaudeSeoLifecycleContext] Cannot provide service '${id}' on a disposed context '${this.id}'.`);
    }
    if (!id || typeof id !== 'string') {
      throw new TypeError(`[ClaudeSeoLifecycleContext] Invalid service id: must be a non-empty string.`);
    }
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this._isDisposed) {
      throw new Error(`[ClaudeSeoLifecycleContext] Cannot inject service '${id}' from a disposed context '${this.id}'.`);
    }
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.inject<T>(id);
    }
    throw new Error(`[ClaudeSeoLifecycleContext] Service '${id}' not registered in context hierarchy.`);
  }

  public tryInject<T>(id: string, fallback?: T): T | undefined {
    if (this._isDisposed) return fallback;
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.tryInject<T>(id, fallback);
    }
    return fallback;
  }

  public has(id: string): boolean {
    if (this._isDisposed) return false;
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(
    event: LifecycleHookName,
    handler: (payload: T, ctx: ClaudeSeoLifecycleContext) => void | Promise<void>,
    options?: HookOptions
  ): Disposable {
    if (this._isDisposed) {
      return { dispose: () => {} };
    }
    if (typeof handler !== 'function') {
      throw new TypeError(`[ClaudeSeoLifecycleContext] Hook handler for '${String(event)}' must be a function.`);
    }

    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    const hookSet = this.hooks.get(event)!;
    const storedHook: StoredHook = {
      handler: handler as LifecycleHookHandler<any>,
      once: Boolean(options?.once),
      priority: typeof options?.priority === 'number' ? options.priority : 0,
    };

    hookSet.add(storedHook);

    let disposed = false;
    const d: Disposable = {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        hookSet.delete(storedHook);
        if (hookSet.size === 0) {
          this.hooks.delete(event);
        }
        this.disposables.delete(d);
      },
    };
    this.disposables.add(d);
    return d;
  }

  public once<T>(
    event: LifecycleHookName,
    handler: (payload: T, ctx: ClaudeSeoLifecycleContext) => void | Promise<void>
  ): Disposable {
    return this.on(event, handler, { once: true });
  }

  public registerDisposable(disposable: Disposable): Disposable {
    if (this._isDisposed) {
      try {
        void disposable.dispose();
      } catch (err) {
        console.warn(`[ClaudeSeoLifecycleContext] Immediate dispose error:`, err);
      }
      return { dispose: () => {} };
    }
    this.disposables.add(disposable);
    return disposable;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    const hookSet = this.hooks.get(event);
    if (hookSet && hookSet.size > 0) {
      // Defensive snapshot sorted by priority descending
      const snapshot = Array.from(hookSet).sort((a, b) => b.priority - a.priority);
      for (const entry of snapshot) {
        if (!hookSet.has(entry)) {
          // Unregistered during prior step execution
          continue;
        }
        if (entry.once) {
          hookSet.delete(entry);
        }
        try {
          await entry.handler(payload, this);
        } catch (err) {
          console.error(`[ClaudeSeoLifecycleContext] Error in hook '${String(event)}':`, err);
        }
      }
      if (hookSet.size === 0) {
        this.hooks.delete(event);
      }
    }

    if (this.parent && !this.parent._isDisposed) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): ClaudeSeoLifecycleContext {
    if (this._isDisposed) {
      throw new Error(`[ClaudeSeoLifecycleContext] Cannot extend disposed context '${this.id}'.`);
    }
    return new ClaudeSeoLifecycleContext(scope, this);
  }

  public getChildren(): ReadonlyArray<ClaudeSeoLifecycleContext> {
    return Array.from(this.children);
  }

  public async dispose(): Promise<void> {
    if (this._isDisposed || this._isDisposing) {
      return;
    }
    this._isDisposing = true;

    // Remove from parent child registry
    if (this.parent) {
      this.parent.children.delete(this);
    }

    // Dispose all extended child contexts first in reverse order
    const childList = Array.from(this.children);
    this.children.clear();
    for (const child of childList.reverse()) {
      try {
        await child.dispose();
      } catch (err) {
        console.warn(`[ClaudeSeoLifecycleContext] Child context dispose error (${child.id}):`, err);
      }
    }

    // Dispose all tracked disposables
    const disposables = Array.from(this.disposables);
    this.disposables.clear();
    for (const d of disposables) {
      try {
        await d.dispose();
      } catch (err) {
        console.warn(`[ClaudeSeoLifecycleContext] Dispose error in '${this.id}':`, err);
      }
    }

    this.hooks.clear();
    this.services.clear();
    this._isDisposed = true;
    this._isDisposing = false;
  }
}

// Canonical aliasing for clean-room interoperability
export { ClaudeSeoLifecycleContext as 'claude-seoLifecycleContext' };
export { ClaudeSeoLifecycleContext as claude_seoLifecycleContext };
export { ClaudeSeoLifecycleContext as ClaudeSeoLifecycleKernel };
export default ClaudeSeoLifecycleContext;