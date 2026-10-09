/**
 * @license
 * SPDX-License-Identifier: GPL-3.0
 *
 * PhishingPostRuntimeEngineStateContext
 * Source Origin: mgeeky/PhishingPost
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export class PhishingPostRuntimeEngineStateContext {
  private stateMap = new Map<string, unknown>();

  public setState(key: string, value: unknown): void {
    this.stateMap.set(key, value);
  }

  public getState<T>(key: string): T | undefined {
    return this.stateMap.get(key) as T;
  }
}
