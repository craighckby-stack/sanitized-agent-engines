/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * State Management Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

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
