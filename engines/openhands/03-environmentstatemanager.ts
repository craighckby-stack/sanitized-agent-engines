/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * EnvironmentStateManager
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

export class EnvironmentStateManager {
  private envVars: Map<string, string> = new Map();

  public setVariable(key: string, value: string): void {
    this.envVars.set(key, value);
  }

  public getExportString(): string {
    return Array.from(this.envVars.entries())
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n');
  }

  public async syncState(runtime: ContainerRuntimeManager): Promise<void> {
    const script = this.getExportString();
    await runtime.executeCommand(`echo '${script}' >> /etc/environment`);
  }
}
