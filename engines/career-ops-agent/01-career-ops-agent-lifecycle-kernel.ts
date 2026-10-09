/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Career Ops Autonomous Agent Engine — Lifecycle Kernel
 * Source Origin: career-ops-hq/career-ops
 */

import { Disposable } from './types';

class CareerOpsLifecycleContext implements Disposable {
  private disposables: Disposable[] = [];
  private scopes: Map<string, any> = new Map();
  
  /** Register a disposable to be cleaned up on context disposal */
  register<T extends Disposable>(disposable: T): T {
    this.disposables.push(disposable);
    return disposable;
  }
  
  /** Store and retrieve scoped data */
  setScope<T>(key: string, value: T): void {
    this.scopes.set(key, value);
  }
  
  getScope<T>(key: string): T | undefined {
    return this.scopes.get(key);
  }
  
  /** Execute a callback with proper lifecycle management */
  async runWithScope<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.getScope<T>(key);
    if (existing) return existing;
    
    const value = await factory();
    this.setScope(key, value);
    return value;
  }
  
  /** Clean up all registered disposables */
  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        disposable.dispose();
      } catch (error) {
        console.error('Error during disposal:', error);
      }
    }
    this.disposables = [];
    this.scopes.clear();
  }
}
