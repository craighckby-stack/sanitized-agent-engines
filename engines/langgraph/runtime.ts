/**
 * @license
 * SPDX-License-Identifier: MIT
 * Unified Clean-Room Runtime for langgraph
 * Source Origin: langchain-ai/langgraph
 */

// ==========================================
// LanggraphRuntimeEngineNodeRegistry
// ==========================================
export type NodeHandler<TState> = (state: TState) => Promise<Partial<TState>>;
export type EdgeCondition<TState> = (state: TState) => string;

export class LanggraphRuntimeEngineNodeRegistry<TState extends Record<string, any>> {
  private nodes = new Map<string, NodeHandler<TState>>();
  private conditionalEdges = new Map<string, EdgeCondition<TState>>();

  public addNode(name: string, handler: NodeHandler<TState>): void {
    this.nodes.set(name, handler);
  }

  public addConditionalEdge(sourceNode: string, condition: EdgeCondition<TState>): void {
    this.conditionalEdges.set(sourceNode, condition);
  }

  public getNode(name: string): NodeHandler<TState> {
    const h = this.nodes.get(name);
    if (!h) throw new Error(`Node '${name}' not registered in StateGraph`);
    return h;
  }

  public getNextNode(currentNode: string, state: TState): string | null {
    const cond = this.conditionalEdges.get(currentNode);
    return cond ? cond(state) : null;
  }
}

// ==========================================
// LanggraphRuntimeEnginePregelExecutor
// ==========================================
export class LanggraphRuntimeEnginePregelExecutor<TState extends Record<string, any>> {
  constructor(private registry: LanggraphRuntimeEngineNodeRegistry<TState>) {}

  public async executeGraph(
    startNode: string,
    initialState: TState,
    maxSupersteps = 10
  ): Promise<{ finalState: TState; supersteps: number }> {
    let currentState = { ...initialState };
    let currentNode: string | null = startNode;
    let steps = 0;

    while (currentNode && steps < maxSupersteps) {
      steps++;
      const handler = this.registry.getNode(currentNode);
      const stateDelta = await handler(currentState);
      currentState = { ...currentState, ...stateDelta };

      currentNode = this.registry.getNextNode(currentNode, currentState);
    }

    return { finalState: currentState, supersteps: steps };
  }
}
