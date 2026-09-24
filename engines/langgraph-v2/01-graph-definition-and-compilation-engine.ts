/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Graph Definition and Compilation Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

/**
 * Represents the current global state of the graph computation.
 * This is typically a dictionary where keys are channel names.
 */
type State = Record<string, any>;

/**
 * A function that defines the logic of a graph node.
 * It takes the current global state and returns a partial state object
 * representing updates to be applied.
 */
type NodeFunction = (state: State) => State | Promise<State>;

/**
 * A predicate function for conditional edges.
 * It takes the current global state and returns a string key that maps
 * to a specific target node in the conditional branches.
 */
type ConditionalEdgePredicate = (state: State) => string;

/**
 * Defines the configuration for a state channel, including its aggregation strategy.
 */
interface ChannelConfig {
    /**
     * The strategy for aggregating updates to this channel.
     * 'last_write_wins': The latest update overwrites previous values.
     * 'binary_operator': A custom operator function combines current and new values.
     * 'append_list': New values are appended to a list.
     */
    aggregator: 'last_write_wins' | 'binary_operator' | 'append_list';
    /**
     * An optional operator function for 'binary_operator' channels.
     * It takes the current value and a new value, returning the aggregated result.
     */
    operator?: (current: any, new_val: any) => any;
    /**
     * An optional default value for the channel if not provided in initial state.
     */
    default_value?: any;
}

/**
 * Represents the compiled graph structure, ready for execution by the runtime engine.
 */
interface CompiledGraph {
    nodes: Map<string, NodeFunction>;
    edges: Map<string, string | ConditionalEdgePredicate>; // Maps source node to target node or predicate
    conditionalBranches: Map<string, Record<string, string>>; // Only for conditional edges
    entrypoint: string | null;
    finishingPoints: Set<string>; // Nodes that, when reached, terminate a path or the graph
    channels: Record<string, ChannelConfig>; // How state channels are managed
}

/**
 * The Graph Definition and Compilation Engine.
 * It allows users to define the graph structure (nodes, edges, entry/exit points)
 * and compile it into an executable representation for the LanggraphRuntimeEngine.
 */
class GraphDefinitionEngine {
    private nodes: Map<string, NodeFunction> = new Map();
    private edges: Map<string, string> = new Map(); // Unconditional edges
    private conditionalEdges: Map<string, { predicate: ConditionalEdgePredicate, branches: Record<string, string> }> = new Map();
    private entrypoint: string | null = null;
    private finishingPoints: Set<string> = new Set();
    private channelConfigs: Record<string, ChannelConfig> = {};

    /**
     * Initializes the GraphDefinitionEngine with optional initial channel configurations.
     * @param initialChannels A map of channel names to their configurations.
     */
    constructor(initialChannels: Record<string, ChannelConfig> = {}) {
        this.channelConfigs = initialChannels;
    }

    /**
     * Adds a node to the graph.
     * @param name The unique name of the node.
     * @param func The NodeFunction defining the node's logic.
     * @returns The current GraphDefinitionEngine instance for chaining.
     * @throws Error if a node with the same name already exists.
     */
    addNode(name: string, func: NodeFunction): this {
        if (this.nodes.has(name)) {
            throw new Error(`Node with name "${name}" already exists.`);
        }
        this.nodes.set(name, func);
        return this;
    }

    /**
     * Adds an unconditional edge between two nodes.
     * @param source The name of the source node.
     * @param target The name of the target node. Can be '__end__' to signify termination.
     * @returns The current GraphDefinitionEngine instance for chaining.
     * @throws Error if source/target nodes are not defined or if the source node already has an outgoing edge.
     */
    addEdge(source: string, target: string): this {
        if (!this.nodes.has(source) && source !== '__start__') { // '__start__' is a special conceptual source
             throw new Error(`Source node "${source}" not defined.`);
        }
        if (!this.nodes.has(target) && target !== '__end__') { // '__end__' is a special conceptual target
            throw new Error(`Target node "${target}" not defined.`);
        }
        if (this.edges.has(source) || this.conditionalEdges.has(source)) {
            throw new Error(`Node "${source}" already has an outgoing edge.`);
        }
        this.edges.set(source, target);
        return this;
    }

