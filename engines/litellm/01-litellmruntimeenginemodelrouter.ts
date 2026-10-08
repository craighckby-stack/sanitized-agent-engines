/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * LitellmRuntimeEngineModelRouter
 * Source Origin: BerriAI/litellm
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

export interface ModelDeployment {
  modelName: string;
  provider: 'openai' | 'anthropic' | 'cohere';
  apiKey: string;
  weight: number;
}

export class LitellmRuntimeEngineModelRouter {
  private deployments: ModelDeployment[] = [];

  public registerDeployment(dep: ModelDeployment): void {
    this.deployments.push(dep);
  }

  public selectDeployment(requestedModel: string): ModelDeployment {
    const matches = this.deployments.filter((d) => d.modelName === requestedModel);
    if (matches.length === 0) {
      throw new Error(`No deployment found for model '${requestedModel}'`);
    }
    return matches[Math.floor(Math.random() * matches.length)];
  }

  public async executeWithFallback<T>(
    requestedModel: string,
    operation: (dep: ModelDeployment) => Promise<T>
  ): Promise<T> {
    const matches = this.deployments.filter((d) => d.modelName === requestedModel);
    let lastError: Error | null = null;

    for (const dep of matches) {
      try {
        return await operation(dep);
      } catch (err: any) {
        lastError = err;
        console.warn(`[LitellmRuntimeEngine] Failover from ${dep.provider}:`, err.message);
      }
    }

    throw lastError || new Error('All model fallbacks exhausted.');
  }
}
