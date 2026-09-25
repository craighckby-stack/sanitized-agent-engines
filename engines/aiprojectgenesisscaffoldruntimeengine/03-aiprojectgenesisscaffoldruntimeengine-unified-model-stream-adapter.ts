/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AIProjectGenesisScaffoldRuntimeEngine Unified Model Stream Adapter
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

export interface StreamDelta {
  type: 'text_chunk' | 'thought_chunk' | 'tool_call_chunk' | 'finish';
  deltaText?: string;
  deltaThought?: string;
  toolCall?: { id: string; name?: string; deltaArgs?: string };
}

export class AIProjectGenesisScaffoldRuntimeEngineModelAdapter {
  public async *generateStream(messages: any[], tools: any[]): AsyncIterable<StreamDelta> {
    const responseStream = await fetch('/api/engine/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, tools }),
    });
    const data = await responseStream.json();
    if (data.thought) yield { type: 'thought_chunk', deltaThought: data.thought };
    if (data.text) yield { type: 'text_chunk', deltaText: data.text };
    yield { type: 'finish' };
  }
}
