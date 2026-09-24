/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Task Execution Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
}

class TaskExecutionEngine {
  private tasks: Task[] = [];
  private state: 'idle' | 'executing' = 'idle';

  constructor(private goal: string) {}

  public async executeNext(): Promise<void> {
    this.state = 'executing';
    
    const nextTask = this.tasks.find(t => t.status === 'pending');
    if (!nextTask) {
      this.state = 'idle';
      return;
    }

    try {
      console.log(`Executing task: ${nextTask.description}`);
      nextTask.status = 'completed';
    } catch (error) {
      nextTask.status = 'failed';
    } finally {
      this.state = 'idle';
    }
  }

  public addTask(description: string): void {
    this.tasks.push({
      id: Math.random().toString(36),
      description,
      status: 'pending'
    });
  }
}
