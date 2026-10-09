/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Autok3sRuntimeEngineStateContext
 * Source Origin: cnrancher/autok3s
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class Autok3sRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
