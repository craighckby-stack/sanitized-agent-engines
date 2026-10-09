/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * KhojRuntimeEngineStateContext
 * Source Origin: khoj-ai/khoj
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class KhojRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
