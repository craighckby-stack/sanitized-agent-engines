/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StateSerializationEngine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

interface SerializedState {
  agentName: string;
  history: { role: string; content: string }[];
}

class StateSerializationEngine {
  public static serialize(agent: AgentRuntimeEngine): string {
    const state: SerializedState = {
      agentName: "AgentInstance",
      history: agent.getHistory()
    };
    return JSON.stringify(state);
  }

  public static deserialize(json: string): SerializedState {
    try {
      return JSON.parse(json) as SerializedState;
    } catch (e) {
      throw new Error("Failed to restore agent state: Invalid format.");
    }
  }
}
