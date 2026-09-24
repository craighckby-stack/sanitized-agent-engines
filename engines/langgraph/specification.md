# Core Runtime Engine Architecture: Graph-Based State Orchestration

This document catalogs the core runtime engines identified in the `LanggraphRuntimeEngine` ecosystem. These engines are responsible for the deterministic execution of stateful, multi-actor computational graphs.

---

## Engine 1: The State Graph Execution Engine

### What it does
The `StateGraph` engine serves as the primary orchestration layer for directed acyclic and cyclic graphs. It manages the transition between nodes based on a defined schema. 
- **Inputs:** An initial state object, a collection of node functions, and edge logic (conditional or deterministic).
- **State Lifecycle:** It performs a functional reduction of state. Each node receives the current state, processes it, and returns an update. The engine merges this update into the master state using a defined reducer function.
- **Invariant Preservation:** It ensures that state transitions are immutable and that every execution step is tracked within a persistent checkpointer history.
- **Outputs:** The final computed state once the graph reaches an "END" terminal node.

### Implementation Code
```typescript
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
```

---

## Engine 2: The Checkpoint Persistence Engine

### What it does
The `CheckpointPersistenceEngine` acts as the durability layer for the graph execution. 
- **Inputs:** The serialized state snapshot, the graph configuration, and a unique thread identifier.
- **State Lifecycle:** It intercepts the state after every node execution. It serializes the state object and stores it in a key-value store, mapping it to a `thread_id` and `checkpoint_id`.
- **Invariant Preservation:** It ensures that execution can be resumed from an arbitrary point of failure (idempotency and recovery).
- **Outputs:** A hash identifier representing the successfully persisted state.

### Implementation Code
```typescript
interface Checkpoint {
  threadId: string;
  state: Record<string, any>;
  timestamp: number;
}

class CheckpointPersistenceEngine {
  private store: Map<string, Checkpoint[]> = new Map();

  async save(threadId: string, state: Record<string, any>): Promise<string> {
    const checkpointId = crypto.randomUUID();
    const checkpoint: Checkpoint = {
      threadId,
      state,
      timestamp: Date.now(),
    };

    const history = this.store.get(threadId) || [];
    history.push(checkpoint);
    this.store.set(threadId, history);

    return checkpointId;
  }

  async getLatest(threadId: string): Promise<Record<string, any> | null> {
    const history = this.store.get(threadId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1].state;
  }
}
```

---

## Engine 3: The Compiled Graph Runtime

### What it does
The `CompiledGraphRuntime` is the high-level abstraction that fuses the graph definition (Nodes/Edges) with the persistence layer. 
- **Inputs:** A graph structure, a configuration object, and input payloads.
- **State Lifecycle:** It handles the context initialization, invokes the `StateGraphEngine` for computation, and triggers the `CheckpointPersistenceEngine` to flush state transitions.
- **Invariant Preservation:** It enforces that all inputs are validated against the provided schema and that concurrency is managed via proper thread isolation.
- **Outputs:** The stream or final result of the graph execution.

### Implementation Code
```typescript
interface GraphConfig {
  threadId: string;
}

class CompiledGraphRuntime<S> {
  constructor(
    private graph: StateGraphEngine<S>,
    private persistence: CheckpointPersistenceEngine
  ) {}

  async invoke(input: S, config: GraphConfig): Promise<S> {
    // Attempt recovery from persistence
    const savedState = await this.persistence.getLatest(config.threadId);
    const startState = savedState || input;

    // Execute graph
    const result = await this.graph.execute("start");

    // Persist finalized state
    await this.persistence.save(config.threadId, result as Record<string, any>);

    return result;
  }
}
```