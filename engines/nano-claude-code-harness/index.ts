/* GLM-Engine-Harvester [2026-10-09T03:29:13.889Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for nano-claude-code-harness
 * Source Origin: shareAI-lab/learn-claude-code
 */

export * from './01-nano-claude-code-harness-lifecycle-kernel';
export * from './02-nano-claude-code-harness-react-loop-engine';
export * from './03-nano-claude-code-harness-unified-model-stream-adapter';
export * from './04-nano-claude-code-harness-tool-sandbox-virtual-file-system-engine';
export * from './05-nano-claude-code-harness-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface NanoClaudeCodeHarnessEngineManifest {
  readonly id: 'nano-claude-code-harness';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const NANO_CLAUDE_CODE_HARNESS_ENGINE_MANIFEST: NanoClaudeCodeHarnessEngineManifest = Object.freeze({
  id: 'nano-claude-code-harness',
  name: 'Nano Claude Code Harness Engine',
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

export function verifyNanoClaudeCodeHarnessEngineSubsystem(): boolean {
  try {
    return typeof NANO_CLAUDE_CODE_HARNESS_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
