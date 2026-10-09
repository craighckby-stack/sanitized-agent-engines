/* GLM-Engine-Harvester [2026-10-09T12:16:31.935Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for siyuan-knowledge-workspace
 * Source Origin: siyuan-note/siyuan
 */

export * from './01-siyuan-knowledge-workspace-lifecycle-kernel';
export * from './02-siyuan-knowledge-workspace-react-loop-engine';
export * from './03-siyuan-knowledge-workspace-unified-model-stream-adapter';
export * from './04-siyuan-knowledge-workspace-tool-sandbox-virtual-file-system-engine';
export * from './05-siyuan-knowledge-workspace-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface SiyuanKnowledgeWorkspaceEngineManifest {
  readonly id: 'siyuan-knowledge-workspace';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const SIYUAN_KNOWLEDGE_WORKSPACE_ENGINE_MANIFEST: SiyuanKnowledgeWorkspaceEngineManifest = Object.freeze({
  id: 'siyuan-knowledge-workspace',
  name: 'Siyuan Knowledge Workspace Engine',
  version: '1.0.0',
  sourceOrigin: 'siyuan-note/siyuan',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifySiyuanKnowledgeWorkspaceEngineSubsystem(): boolean {
  try {
    return typeof SIYUAN_KNOWLEDGE_WORKSPACE_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
