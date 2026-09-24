// --- Task Execution Engine ---
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface Task {
  id: string;
  description: string;
  expectedOutput: string;
  assignedAgent: string;
}

class TaskExecutionEngine {
  private taskRegistry: Map<string, TaskStatus> = new Map();

  public async executeTask(task: Task, context: Record<string, any>): Promise<string> {
    this.taskRegistry.set(task.id, 'in_progress');
    
    try {
      console.log(`Executing task: ${task.id} with context:`, context);
      // Simulate processing logic
      const result = `Result of ${task.description}`;
      
      this.taskRegistry.set(task.id, 'completed');
      return result;
    } catch (error) {
      this.taskRegistry.set(task.id, 'failed');
      throw new Error(`Task Execution failed: ${task.id}`);
    }
  }

  public getTaskStatus(taskId: string): TaskStatus {
    return this.taskRegistry.get(taskId) || 'pending';
  }
}

// --- Agent Delegation Engine ---
interface Agent {
  id: string;
  role: string;
  capabilities: string[];
}

class AgentDelegationEngine {
  private agents: Map<string, Agent> = new Map();

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  public delegate(
    delegatorId: string, 
    delegateeId: string, 
    subTask: string
  ): { status: string; proof: string } {
    const delegator = this.agents.get(delegatorId);
    const delegatee = this.agents.get(delegateeId);

    if (!delegator || !delegatee) {
      throw new Error("Invalid Agent reference in delegation chain.");
    }

    // Logic to verify capability match before delegation
    console.log(`Agent ${delegator.role} delegating to ${delegatee.role}: ${subTask}`);
    
    return {
      status: 'delegated',
      proof: `delegation_sequence_${Date.now()}`
    };
  }
}

// --- Sequential Process Engine ---
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