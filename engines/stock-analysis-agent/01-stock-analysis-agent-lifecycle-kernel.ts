/* GLM-Engine-Harvester [2026-10-09T04:26:15.161Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Stock Analysis Agent Runtime Engine — Lifecycle Kernel
 * Source Origin: ZhuLinsen/daily_stock_analysis
 */

import { Disposable, EventEmitter } from 'events';

/**
 * Core lifecycle kernel for the Stock Analysis Agent
 * Handles dependency injection, hook dispatch, and resource management
 */
export class stockAnalysisAgentLifecycleContext extends Disposable {
  private services: Map<string, any> = new Map();
  private hooks: Map<string, Function[]> = new Map();
  private scopes: Map<string, Set<string>> = new Map();
  
  /**
   * Register a service with the DI container
   */
  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
    this.emit('serviceRegistered', { name, service });
  }
  
  /**
   * Retrieve a service from the DI container
   */
  getService<T>(name: string): T | undefined {
    return this.services.get(name);
  }
  
  /**
   * Register a lifecycle hook
   */
  addHook(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }
  
  /**
   * Execute all hooks for a given event
   */
  async executeHooks(event: string, ...args: any[]): Promise<any[]> {
    const callbacks = this.hooks.get(event) || [];
    return Promise.all(callbacks.map(cb => cb(...args)));
  }
  
  /**
   * Create a new execution scope
   */
  createScope(name: string): void {
    this.scopes.set(name, new Set());
  }
  
  /**
   * Add a service to a scope
   */
  addToScope(scopeName: string, serviceName: string): void {
    const scope = this.scopes.get(scopeName);
    if (scope) {
      scope.add(serviceName);
    }
  }
  
  /**
   * Dispose of a scope and its services
   */
  disposeScope(scopeName: string): void {
    const scope = this.scopes.get(scopeName);
    if (scope) {
      for (const serviceName of scope) {
        this.services.delete(serviceName);
      }
      this.scopes.delete(scopeName);
    }
  }
  
  /**
   * Clean up all resources
   */
  protected dispose(): void {
    this.services.clear();
    this.hooks.clear();
    this.scopes.clear();
  }
}
