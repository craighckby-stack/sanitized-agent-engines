/**
 * @license
 * SPDX-License-Identifier: MIT
 *
 * LanggraphRuntimeEnginePregelExecutor
 * Source Origin: langchain-ai/langgraph
 * Isolated clean-room architectural engine extracted by Engine Harvester
 */

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
