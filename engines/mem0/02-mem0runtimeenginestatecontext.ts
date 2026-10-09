/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mem0RuntimeEngineStateContext
 * Source Origin: mem0ai/mem0
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class Mem0RuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
