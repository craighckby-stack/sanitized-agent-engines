// --- Graph Definition and Compilation Engine ---
/**
 * Represents the current application state.
 * This is typically a key-value store where values can be of any type.
 */
export type AppState = Record<string, any>;

/**
 * A node handler function that processes the current state.
 * It can return a partial state update (an AppState object),
 * a string indicating the name of the next node to execute,
 * or void if the state update is handled internally or no state/next node update is needed.
 */
export type NodeHandler = (state: AppState) => Promise<AppState | string | void>;

/**
 * Represents a compiled, runnable workflow graph.
 * This structure is used by the execution engine.
 */
export interface CompiledWorkflowGraph {
    nodes: Map<string, NodeHandler>;
    edges: Map<string, string>; // Maps "sourceNode" -> "targetNode" for non-conditional transitions
    conditionalEdges: Map<string, (state: AppState) => string>; // Maps "sourceNode" -> conditionalFn
    entryPoint: string;
    exitPoints: Set<string>;
}

/**
 * Builder for defining and compiling a workflow graph.
 * This class allows for incrementally adding nodes, edges, and defining the graph's entry and exit points.
 */
export class WorkflowGraphBuilder {
    private _nodes: Map<string, NodeHandler> = new Map();
    private _edges: Map<string, string> = new Map(); // Direct edges
    private _conditionalEdges: Map<string, (state: AppState) => string> = new Map();
    private _entryPoint: string | null = null;
    private _exitPoints: Set<string> = new Set();
    private _nodeNames: Set<string> = new Set(); // To quickly check for node existence

    /**
     * Adds a processing node to the graph.
     * @param name The unique name of the node.
     * @param handler The function to execute when this node is active.
     * @returns The builder instance for chaining.
     */
    addNode(name: string, handler: NodeHandler): WorkflowGraphBuilder {
        if (this._nodeNames.has(name)) {
            throw new Error(`Node with name "${name}" already exists.`);
        }
        this._nodes.set(name, handler);
        this._nodeNames.add(name);
        return this;
    }

    /**
     * Adds a direct, unconditional edge between two nodes.
     * @param source The name of the source node.
     * @param target The name of the target node.
     * @returns The builder instance for chaining.
     * @throws Error if the source node already has an outgoing edge or if nodes do not exist.
     */
    addEdge(source: string, target: string): WorkflowGraphBuilder {
        this.ensureNodeExists(source, "source of edge");
        this.ensureNodeExists(target, "target of edge");
        if (this._edges.has(source) || this._conditionalEdges.has(source)) {
            throw new Error(`Node "${source}" already has an outgoing edge defined.`);
        }
        this._edges.set(source, target);
        return this;
    }

    /**
     * Adds a conditional edge from a source node. The `condition` function will determine
     * the next node based on the current state. The `condition` function must return
     * a valid node name.
     * @param source The name of the source node.
     * @param condition A function that takes the current state and returns the name of the next node.
     * @returns The builder instance for chaining.
     * @throws Error if the source node already has an outgoing edge or if the source node does not exist.
     */
    addConditionalEdge(source: string, condition: (state: AppState) => string): WorkflowGraphBuilder {
        this.ensureNodeExists(source, "source of conditional edge");
        if (this._edges.has(source) || this._conditionalEdges.has(source)) {
            throw new Error(`Node "${source}" already has an outgoing edge defined.`);
        }
        this._conditionalEdges.set(source, condition);
        return this;
    }

    /**
     * Sets the starting node for the graph execution.
     * @param nodeName The name of the entry point node.
     * @returns The builder instance for chaining.
     * @throws Error if the entry point node does not exist.
     */
    setEntryPoint(nodeName: string): WorkflowGraphBuilder {
        this.ensureNodeExists(nodeName, "entry point");
        this._entryPoint = nodeName;
        return this;
    }

    /**
     * Adds an exit point node. When execution reaches an exit point, it terminates successfully.
     * @param nodeName The name of the exit point node.
     * @returns The builder instance for chaining.
     * @throws Error if the exit point node does not exist.
     */
    addExitPoint(nodeName: string): WorkflowGraphBuilder {
        this.ensureNodeExists(nodeName, "exit point");
        this._exitPoints.add(nodeName);
        return this;
    }

