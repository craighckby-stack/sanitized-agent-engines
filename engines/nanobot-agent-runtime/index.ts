/* GLM-Engine-Harvester [2026-10-09T12:12:03.466Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for nanobot-agent-runtime
 * Source Origin: HKUDS/nanobot
 */

export * from './01-nanobot-agent-runtime-lifecycle-kernel';
export * from './02-nanobot-agent-runtime-react-loop-engine';
export * from './03-nanobot-agent-runtime-unified-model-stream-adapter';
export * from './04-nanobot-agent-runtime-tool-sandbox-virtual-file-system-engine';
export * from './05-nanobot-agent-runtime-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface NanobotAgentRuntimeEngineManifest {
  readonly id: 'nanobot-agent-runtime';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const NANOBOT_AGENT_RUNTIME_ENGINE_MANIFEST: NanobotAgentRuntimeEngineManifest = Object.freeze({
  id: 'nanobot-agent-runtime',
  name: 'Nanobot Autonomous Agent Runtime Engine',
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

export function verifyNanobotAgentRuntimeEngineSubsystem(): boolean {
  try {
    return typeof NANOBOT_AGENT_RUNTIME_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
