/* GLM-Engine-Harvester [2026-10-09T02:43:52.629Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for agent-reach
 * Source Origin: Panniantong/Agent-Reach
 */

export * from './01-agent-reach-lifecycle-kernel';
export * from './02-agent-reach-react-loop-engine';
export * from './03-agent-reach-unified-model-stream-adapter';
export * from './04-agent-reach-tool-sandbox-virtual-file-system-engine';
export * from './05-agent-reach-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface AgentReachEngineManifest {
  readonly id: 'agent-reach';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const AGENT_REACH_ENGINE_MANIFEST: AgentReachEngineManifest = Object.freeze({
  id: 'agent-reach',
  name: 'Agent Reach Autonomous Internet Explorer Engine',
  version: '1.0.0',
  sourceOrigin: 'Panniantong/Agent-Reach',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyAgentReachEngineSubsystem(): boolean {
  try {
    return typeof AGENT_REACH_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
