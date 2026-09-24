/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ActionExecutionEngine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

export type Action = {
  type: 'run' | 'read' | 'write';
  payload: Record<string, any>;
};

export type Observation = {
  status: 'success' | 'error';
  content: string;
};

export class ActionExecutionEngine {
  constructor(private runtime: ContainerRuntimeManager) {}

  public async dispatch(action: Action): Promise<Observation> {
    try {
      switch (action.type) {
        case 'run':
          const output = await this.runtime.executeCommand(action.payload.command);
          return { status: 'success', content: output };
        
        case 'read':
          const content = await this.runtime.executeCommand(`cat ${action.payload.path}`);
          return { status: 'success', content };

        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
    } catch (error: any) {
      return { status: 'error', content: error.message };
    }
  }
}
