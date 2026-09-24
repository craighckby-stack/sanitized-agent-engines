/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Graph Execution Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

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
