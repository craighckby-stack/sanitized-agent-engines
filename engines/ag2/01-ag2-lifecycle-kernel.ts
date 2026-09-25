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

export class ag2LifecycleContext {
  public readonly id: string;
  public readonly parent: ag2LifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';
  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: ag2LifecycleContext) => void | Promise<void>>>();
  private disposables = new Set<Disposable>();

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: ag2LifecycleContext | null = null) {
    this.id = `${scope}_${Math.random().toString(36).substring(2, 9)}`;
    this.scope = scope;
    this.parent = parent;
  }

  public provide<T>(id: string, service: T): void {
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.parent) {
      return this.parent.inject<T>(id);
    }
    throw new Error(`[ag2LifecycleContext] Service '${id}' not registered in context hierarchy.`);
  }

  public has(id: string): boolean {
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: ag2LifecycleContext) => void | Promise<void>): Disposable {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, new Set());
    }
    const handlers = this.hooks.get(event)!;
    handlers.add(handler as any);

    const d: Disposable = {
      dispose: () => {
        handlers.delete(handler as any);
        this.disposables.delete(d);
      },
    };
    this.disposables.add(d);
    return d;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    const handlers = this.hooks.get(event);
    if (handlers && handlers.size > 0) {
      for (const h of Array.from(handlers)) {
        try {
          await h(payload, this);
        } catch (err) {
          console.error(`[ag2LifecycleContext] Error in hook '${event}':`, err);
        }
      }
    }
    if (this.parent) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): ag2LifecycleContext {
    return new ag2LifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    const disposables = Array.from(this.disposables);
    this.disposables.clear();
    for (const d of disposables) {
      try {
        await d.dispose();
      } catch (err) {
        console.warn(`[ag2LifecycleContext] Dispose error:`, err);
      }
    }
    this.hooks.clear();
    this.services.clear();
  }
}
