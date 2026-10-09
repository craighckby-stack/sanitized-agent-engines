/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Cherry Studio Autonomous Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: CherryHQ/cherry-studio
 */

export class cherryStudioLifecycleContext {
  private services: Map<string, any> = new Map();
  private disposables: Array<() => Promise<void> | void> = [];
  private scopes: Map<string, Set<string>> = new Map();

  /** Register a service instance */
  register<T>(name: string, service: T, scope?: string): void {
    this.services.set(name, service);
    if (scope) {
      if (!this.scopes.has(scope)) this.scopes.set(scope, new Set());
      this.scopes.get(scope)!.add(name);
    }
  }

  /** Retrieve a service instance */
  get<T>(name: string): T | undefined {
    return this.services.get(name) as T;
  }

  /** Register a cleanup function */
  onDispose(dispose: () => Promise<void> | void): void {
    this.disposables.push(dispose);
  }

  /** Dispose all services in reverse order */
  async dispose(): Promise<void> {
    for (const dispose of this.disposables.reverse()) {
      try {
        await dispose();
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.disposables = [];
    this.services.clear();
    this.scopes.clear();
  }

  /** Dispose all services in a specific scope */
  async disposeScope(scope: string): Promise<void> {
    const services = this.scopes.get(scope);
    if (!services) return;

    for (const serviceName of services) {
      const service = this.services.get(serviceName);
      if (service && typeof service.dispose === 'function') {
        try {
          await service.dispose();
        } catch (e) {
          console.error(`Error disposing service ${serviceName}:`, e);
        }
        this.services.delete(serviceName);
      }
    }
    this.scopes.delete(scope);
  }
}
