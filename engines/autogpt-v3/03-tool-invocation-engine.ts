/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tool Invocation Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

type ToolFunction = (args: any) => Promise<any>;

class ToolInvocationEngine {
  private registry: Map<string, ToolFunction> = new Map();

  public registerTool(name: string, fn: ToolFunction): void {
    this.registry.set(name, fn);
  }

  public async invoke(name: string, args: any): Promise<any> {
    const tool = this.registry.get(name);
    
    if (!tool) {
      throw new Error(`Tool ${name} is not registered.`);
    }

    try {
      return await tool(args);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
