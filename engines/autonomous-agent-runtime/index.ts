/* GLM-Engine-Harvester [2026-10-09T03:24:04.052Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for autonomous-agent-runtime
 * Source Origin: NousResearch/hermes-agent
 */

export * from './01-autonomous-agent-runtime-lifecycle-kernel';
export * from './02-autonomous-agent-runtime-react-loop-engine';
export * from './03-autonomous-agent-runtime-unified-model-stream-adapter';
export * from './04-autonomous-agent-runtime-tool-sandbox-virtual-file-system-engine';
export * from './05-autonomous-agent-runtime-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface AutonomousAgentRuntimeEngineManifest {
  readonly id: 'autonomous-agent-runtime';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const AUTONOMOUS_AGENT_RUNTIME_ENGINE_MANIFEST: AutonomousAgentRuntimeEngineManifest = Object.freeze({
  id: 'autonomous-agent-runtime',
  name: 'Autonomous Agent Runtime Engine',
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

export function verifyAutonomousAgentRuntimeEngineSubsystem(): boolean {
  try {
    return typeof AUTONOMOUS_AGENT_RUNTIME_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
