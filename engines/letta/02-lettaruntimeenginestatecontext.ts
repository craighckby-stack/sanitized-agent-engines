/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LettaRuntimeEngineStateContext
 * Source Origin: letta-ai/letta
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class LettaRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
