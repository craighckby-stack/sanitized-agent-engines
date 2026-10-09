/* GLM-Engine-Harvester [2026-10-09T02:49:39.955Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for career-ops-agent
 * Source Origin: career-ops-hq/career-ops
 */

export * from './01-career-ops-agent-lifecycle-kernel';
export * from './02-career-ops-agent-react-loop-engine';
export * from './03-career-ops-agent-unified-model-stream-adapter';
export * from './04-career-ops-agent-tool-sandbox-virtual-file-system-engine';
export * from './05-career-ops-agent-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface CareerOpsAgentEngineManifest {
  readonly id: 'career-ops-agent';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const CAREER_OPS_AGENT_ENGINE_MANIFEST: CareerOpsAgentEngineManifest = Object.freeze({
  id: 'career-ops-agent',
  name: 'Career Ops Autonomous Agent Engine',
  version: '1.0.0',
  sourceOrigin: 'career-ops-hq/career-ops',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyCareerOpsAgentEngineSubsystem(): boolean {
  try {
    return typeof CAREER_OPS_AGENT_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
