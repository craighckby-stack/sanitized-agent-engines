/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Graph Definition and Compilation Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

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
