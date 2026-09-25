/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * embedchain Lifecycle Kernel
 * Source Origin: embedchain/embedchain
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

export class embedchainLifecycleContext {
  public readonly id: string;
  public readonly parent: embedchainLifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';
  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: embedchainLifecycleContext) => void | Promise<void>>>();
  private disposables = new Set<Disposable>();

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: embedchainLifecycleContext | null = null) {
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
    throw new Error(`[embedchainLifecycleContext] Service '${id}' not registered in context hierarchy.`);
  }

  public has(id: string): boolean {
    if (this.services.has(id)) return true;
    return this.parent ? this.parent.has(id) : false;
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: embedchainLifecycleContext) => void | Promise<void>): Disposable {
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
          console.error(`[embedchainLifecycleContext] Error in hook '${event}':`, err);
        }
      }
    }
    if (this.parent) {
      await this.parent.emit(event, payload);
    }
  }

  public extend(scope: 'session' | 'step'): embedchainLifecycleContext {
    return new embedchainLifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    const disposables = Array.from(this.disposables);
    this.disposables.clear();
    for (const d of disposables) {
      try {
        await d.dispose();
      } catch (err) {
        console.warn(`[embedchainLifecycleContext] Dispose error:`, err);
      }
    }
    this.hooks.clear();
    this.services.clear();
  }
}
