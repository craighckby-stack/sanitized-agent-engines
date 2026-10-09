/* GLM-Engine-Harvester [2026-10-09T02:53:23.004Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for ppt-generation-engine
 * Source Origin: hugohe3/ppt-master
 */

export * from './01-ppt-generation-engine-lifecycle-kernel';
export * from './02-ppt-generation-engine-react-loop-engine';
export * from './03-ppt-generation-engine-unified-model-stream-adapter';
export * from './04-ppt-generation-engine-tool-sandbox-virtual-file-system-engine';
export * from './05-ppt-generation-engine-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface PptGenerationEngineEngineManifest {
  readonly id: 'ppt-generation-engine';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const PPT_GENERATION_ENGINE_ENGINE_MANIFEST: PptGenerationEngineEngineManifest = Object.freeze({
  id: 'ppt-generation-engine',
  name: 'PPT Generation Engine',
  version: '1.0.0',
  sourceOrigin: 'hugohe3/ppt-master',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyPptGenerationEngineEngineSubsystem(): boolean {
  try {
    return typeof PPT_GENERATION_ENGINE_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
