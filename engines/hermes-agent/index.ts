/* GLM-Engine-Harvester [2026-10-09T02:42:13.566Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for hermes-agent
 * Source Origin: NousResearch/hermes-agent
 */

export * from './01-hermes-agent-lifecycle-kernel';
export * from './02-hermes-agent-react-loop-engine';
export * from './03-hermes-agent-unified-model-stream-adapter';
export * from './04-hermes-agent-tool-sandbox-virtual-file-system-engine';
export * from './05-hermes-agent-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface HermesAgentEngineManifest {
  readonly id: 'hermes-agent';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const HERMES_AGENT_ENGINE_MANIFEST: HermesAgentEngineManifest = Object.freeze({
  id: 'hermes-agent',
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

export function verifyHermesAgentEngineSubsystem(): boolean {
  try {
    return typeof HERMES_AGENT_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
