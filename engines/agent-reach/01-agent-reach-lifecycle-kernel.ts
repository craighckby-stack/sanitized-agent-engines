/* GLM-Engine-Harvester [2026-10-09T02:43:52.629Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Agent Reach Autonomous Internet Explorer Engine — Lifecycle Kernel
 * Source Origin: Panniantong/Agent-Reach
 */

class AgentReachLifecycleContext {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private disposables: Set<() => void> = new Set();
  private scopeStack: string[] = [];

  constructor() {
    this.initializeCoreServices();
  }

  private initializeCoreServices() {
    // Register core services
    this.registerService('channelRegistry', new ChannelRegistry());
    this.registerService('backendManager', new BackendManager());
    this.registerService('toolSandbox', new ToolSandbox());
    this.registerService('sessionManager', new SessionManager());
  }

  registerService(name: string, service: any) {
    this.services.set(name, service);
  }

  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  addHook(event: string, callback: Function) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }

  async dispatchHook(event: string, ...args: any[]) {
    const callbacks = this.hooks.get(event) || [];
    for (const callback of callbacks) {
      await callback(...args);
    }
  }

  pushScope(scope: string) {
    this.scopeStack.push(scope);
  }

  popScope() {
    return this.scopeStack.pop();
  }

  addDisposable(dispose: () => void) {
    this.disposables.add(dispose);
  }

  async dispose() {
    for (const dispose of this.disposables) {
      try {
        await dispose();
      } catch (e) {
        console.error(`Disposable failed: ${e}`);
      }
    }
    this.disposables.clear();
    this.services.clear();
    this.hooks.clear();
  }
}
