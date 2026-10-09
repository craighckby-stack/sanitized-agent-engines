/* GLM-Engine-Harvester [2026-10-09T04:26:15.161Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine Package Exports for stock-analysis-agent
 * Source Origin: ZhuLinsen/daily_stock_analysis
 */

export * from './01-stock-analysis-agent-lifecycle-kernel';
export * from './02-stock-analysis-agent-react-loop-engine';
export * from './03-stock-analysis-agent-unified-model-stream-adapter';
export * from './04-stock-analysis-agent-tool-sandbox-virtual-file-system-engine';
export * from './05-stock-analysis-agent-non-linear-session-tree-token-budget-engine';
export * from './runtime';

export interface StockAnalysisAgentEngineManifest {
  readonly id: 'stock-analysis-agent';
  readonly name: string;
  readonly version: string;
  readonly sourceOrigin: string;
  readonly supportedEngines: readonly string[];
}

export const STOCK_ANALYSIS_AGENT_ENGINE_MANIFEST: StockAnalysisAgentEngineManifest = Object.freeze({
  id: 'stock-analysis-agent',
  name: 'Stock Analysis Agent Runtime Engine',
  version: '1.0.0',
  sourceOrigin: 'ZhuLinsen/daily_stock_analysis',
  supportedEngines: Object.freeze([
    'LifecycleKernel',
    'AgentLoopEngine',
    'ModelStreamAdapter',
    'ToolSandboxEngine',
    'SessionTreeEngine',
  ]),
});

export function verifyStockAnalysisAgentEngineSubsystem(): boolean {
  try {
    return typeof STOCK_ANALYSIS_AGENT_ENGINE_MANIFEST === 'object';
  } catch {
    return false;
  }
}
