/**
 * @license
 * SPDX-License-Identifier: GPL-2.0
 *
 * TheHarvesterRuntimeEngineStateContext
 * Source Origin: laramies/theHarvester
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class TheHarvesterRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
