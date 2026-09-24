/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sequential Process Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

class SequentialProcessEngine {
  private taskQueue: Task[] = [];
  private engine: TaskExecutionEngine;

  constructor(engine: TaskExecutionEngine) {
    this.engine = engine;
  }

  public addTask(task: Task): void {
    this.taskQueue.push(task);
  }

  public async run(): Promise<void> {
    let currentContext: Record<string, any> = {};

    for (const task of this.taskQueue) {
      const output = await this.engine.executeTask(task, currentContext);
      // Update context for the next task
      currentContext = { ...currentContext, [task.id]: output };
    }
    
    console.log("Process execution finished successfully.");
  }
}
