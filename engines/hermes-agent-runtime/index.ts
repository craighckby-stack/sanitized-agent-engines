/* GLM-Engine-Harvester [2026-10-09T02:52:52.183Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for hermes-agent-runtime
 * Source Origin: NousResearch/hermes-agent
 */

export * from './01-hermes-agent-runtime-lifecycle-kernel';
export * from './02-hermes-agent-runtime-react-loop-engine';
export * from './03-hermes-agent-runtime-unified-model-stream-adapter';
export * from './04-hermes-agent-runtime-tool-sandbox-virtual-file-system-engine';
export * from './05-hermes-agent-runtime-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface HermesAgentRuntimeEngineManifest {
  readonly id: 'hermes-agent-runtime';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const HERMES_AGENT_RUNTIME_ENGINE_MANIFEST: HermesAgentRuntimeEngineManifest = Object.freeze({
  id: 'hermes-agent-runtime',
  name: 'Hermes Autonomous Agent Runtime Engine',
  version: '1.0.0',
  sourceOrigin: 'NousResearch/hermes-agent',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyHermesAgentRuntimeEngineSubsystem(): boolean {
  try {
    return typeof HERMES_AGENT_RUNTIME_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
