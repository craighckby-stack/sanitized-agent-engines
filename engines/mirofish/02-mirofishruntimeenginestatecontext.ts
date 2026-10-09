/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0
 *
 * MiroFishRuntimeEngineStateContext
 * Source Origin: 666ghj/MiroFish
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class MiroFishRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
