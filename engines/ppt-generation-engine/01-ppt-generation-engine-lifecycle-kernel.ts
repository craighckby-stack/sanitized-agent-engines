/* GLM-Engine-Harvester [2026-10-09T02:53:23.004Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: PPT Generation Engine — Lifecycle Kernel
 * Source Origin: hugohe3/ppt-master
 */

export class PptGenerationLifecycleContext {
  private services: Map<string, any> = new Map();
  private disposables: (() => void)[] = [];
  
  constructor(private config: any) {}
  
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }
  
  getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service;
  }
  
  addDisposable(dispose: () => void): void {
    this.disposables.push(dispose);
  }
  
  dispose(): void {
    for (const dispose of this.disposables) {
      try {
        dispose();
      } catch (e) {
        console.error(`Error during disposal: ${e}`);
      }
    }
    this.disposables = [];
    this.services.clear();
  }
}
