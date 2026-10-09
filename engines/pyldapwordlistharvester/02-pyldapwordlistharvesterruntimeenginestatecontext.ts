/**
 * @license
 * SPDX-License-Identifier: GPL-2.0
 *
 * PyLDAPWordlistHarvesterRuntimeEngineStateContext
 * Source Origin: p0dalirius/pyLDAPWordlistHarvester
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class PyLDAPWordlistHarvesterRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
