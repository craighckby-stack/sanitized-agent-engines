/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HarvesterInstallerRuntimeEngineStateContext
 * Source Origin: harvester/harvester-installer
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class HarvesterInstallerRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
