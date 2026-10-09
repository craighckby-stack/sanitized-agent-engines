/* GLM-Engine-Harvester [2026-10-09T02:46:07.958Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for nano-agent-harness
 * Source Origin: shareAI-lab/learn-claude-code
 */

export * from './01-nano-agent-harness-lifecycle-kernel';
export * from './02-nano-agent-harness-react-loop-engine';
export * from './03-nano-agent-harness-unified-model-stream-adapter';
export * from './04-nano-agent-harness-tool-sandbox-virtual-file-system-engine';
export * from './05-nano-agent-harness-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface NanoAgentHarnessEngineManifest {
  readonly id: 'nano-agent-harness';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const NANO_AGENT_HARNESS_ENGINE_MANIFEST: NanoAgentHarnessEngineManifest = Object.freeze({
  id: 'nano-agent-harness',
  name: 'Nano Agent Harness Engine',
  version: '1.0.0',
  sourceOrigin: 'shareAI-lab/learn-claude-code',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyNanoAgentHarnessEngineSubsystem(): boolean {
  try {
    return typeof NANO_AGENT_HARNESS_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