    private ensureNodeExists(nodeName: string, type: string) {
        if (!this._nodeNames.has(nodeName)) {
            throw new Error(`Node "${nodeName}" specified as ${type} does not exist in the graph.`);
        }
    }

    /**
     * Compiles the defined graph into an immutable `CompiledWorkflowGraph` object.
     * Performs final validation checks to ensure the graph is runnable.
     * @returns The compiled graph.
     * @throws Error if the entry point is not set.
     */
    compile(): CompiledWorkflowGraph {
        if (!this._entryPoint) {
            throw new Error("Entry point must be set before compiling the graph.");
        }

        // Deep copy internal maps/sets to ensure immutability of the compiled graph
        return {
            nodes: new Map(this._nodes),
            edges: new Map(this._edges),
            conditionalEdges: new Map(this._conditionalEdges),
            entryPoint: this._entryPoint,
            exitPoints: new Set(this._exitPoints),
        };
    }
}

// --- State Management Engine ---
// (AppState type is defined in Engine 1 and assumed to be imported or available)
// import { AppState } from './workflow-graph-builder';

/**
 * A function type for defining how state updates are merged into the current state.
 */
export type StateMergeStrategy = (currentState: AppState, update: AppState) => AppState;

/**
 * Implements a default shallow merge strategy for AppState.
 * New properties are added, existing properties are overwritten.
 */
export const defaultShallowMerge: StateMergeStrategy = (currentState: AppState, update: AppState): AppState => {
    return { ...currentState, ...update };
};

/**
 * Manages the application state, providing mechanisms for initialization and updates.
 */
export class WorkflowStateManager {
    private _currentState: AppState;
    private _mergeStrategy: StateMergeStrategy;

    /**
     * Creates a new state manager instance.
     * @param initialState The initial state for the workflow. Defaults to an empty object.
     * @param mergeStrategy An optional function to define how state updates are merged.
     *                      Defaults to a shallow merge (`defaultShallowMerge`).
     */
    constructor(initialState: AppState = {}, mergeStrategy: StateMergeStrategy = defaultShallowMerge) {
        this._currentState = initialState;
        this._mergeStrategy = mergeStrategy;
    }

    /**
     * Gets the current application state.
     * @returns A shallow copy of the current state to prevent external modification of the internal state.
     */
    getCurrentState(): AppState {
        return { ...this._currentState };
    }

    /**
     * Applies a partial update to the current state using the configured merge strategy.
     * @param update The partial state object to merge. If `update` is null or undefined, no action is taken.
     */
    applyUpdate(update: AppState | null | undefined): void {
        if (update) {
            this._currentState = this._mergeStrategy(this._currentState, update);
        }
    }
}

// --- Graph Execution Engine ---
// (AppState type and CompiledWorkflowGraph interface are defined in Engine 1,
// WorkflowStateManager and StateMergeStrategy are defined in Engine 2.
// Assumed to be imported or available.)

// import { AppState, CompiledWorkflowGraph, NodeHandler } from './workflow-graph-builder';
// import { WorkflowStateManager } from './workflow-state-manager';

/**
 * Represents the result of a workflow execution.
 */
export interface WorkflowExecutionResult {
    finalState: AppState;
    executionLog: string[];
    completed: boolean;
    reason: string;
}

/**
 * Orchestrates the execution of a compiled workflow graph.
 */
export class WorkflowExecutionEngine {
    private _graph: CompiledWorkflowGraph;
    private _stateManager: WorkflowStateManager;
    private _maxSteps: number;

    /**
     * Creates a new execution engine instance.
     * @param graph The compiled workflow graph to execute.
     * @param initialState The initial state for the workflow. Defaults to an empty object.
     * @param maxSteps Maximum number of steps to prevent infinite loops in cyclic graphs. Defaults to 100.
     */
    constructor(graph: CompiledWorkflowGraph, initialState: AppState = {}, maxSteps: number = 100) {
        this._graph = graph;
        this._stateManager = new WorkflowStateManager(initialState);
        this._maxSteps = maxSteps;
    }

