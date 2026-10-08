/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * CohereToolkitRuntimeEngineStateContext
 * Source Origin: cohere-ai/cohere-toolkit
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class CohereToolkitRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
