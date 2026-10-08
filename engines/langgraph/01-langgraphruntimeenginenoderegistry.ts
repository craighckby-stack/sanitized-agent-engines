/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * LanggraphRuntimeEngineNodeRegistry
 * Source Origin: langchain-ai/langgraph
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

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
