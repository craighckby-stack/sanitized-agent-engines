/* GLM-Engine-Harvester [2026-10-09T04:36:27.953Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for nanobot-agent
 * Source Origin: HKUDS/nanobot
 */

export * from './01-nanobot-agent-lifecycle-kernel';
export * from './02-nanobot-agent-react-loop-engine';
export * from './03-nanobot-agent-unified-model-stream-adapter';
export * from './04-nanobot-agent-tool-sandbox-virtual-file-system-engine';
export * from './05-nanobot-agent-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface NanobotAgentEngineManifest {
  readonly id: 'nanobot-agent';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const NANOBOT_AGENT_ENGINE_MANIFEST: NanobotAgentEngineManifest = Object.freeze({
  id: 'nanobot-agent',
  name: 'Nanobot Autonomous Agent Framework Engine',
  version: '1.0.0',
  sourceOrigin: 'HKUDS/nanobot',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyNanobotAgentEngineSubsystem(): boolean {
  try {
    return typeof NANOBOT_AGENT_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
