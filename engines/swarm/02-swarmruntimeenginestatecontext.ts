/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * SwarmRuntimeEngineStateContext
 * Source Origin: openai/swarm
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class SwarmRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
