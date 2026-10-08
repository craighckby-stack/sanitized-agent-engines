/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * E2BRuntimeEngineStateContext
 * Source Origin: e2b-dev/E2B
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class E2BRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
