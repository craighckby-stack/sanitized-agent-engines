/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contextual State Registry Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

interface SessionContext {
  history: Array<{ role: string; content: string }>;
  timestamp: number;
}

export class ContextualStateRegistryEngine {
  private registry: Map<string, SessionContext> = new Map();

  public updateContext(sessionId: string, role: string, content: string): void {
    const session = this.registry.get(sessionId) || { history: [], timestamp: Date.now() };
    
    session.history.push({ role, content });
    session.timestamp = Date.now();
    
    this.registry.set(sessionId, session);
  }

  public getContext(sessionId: string): Array<{ role: string; content: string }> {
    return this.registry.get(sessionId)?.history || [];
  }

  public clearSession(sessionId: string): void {
    this.registry.delete(sessionId);
  }
}
