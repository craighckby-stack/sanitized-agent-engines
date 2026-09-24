/**
 * Type alias for the global graph state, typically a record of string keys to any value.
 */
type GraphState = Record<string, any>;

/**
 * Type alias for a function executed by a node.
 * It takes the current graph state and returns a promise resolving to a partial state update,
 * or the partial state update directly.
 */
type NodeFunction = (state: GraphState) => Promise<Partial<GraphState>> | Partial<GraphState>;

/**
 * Type alias for a function used in conditional edges.
 * It takes the current graph state and returns a promise resolving to the name of the next node,
 * or `null` if no specific transition should occur, or the node name directly.
 */
type ConditionalEdgeFunction = (state: GraphState) => Promise<string | null> | string | null;

/**
 * Interface representing a computational node within the graph.
 * Nodes encapsulate a specific unit of work and define how they modify the graph state.
 */
interface GraphNode {
    name: string;
    action: NodeFunction;
}

/**
 * Interface representing an edge in the graph.
 * Edges dictate the flow of execution, defining transitions between nodes.
 * They can be direct, conditional, or signal the end of execution.
 */
interface GraphEdge {
    source: string; // The unique name of the source node for this edge.
    target?: string; // The unique name of the target node for direct edges.
    condition?: ConditionalEdgeFunction; // The function for conditional edges, determining the next node.
    type: 'direct' | 'conditional' | 'end'; // The type of edge: direct, conditional, or end-of-graph.
}

/**
 * The `GraphDefinitionBuilder` is the primary interface for programmatically constructing
 * the graph's structure. It allows for defining nodes, connecting them with various
 * types of edges, and specifying the graph's entry point. Once the graph is fully defined,
 * it can be compiled into an immutable `CompiledRuntimeGraph` suitable for execution.
 */
class GraphDefinitionBuilder {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: GraphEdge[] = [];
    private startNodeName: string | null = null;

    /**
     * Adds a new computational node to the graph.
     * Each node must have a unique name and an associated action function.
     * @param name The unique identifier for the node.
     * @param action The function executed by this node, returning state updates.
     * @throws Error if a node with the same name already exists.
     */
    addNode(name: string, action: NodeFunction): void {
        if (this.nodes.has(name)) {
            throw new Error(`Node with name '${name}' already exists.`);
        }
        this.nodes.set(name, { name, action });
    }

    /**
     * Specifies the node from which the graph execution should begin.
     * This node must have been previously added to the graph.
     * @param nodeName The name of the designated start node.
     * @throws Error if the specified start node does not exist.
     */
    setStartNode(nodeName: string): void {
        if (!this.nodes.has(nodeName)) {
            throw new Error(`Start node '${nodeName}' not found.`);
        }
        this.startNodeName = nodeName;
    }

    /**
     * Adds a direct, unconditional edge from a source node to a target node.
     * Execution will proceed directly from the source to the target after the source node completes.
     * @param source The name of the node where the edge originates.
     * @param target The name of the node where the edge terminates.
     * @throws Error if either the source or target node does not exist.
     */
    addDirectEdge(source: string, target: string): void {
        if (!this.nodes.has(source)) throw new Error(`Source node '${source}' not found.`);
        if (!this.nodes.has(target)) throw new Error(`Target node '${target}' not found.`);
        this.edges.push({ source, target, type: 'direct' });
    }

    /**
     * Adds a conditional edge where the next node is determined by evaluating a `condition` function
     * against the current graph state. The condition function should return the name of the next
     * node or `null` if no transition occurs via this edge.
     * @param source The name of the node where the conditional edge originates.
     * @param condition The function that determines the next node based on state.
     * @throws Error if the source node does not exist.
     */
    addConditionalEdge(source: string, condition: ConditionalEdgeFunction): void {
        if (!this.nodes.has(source)) throw new Error(`Source node '${source}' not found.`);
        this.edges.push({ source, condition, type: 'conditional' });
    }

    /**
     * Adds an 'end' edge, indicating that when execution reaches the specified source node,
     * the graph execution should terminate.
     * @param source The name of the node from which the graph execution should end.
     * @throws Error if the source node does not exist.
     */
    addEndEdge(source: string): void {
        if (!this.nodes.has(source)) throw new Error(`Source node '${source}' not found.`);
        this.edges.push({ source, type: 'end' });
    }

    /**
     * Compiles the currently defined nodes, edges, and start node into an immutable
     * `CompiledRuntimeGraph`. This compiled representation is optimized for execution
     * and guarantees that the graph structure remains constant during runtime.
     * @returns A `CompiledRuntimeGraph` instance ready for use by an executor.
     * @throws Error if a start node has not been designated before compilation.
     */
    compile(): CompiledRuntimeGraph {
        if (!this.startNodeName) {
            throw new Error("A start node must be set before compiling the graph.");
        }
        return new CompiledRuntimeGraph(this.nodes, this.edges, this.startNodeName);
    }
}

/**
 * `CompiledRuntimeGraph` is an immutable, read-only representation of a graph's structure.
 * It contains all defined nodes, edges, and the designated start node. This class is the
 * output of the `GraphDefinitionBuilder` and serves as the input for the `GraphExecutionEngine`.
 * Its immutability ensures consistent execution behavior.
 */
class CompiledRuntimeGraph {
    public readonly nodes: ReadonlyMap<string, GraphNode>;
    public readonly edges: ReadonlyArray<GraphEdge>;
    public readonly startNodeName: string;

    /**
     * Constructs a new `CompiledRuntimeGraph`.
     * @param nodes A map of node names to `GraphNode` objects.
     * @param edges An array of `GraphEdge` objects.
     * @param startNodeName The name of the node where execution should begin.
     */
    constructor(nodes: Map<string, GraphNode>, edges: GraphEdge[], startNodeName: string) {
        this.nodes = new Map(nodes); // Create a defensive copy to ensure immutability
        this.edges = Object.freeze([...edges]); // Create a defensive copy and freeze the array
        this.startNodeName = startNodeName;
    }

    /**
     * Retrieves a specific `GraphNode` by its unique name.
     * @param name The name of the node to retrieve.
     * @returns The `GraphNode` instance, or `undefined` if no node with that name exists.
     */
    getNode(name: string): GraphNode | undefined {
        return this.nodes.get(name);
    }

    /**
     * Retrieves all outgoing `GraphEdge` instances from a specified source node.
     * @param sourceNodeName The name of the node whose outgoing edges are to be found.
     * @returns An array of `GraphEdge` instances originating from the given source node.
     */
    getOutgoingEdges(sourceNodeName: string): GraphEdge[] {
        return this.edges.filter(edge => edge.source === sourceNodeName);
    }
}