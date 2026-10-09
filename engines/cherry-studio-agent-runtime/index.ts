/* GLM-Engine-Harvester [2026-10-09T12:10:14.123Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for cherry-studio-agent-runtime
 * Source Origin: CherryHQ/cherry-studio
 */

export * from './01-cherry-studio-agent-runtime-lifecycle-kernel';
export * from './02-cherry-studio-agent-runtime-react-loop-engine';
export * from './03-cherry-studio-agent-runtime-unified-model-stream-adapter';
export * from './04-cherry-studio-agent-runtime-tool-sandbox-virtual-file-system-engine';
export * from './05-cherry-studio-agent-runtime-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface CherryStudioAgentRuntimeEngineManifest {
  readonly id: 'cherry-studio-agent-runtime';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const CHERRY_STUDIO_AGENT_RUNTIME_ENGINE_MANIFEST: CherryStudioAgentRuntimeEngineManifest = Object.freeze({
  id: 'cherry-studio-agent-runtime',
  name: 'Cherry Studio Autonomous Agent Runtime Engine',
  version: '1.0.0',
  sourceOrigin: 'CherryHQ/cherry-studio',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyCherryStudioAgentRuntimeEngineSubsystem(): boolean {
  try {
    return typeof CHERRY_STUDIO_AGENT_RUNTIME_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
