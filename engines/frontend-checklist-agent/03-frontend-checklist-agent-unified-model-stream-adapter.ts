/* GLM-Engine-Harvester [2026-10-09T03:30:29.651Z] */
/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Engine 3: Frontend Checklist Agent Engine — Unified Model Stream Adapter
 * Source Origin: thedaviddias/Front-End-Checklist
 */

export class FrontendChecklistModelStream {
  private buffer: string = '';
  private callbacks: Array<(chunk: string) => void> = [];

  /** Process a streaming token and emit partial results */
  processToken(token: string) {
    this.buffer += token;
    
    // Try to extract complete JSON objects
    const jsonStart = this.buffer.indexOf('{');
    if (jsonStart !== -1) {
      const jsonEnd = this.buffer.lastIndexOf('}');
      if (jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = this.buffer.substring(jsonStart, jsonEnd + 1);
        try {
          const parsed = JSON.parse(jsonString);
          this.callbacks.forEach(cb => cb(jsonString));
        } catch (e) {
          // Invalid JSON, continue buffering
        }
      }
    }
  }

  /** Register a callback for streaming data */
  onData(callback: (chunk: string) => void) {
    this.callbacks.push(callback);
  }

  /** Reset the stream buffer */
  reset() {
    this.buffer = '';
    this.callbacks = [];
  }
}
