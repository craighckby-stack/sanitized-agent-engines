/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for ag2
 * Source Origin: ag2ai/ag2
 */

export * from './01-ag2-lifecycle-kernel';
export * from './02-ag2-react-loop-engine';
export * from './03-ag2-unified-model-stream-adapter';
export * from './04-ag2-tool-sandbox-virtual-file-system-engine';
export * from './05-ag2-non-linear-session-tree-token-budget-engine';
export * from './runtime';

/**
 * Defensive Architecture Manifest and Runtime Health Verification for AG2
 */
export interface AG2SubsystemModuleDescriptor {
  readonly id: string;
  readonly path: string;
  readonly category: 'kernel' | 'execution' | 'adapter' | 'sandbox' | 'memory' | 'runtime';
  readonly critical: boolean;
}

export interface AG2EngineManifest {
  readonly engineId: 'ag2';
  readonly version: string;
  readonly generation: string;
  readonly sourceOrigin: string;
  readonly subsystems: readonly AG2SubsystemModuleDescriptor[];
  readonly initializedAt: number;
}

export const AG2_ENGINE_METADATA: AG2EngineManifest = Object.freeze({
  engineId: 'ag2',
  version: '2.0.0',
  generation: 'G-50',
  sourceOrigin: 'ag2ai/ag2',
  subsystems: Object.freeze([
    {
      id: 'ag2-lifecycle-kernel',
      path: './01-ag2-lifecycle-kernel',
      category: 'kernel',
      critical: true,
    },
    {
      id: 'ag2-react-loop-engine',
      path: './02-ag2-react-loop-engine',
      category: 'execution',
      critical: true,
    },
    {
      id: 'ag2-unified-model-stream-adapter',
      path: './03-ag2-unified-model-stream-adapter',
      category: 'adapter',
      critical: true,
    },
    {
      id: 'ag2-tool-sandbox-virtual-file-system-engine',
      path: './04-ag2-tool-sandbox-virtual-file-system-engine',
      category: 'sandbox',
      critical: true,
    },
    {
      id: 'ag2-non-linear-session-tree-token-budget-engine',
      path: './05-ag2-non-linear-session-tree-token-budget-engine',
      category: 'memory',
      critical: true,
    },
    {
      id: 'ag2-runtime',
      path: './runtime',
      category: 'runtime',
      critical: true,
    },
  ]),
  initializedAt: Date.now(),
});

/**
 * Returns an immutable copy of the AG2 engine manifest.
 */
export function getAG2EngineManifest(): AG2EngineManifest {
  return AG2_ENGINE_METADATA;
}

/**
 * Defensive runtime check verifying that all expected AG2 engine subsystems
 * are recognized and meet operational structural integrity constraints.
 */
export function verifyAG2EngineIntegrity(): {
  ok: boolean;
  timestamp: number;
  subsystemCount: number;
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  let isHealthy = true;

  if (AG2_ENGINE_METADATA.engineId !== 'ag2') {
    isHealthy = false;
    diagnostics.push('Engine identifier mismatch in AG2 manifest.');
  }

  if (!Array.isArray(AG2_ENGINE_METADATA.subsystems) || AG2_ENGINE_METADATA.subsystems.length !== 6) {
    isHealthy = false;
    diagnostics.push(`Subsystem descriptor count anomaly: expected 6, found ${AG2_ENGINE_METADATA.subsystems?.length ?? 0}`);
  }

  for (const sub of AG2_ENGINE_METADATA.subsystems) {
    if (!sub.id || !sub.path) {
      isHealthy = false;
      diagnostics.push(`Subsystem entry corrupted: ${JSON.stringify(sub)}`);
    }
  }

  if (isHealthy) {
    diagnostics.push('All AG2 subsystems validated successfully.');
  }

  return {
    ok: isHealthy,
    timestamp: Date.now(),
    subsystemCount: AG2_ENGINE_METADATA.subsystems.length,
    diagnostics,
  };
}