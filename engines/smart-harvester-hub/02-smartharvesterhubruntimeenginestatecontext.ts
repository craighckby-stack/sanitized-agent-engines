/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * SmartHarvesterHubRuntimeEngineStateContext
 * Source Origin: MOHAMADRIYAS28/smart-harvester-hub
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class SmartHarvesterHubRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
