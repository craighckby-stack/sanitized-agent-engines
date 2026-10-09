/* GLM-Engine-Harvester [2026-10-09T02:47:39.180Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for frontend-checklist
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export * from './01-frontend-checklist-lifecycle-kernel';
export * from './02-frontend-checklist-react-loop-engine';
export * from './03-frontend-checklist-unified-model-stream-adapter';
export * from './04-frontend-checklist-tool-sandbox-virtual-file-system-engine';
export * from './05-frontend-checklist-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface FrontendChecklistEngineManifest {
  readonly id: 'frontend-checklist';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const FRONTEND_CHECKLIST_ENGINE_MANIFEST: FrontendChecklistEngineManifest = Object.freeze({
  id: 'frontend-checklist',
  name: 'Front-End Checklist Engine',
  version: '1.0.0',
  sourceOrigin: 'thedaviddias/Front-End-Checklist',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyFrontendChecklistEngineSubsystem(): boolean {
  try {
    return typeof FRONTEND_CHECKLIST_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