    /**
     * Executes the workflow graph from its entry point until an exit point is reached,
     * the maximum number of steps is exceeded, or an error occurs.
     * @returns A promise that resolves to the workflow execution result.
     * @throws Error if a critical issue occurs during execution (e.g., node not found, handler error, invalid conditional routing).
     */
    async execute(): Promise<WorkflowExecutionResult> {
        let currentNodeName: string = this._graph.entryPoint;
        const executionLog: string[] = [];
        let stepCount = 0;
        let completed = false;
        let reason = "Max steps reached";

        executionLog.push(`Starting workflow at entry point: ${currentNodeName}`);

        while (stepCount < this._maxSteps) {
            // Check if current node is an exit point
            if (this._graph.exitPoints.has(currentNodeName)) {
                completed = true;
                reason = `Reached explicit exit point: "${currentNodeName}".`;
                executionLog.push(reason);
                break; // Workflow completed
            }

            const handler = this._graph.nodes.get(currentNodeName);
            if (!handler) {
                reason = `Error: Node "${currentNodeName}" not found in graph definition.`;
                executionLog.push(reason);
                throw new Error(reason);
            }

            executionLog.push(`Executing node: "${currentNodeName}" (Step ${stepCount + 1})`);
            const currentState = this._stateManager.getCurrentState();
            let handlerResult: AppState | string | void;

            try {
                handlerResult = await handler(currentState);
            } catch (error: any) {
                reason = `Error executing node "${currentNodeName}": ${error.message || String(error)}.`;
                executionLog.push(reason);
                throw new Error(reason);
            }

            // Process handler result: state update or next node instruction
            if (typeof handlerResult === 'object' && handlerResult !== null) {
                this._stateManager.applyUpdate(handlerResult);
                executionLog.push(`  State updated by node "${currentNodeName}".`);
            } else if (typeof handlerResult === 'string') {
                // Node explicitly returned next node name, overriding graph edges for this step.
                if (!this._graph.nodes.has(handlerResult)) {
                    reason = `Error: Node "${currentNodeName}" handler returned unknown next node "${handlerResult}".`;
                    executionLog.push(reason);
                    throw new Error(reason);
                }
                executionLog.push(`  Node "${currentNodeName}" handler directed workflow to: "${handlerResult}".`);
                currentNodeName = handlerResult;
                stepCount++;
                continue; // Skip normal edge resolution for this step
            }
            // If handlerResult is void, no explicit state update or next node instruction;
            // proceed to resolve next node via graph edges.

            // Determine next node based on graph edges
            const nextNodeFromDirectEdge = this._graph.edges.get(currentNodeName);
            const conditionalFunction = this._graph.conditionalEdges.get(currentNodeName);
            let nextNodeDeterminedByGraph: string | undefined;

            if (conditionalFunction) {
                nextNodeDeterminedByGraph = conditionalFunction(this._stateManager.getCurrentState());
                if (!this._graph.nodes.has(nextNodeDeterminedByGraph)) {
                    reason = `Error: Conditional edge from "${currentNodeName}" evaluated to unknown node "${nextNodeDeterminedByGraph}".`;
                    executionLog.push(reason);
                    throw new Error(reason);
                }
                executionLog.push(`  Conditional edge from "${currentNodeName}" leads to: "${nextNodeDeterminedByGraph}".`);
            } else if (nextNodeFromDirectEdge) {
                nextNodeDeterminedByGraph = nextNodeFromDirectEdge;
                executionLog.push(`  Direct edge from "${currentNodeName}" leads to: "${nextNodeDeterminedByGraph}".`);
            }

            if (nextNodeDeterminedByGraph) {
                currentNodeName = nextNodeDeterminedByGraph;
            } else {
                // If current node has no outgoing edges and is not an exit point, it's an implicit halt.
                reason = `Node "${currentNodeName}" has no outgoing edges defined and is not an explicit exit point. Workflow halted unexpectedly.`;
                executionLog.push(reason);
                break; // Halted
            }

            stepCount++;
        }

        if (!completed && stepCount >= this._maxSteps) {
            executionLog.push(`Workflow stopped after ${this._maxSteps} steps (max steps reached).`);
        }

        return {
            finalState: this._stateManager.getCurrentState(),
            executionLog: executionLog,
            completed: completed,
            reason: reason,
        };
    }
}