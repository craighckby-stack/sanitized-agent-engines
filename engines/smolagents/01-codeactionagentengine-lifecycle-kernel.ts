/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CodeActionAgentEngine Lifecycle Kernel
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

export interface Disposable {
  dispose(): void | Promise<void>;
}

export type LifecycleHookName =
  | 'session:create'
  | 'step:before'
  | 'step:after'
  | 'model:stream:chunk'
  | 'tool:invoke:before'
  | 'tool:invoke:after';

export class CodeActionAgentEngineLifecycleContext {
  public readonly id: string;
  public readonly parent: CodeActionAgentEngineLifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';
  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: any) => void>>();
  private disposables = new Set<Disposable>();

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: CodeActionAgentEngineLifecycleContext | null = null) {
    this.id = `${scope}_${Math.random().toString(36).substring(2, 9)}`;
    this.scope = scope;
    this.parent = parent;
  }

  public provide<T>(id: string, service: T): void {
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this.services.has(id)) return this.services.get(id) as T;
    if (this.parent) return this.parent.inject<T>(id);
    throw new Error(`Service '${id}' not found in context hierarchy`);
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: CodeActionAgentEngineLifecycleContext) => void): Disposable {
    if (!this.hooks.has(event)) this.hooks.set(event, new Set());
    const set = this.hooks.get(event)!;
    set.add(handler);
    const d: Disposable = { dispose: () => set.delete(handler) };
    this.disposables.add(d);
    return d;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    const handlers = this.hooks.get(event);
    if (handlers) {
      await Promise.allSettled(Array.from(handlers).map((h) => h(payload, this)));
    }
    if (this.parent) await this.parent.emit(event, payload);
  }

  public extend(scope: 'session' | 'step') {
    return new CodeActionAgentEngineLifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    for (const d of this.disposables) await d.dispose();
    this.disposables.clear();
    this.hooks.clear();
    this.services.clear();
  }
}
