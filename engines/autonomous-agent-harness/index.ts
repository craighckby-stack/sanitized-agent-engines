/* GLM-Engine-Harvester [2026-10-09T13:14:48.291Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for autonomous-agent-harness
 * Source Origin: zhayujie/CowAgent
 */

export * from './01-autonomous-agent-harness-lifecycle-kernel';
export * from './02-autonomous-agent-harness-react-loop-engine';
export * from './03-autonomous-agent-harness-unified-model-stream-adapter';
export * from './04-autonomous-agent-harness-tool-sandbox-virtual-file-system-engine';
export * from './05-autonomous-agent-harness-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface AutonomousAgentHarnessEngineManifest {
  readonly id: 'autonomous-agent-harness';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const AUTONOMOUS_AGENT_HARNESS_ENGINE_MANIFEST: AutonomousAgentHarnessEngineManifest = Object.freeze({
  id: 'autonomous-agent-harness',
  name: 'Autonomous Agent Harness Engine',
  version: '1.0.0',
  sourceOrigin: 'zhayujie/CowAgent',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyAutonomousAgentHarnessEngineSubsystem(): boolean {
  try {
    return typeof AUTONOMOUS_AGENT_HARNESS_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
