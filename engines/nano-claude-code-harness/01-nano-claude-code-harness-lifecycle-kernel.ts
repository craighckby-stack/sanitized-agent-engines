/* GLM-Engine-Harvester [2026-10-09T03:29:13.889Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 1: Nano Claude Code Harness Engine — Lifecycle Kernel
 * Source Origin: shareAI-lab/learn-claude-code
 */

class NanoClaudeCodeLifecycleContext {
  private disposables: Disposable[] = [];
  private hooks: Map<string, Function[]> = new Map();
  
  constructor(private workdir: string) {}
  
  registerDisposable(disposable: Disposable): void {
    this.disposables.push(disposable);
  }
  
  addHook(event: string, callback: Function): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
  }
  
  async dispatchHook(event: string, ...args: any[]): Promise<any[]> {
    const results: any[] = [];
    if (this.hooks.has(event)) {
      for (const callback of this.hooks.get(event)!) {
        try {
          results.push(await callback(...args));
        } catch (e) {
          console.error(`Hook ${event} failed:`, e);
        }
      }
    }
    return results;
  }
  
  dispose(): void {
    for (const disposable of this.disposables) {
      try {
        if (typeof disposable === 'function') {
          disposable();
        } else if (disposable && typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
      } catch (e) {
        console.error('Error during disposal:', e);
      }
    }
    this.disposables = [];
    this.hooks.clear();
  }
}

type Disposable = () => void | { dispose: () => void };
