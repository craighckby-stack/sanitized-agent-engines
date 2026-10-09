/* GLM-Engine-Harvester [2026-10-09T04:30:53.096Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for ai-agent-book
 * Source Origin: bojieli/ai-agent-book
 */

export * from './01-ai-agent-book-lifecycle-kernel';
export * from './02-ai-agent-book-react-loop-engine';
export * from './03-ai-agent-book-unified-model-stream-adapter';
export * from './04-ai-agent-book-tool-sandbox-virtual-file-system-engine';
export * from './05-ai-agent-book-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface AiAgentBookEngineManifest {
  readonly id: 'ai-agent-book';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const AI_AGENT_BOOK_ENGINE_MANIFEST: AiAgentBookEngineManifest = Object.freeze({
  id: 'ai-agent-book',
  name: 'AI Agent Book Companion Engine',
  version: '1.0.0',
  sourceOrigin: 'bojieli/ai-agent-book',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyAiAgentBookEngineSubsystem(): boolean {
  try {
    return typeof AI_AGENT_BOOK_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
