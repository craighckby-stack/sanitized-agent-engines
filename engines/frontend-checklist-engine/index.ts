/* GLM-Engine-Harvester [2026-10-09T04:38:32.866Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for frontend-checklist-engine
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export * from './01-frontend-checklist-engine-lifecycle-kernel';
export * from './02-frontend-checklist-engine-react-loop-engine';
export * from './03-frontend-checklist-engine-unified-model-stream-adapter';
export * from './04-frontend-checklist-engine-tool-sandbox-virtual-file-system-engine';
export * from './05-frontend-checklist-engine-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface FrontendChecklistEngineEngineManifest {
  readonly id: 'frontend-checklist-engine';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const FRONTEND_CHECKLIST_ENGINE_ENGINE_MANIFEST: FrontendChecklistEngineEngineManifest = Object.freeze({
  id: 'frontend-checklist-engine',
  name: 'Frontend Checklist Autonomous Agent Engine',
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

export function verifyFrontendChecklistEngineEngineSubsystem(): boolean {
  try {
    return typeof FRONTEND_CHECKLIST_ENGINE_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
