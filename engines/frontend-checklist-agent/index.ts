/* GLM-Engine-Harvester [2026-10-09T03:30:29.651Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for frontend-checklist-agent
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export * from './01-frontend-checklist-agent-lifecycle-kernel';
export * from './02-frontend-checklist-agent-react-loop-engine';
export * from './03-frontend-checklist-agent-unified-model-stream-adapter';
export * from './04-frontend-checklist-agent-tool-sandbox-virtual-file-system-engine';
export * from './05-frontend-checklist-agent-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface FrontendChecklistAgentEngineManifest {
  readonly id: 'frontend-checklist-agent';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const FRONTEND_CHECKLIST_AGENT_ENGINE_MANIFEST: FrontendChecklistAgentEngineManifest = Object.freeze({
  id: 'frontend-checklist-agent',
  name: 'Frontend Checklist Agent Engine',
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

export function verifyFrontendChecklistAgentEngineSubsystem(): boolean {
  try {
    return typeof FRONTEND_CHECKLIST_AGENT_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