    /**
     * Adds a conditional edge from a source node, where a predicate determines the next node.
     * @param source The name of the source node.
     * @param predicate A function that takes the current state and returns a key corresponding to a branch.
     * @param branches A map where keys are predicate outputs and values are target node names (or '__end__').
     * @returns The current GraphDefinitionEngine instance for chaining.
     * @throws Error if the source node is not defined, already has an outgoing edge, or any target node in branches is undefined.
     */
    addConditionalEdge(source: string, predicate: ConditionalEdgePredicate, branches: Record<string, string>): this {
        if (!this.nodes.has(source)) {
            throw new Error(`Source node "${source}" not defined.`);
        }
        if (this.edges.has(source) || this.conditionalEdges.has(source)) {
            throw new Error(`Node "${source}" already has an outgoing edge.`);
        }
        for (const target of Object.values(branches)) {
            if (!this.nodes.has(target) && target !== '__end__') {
                throw new Error(`Target node "${target}" in conditional branches not defined.`);
            }
        }
        this.conditionalEdges.set(source, { predicate, branches });
        return this;
    }

    /**
     * Sets the entrypoint node for the graph execution.
     * @param nodeName The name of the node where execution will begin.
     * @returns The current GraphDefinitionEngine instance for chaining.
     * @throws Error if the entrypoint node is not defined.
     */
    setEntrypoint(nodeName: string): this {
        if (!this.nodes.has(nodeName)) {
            throw new Error(`Entrypoint node "${nodeName}" not defined.`);
        }
        this.entrypoint = nodeName;
        return this;
    }

    /**
     * Designates one or more nodes as finishing points for the graph.
     * When a path leads to a finishing point (or '__end__'), that path terminates.
     * The overall graph execution may continue until all active paths have terminated.
     * @param nodeName A single node name or an array of node names to set as finishing points.
     * @returns The current GraphDefinitionEngine instance for chaining.
     */
    setFinishingPoint(nodeName: string | string[]): this {
        const names = Array.isArray(nodeName) ? nodeName : [nodeName];
        for (const name of names) {
            // No explicit check for node existence for '__end__' as it's a conceptual target.
            this.finishingPoints.add(name);
        }
        return this;
    }

    /**
     * Compiles the defined graph into a runnable PregelRuntimeEngine instance.
     * @returns A new PregelRuntimeEngine instance representing the compiled graph.
     * @throws Error if no entrypoint is set.
     */
    compile(): PregelRuntimeEngine {
        if (!this.entrypoint) {
            throw new Error("Entrypoint not set for the graph. Cannot compile.");
        }
        if (this.finishingPoints.size === 0) {
            console.warn("No explicit finishing points set for the graph. Execution will stop when no more nodes are active or max steps reached.");
        }

        const compiledNodes = new Map<string, NodeFunction>(this.nodes);
        const compiledEdges = new Map<string, string | ConditionalEdgePredicate>();
        const compiledConditionalBranches = new Map<string, Record<string, string>>();

        // Merge unconditional and conditional edges into a single structure
        for (const [source, target] of this.edges.entries()) {
            compiledEdges.set(source, target);
        }
        for (const [source, { predicate, branches }] of this.conditionalEdges.entries()) {
            compiledEdges.set(source, predicate); // The predicate itself acts as the "target resolver"
            compiledConditionalBranches.set(source, branches);
        }

        const compiledGraph: CompiledGraph = {
            nodes: compiledNodes,
            edges: compiledEdges,
            conditionalBranches: compiledConditionalBranches,
            entrypoint: this.entrypoint,
            finishingPoints: this.finishingPoints,
            channels: this.channelConfigs,
        };

        return new PregelRuntimeEngine(compiledGraph);
    }
}
