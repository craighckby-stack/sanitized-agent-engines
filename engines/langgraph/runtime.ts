type StateReducer<S> = (current: S, update: Partial<S>) => S;

interface NodeFunction<S> {
  (state: S): Promise<Partial<S>>;
}

class StateGraphEngine<S> {
  private nodes: Map<string, NodeFunction<S>> = new Map();
  private edges: Map<string, string | ((s: S) => string)> = new Map();
  
  constructor(private initialState: S, private reducer: StateReducer<S>) {}

  addNode(name: string, fn: NodeFunction<S>): void {
    this.nodes.set(name, fn);
  }

  addEdge(from: string, to: string | ((s: S) => string)): void {
    this.edges.set(from, to);
  }

  async execute(startNode: string): Promise<S> {
    let currentState = this.initialState;
    let currentNode = startNode;

    while (currentNode !== "__end__") {
      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) throw new Error(`Node ${currentNode} not found`);

      const update = await nodeFn(currentState);
      currentState = this.reducer(currentState, update);

      const next = this.edges.get(currentNode);
      if (!next) break;

      currentNode = typeof next === "function" ? next(currentState) : next;
    }

    return currentState;
  }
}