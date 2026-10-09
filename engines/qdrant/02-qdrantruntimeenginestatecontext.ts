/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * QdrantRuntimeEngineStateContext
 * Source Origin: qdrant/qdrant
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class QdrantRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
