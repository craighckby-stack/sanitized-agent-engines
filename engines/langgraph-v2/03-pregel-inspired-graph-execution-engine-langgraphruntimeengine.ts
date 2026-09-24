/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pregel-inspired Graph Execution Engine (LanggraphRuntimeEngine)
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

/**
 * The Pregel-inspired Graph Execution Engine (LanggraphRuntimeEngine).
 * This is the core runtime that orchestrates the execution of nodes based on
 * the graph topology and state changes.
 */
class PregelRuntimeEngine {
    private compiledGraph: CompiledGraph;

    /**
     * @param compiledGraph The compiled graph structure from the GraphDefinitionEngine.
     */
    constructor(compiledGraph: CompiledGraph) {
        this.compiledGraph = compiledGraph;
    }

    /**
     * Invokes the compiled graph once with an optional initial state, returning the final state.
     * @param initialState The initial state for this invocation.
     * @returns A promise that resolves to the final `State` of the graph.
     */
    async invoke(initialState: State = {}): Promise<State> {
        // Run the stream and return the last yielded value.
        let finalState: State = {};
        for await (const state of this.stream(initialState)) {
            finalState = state;
        }
        return finalState;
    }

    /**
     * Streams the execution of the compiled graph, yielding the state at each step.
     * @param initialState The initial state for this invocation.
     * @returns An AsyncGenerator that yields `State` snapshots as the graph executes.
     */
    async *stream(initialState: State = {}): AsyncGenerator<State, void, void> {
        // Create a fresh state manager for each invocation to ensure isolation.
        const stateManager = new ChannelStateManager(this.compiledGraph.channels, initialState);

        let currentActiveNodes: Set<string> = new Set();
        let step = 0;
        const maxSteps = 100; // Safeguard against infinite loops

        // Initialize active nodes with the entrypoint
        if (this.compiledGraph.entrypoint) {
            currentActiveNodes.add(this.compiledGraph.entrypoint);
        } else if (Object.keys(initialState).length > 0) {
            // If there's an initial state but no explicit entrypoint,
            // the graph might be designed to start from an implicit state.
            // For a strict Pregel-like flow, an entrypoint is usually expected.
            // For simplicity, we assume an entrypoint is defined or the graph is purely state-driven (less common).
            console.warn("No entrypoint defined for the graph, but initial state provided. Graph might not activate nodes without an explicit starting point.");
        }

        // Yield the initial state, representing the state before any node execution
        yield stateManager.getCurrentState();

        // Main execution loop: continues as long as there are active nodes
        // and the max step limit hasn't been reached.
        while (currentActiveNodes.size > 0 && step < maxSteps) {
            step++;
            const currentGlobalState = stateManager.getCurrentState();
            const pendingWrites: State[] = []; // Collect all updates from nodes in this step
            const newlyDiscoveredActiveNodes: Set<string> = new Set(); // Nodes activated by edges in this step

            // Execute all nodes that are currently active in parallel (conceptually).
            // `Promise.all` ensures all nodes finish before moving to the next phase.
            const nodeExecutionPromises = Array.from(currentActiveNodes).map(async nodeName => {
                const nodeFunc = this.compiledGraph.nodes.get(nodeName);
                if (nodeFunc) {
                    try {
                        // Execute the node function
                        const nodeOutput = await Promise.resolve(nodeFunc(currentGlobalState));
                        if (nodeOutput && Object.keys(nodeOutput).length > 0) {
                            pendingWrites.push(nodeOutput);
                        }

                        // Determine the next nodes based on outgoing edges from the current node
                        const edgeTargetOrPredicate = this.compiledGraph.edges.get(nodeName);
                        if (edgeTargetOrPredicate) {
                            let nextNodesForThisPath: string[] = [];
                            if (typeof edgeTargetOrPredicate === 'string') { // Unconditional edge
                                nextNodesForThisPath.push(edgeTargetOrPredicate);
                            } else { // Conditional edge (predicate function)
                                const predicate = edgeTargetOrPredicate;
                                const branches = this.compiledGraph.conditionalBranches.get(nodeName);
                                if (!branches) {
                                    throw new Error(`Conditional edge for node "${nodeName}" has no branches defined.`);
                                }
                                // The predicate uses the current global state to decide the next path
                                const nextBranchKey = predicate(currentGlobalState);
                                const targetNode = branches[nextBranchKey];
                                if (targetNode) {
                                    nextNodesForThisPath.push(targetNode);
                                } else {
                                    console.warn(`Predicate for node "${nodeName}" returned "${nextBranchKey}", but no matching branch found. No path taken from this node.`);
                                }
                            }

                            // Add newly discovered nodes to the set for the next step,
                            // unless they are explicit finishing points or the special '__end__' node.
                            for (const nextNode of nextNodesForThisPath) {
                                const isFinishingPoint = this.compiledGraph.finishingPoints.has(nextNode) || nextNode === '__end__';
                                if (!isFinishingPoint) {
                                    newlyDiscoveredActiveNodes.add(nextNode);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error executing node "${nodeName}":`, error);
                        // An error in one node should ideally not halt the entire graph.
                        // We log the error and allow other paths to continue.
                    }
                } else {
                    console.warn(`Active node "${nodeName}" not found in compiled graph definition. Skipping execution.`);
                }
            });

            // Wait for all active nodes in the current step to complete execution.
            await Promise.all(nodeExecutionPromises);

            // Apply all collected state updates from this step's node executions
            pendingWrites.forEach(update => stateManager.applyUpdates(update));

            // Yield the state *after* all nodes have run and their updates applied for this step.
            yield stateManager.getCurrentState();

            // Prepare for the next superstep by updating the set of active nodes.
            currentActiveNodes = newlyDiscoveredActiveNodes;
        }

        // Log a warning if the maximum number of steps was reached without natural termination.
        if (step >= maxSteps && currentActiveNodes.size > 0) {
            console.warn(`LanggraphRuntimeEngine hit maximum steps (${maxSteps}). The graph might have an infinite loop or too many legitimate steps.`);
        }
        // The last state was already yielded inside the loop.
    }
}
