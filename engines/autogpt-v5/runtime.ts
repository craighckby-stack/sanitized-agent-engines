// --- AutoGPTRuntimeEngine Lifecycle Kernel ---
export interface Disposable {
  dispose(): void | Promise<void>;
}

export type LifecycleHookName =
  | 'session:create'
  | 'step:before'
  | 'step:after'
  | 'model:stream:chunk'
  | 'tool:invoke:before'
  | 'tool:invoke:after';

export class AutoGPTRuntimeEngineLifecycleContext {
  public readonly id: string;
  public readonly parent: AutoGPTRuntimeEngineLifecycleContext | null;
  public readonly scope: 'global' | 'session' | 'step';
  private services = new Map<string, unknown>();
  private hooks = new Map<string, Set<(payload: any, ctx: any) => void>>();
  private disposables = new Set<Disposable>();

  constructor(scope: 'global' | 'session' | 'step' = 'global', parent: AutoGPTRuntimeEngineLifecycleContext | null = null) {
    this.id = `${scope}_${Math.random().toString(36).substring(2, 9)}`;
    this.scope = scope;
    this.parent = parent;
  }

  public provide<T>(id: string, service: T): void {
    this.services.set(id, service);
  }

  public inject<T>(id: string): T {
    if (this.services.has(id)) return this.services.get(id) as T;
    if (this.parent) return this.parent.inject<T>(id);
    throw new Error(`Service '${id}' not found in context hierarchy`);
  }

  public on<T>(event: LifecycleHookName, handler: (payload: T, ctx: AutoGPTRuntimeEngineLifecycleContext) => void): Disposable {
    if (!this.hooks.has(event)) this.hooks.set(event, new Set());
    const set = this.hooks.get(event)!;
    set.add(handler);
    const d: Disposable = { dispose: () => set.delete(handler) };
    this.disposables.add(d);
    return d;
  }

  public async emit<T>(event: LifecycleHookName, payload: T): Promise<void> {
    const handlers = this.hooks.get(event);
    if (handlers) {
      await Promise.allSettled(Array.from(handlers).map((h) => h(payload, this)));
    }
    if (this.parent) await this.parent.emit(event, payload);
  }

  public extend(scope: 'session' | 'step') {
    return new AutoGPTRuntimeEngineLifecycleContext(scope, this);
  }

  public async dispose(): Promise<void> {
    for (const d of this.disposables) await d.dispose();
    this.disposables.clear();
    this.hooks.clear();
    this.services.clear();
  }
}

// --- AutoGPTRuntimeEngine ReAct Loop Engine ---
export class AutoGPTRuntimeEngineAgentLoopEngine {
  constructor(
    private ctx: AutoGPTRuntimeEngineLifecycleContext,
    private modelAdapter: any,
    private sandbox: any,
    private session: any,
    private config: { maxSteps: number }
  ) {}

  public async executeTask(prompt: string) {
    this.session.initRoot('You are an autonomous engineering agent.');
    this.session.appendMessage({ role: 'user', content: prompt });
    const trajectory: any[] = [];
    let stepNumber = 0;

    while (stepNumber < this.config.maxSteps) {
      stepNumber++;
      const stepCtx = this.ctx.extend('step');
      await this.ctx.emit('step:before', { stepNumber, prompt });

      const history = this.session.getLinearHistory();
      const stream = this.modelAdapter.generateStream(history, this.sandbox.getTools());
      let thought = '', text = '', pendingTools: any[] = [];

      for await (const chunk of stream) {
        if (chunk.type === 'thought_chunk') thought += chunk.deltaThought;
        if (chunk.type === 'text_chunk') text += chunk.deltaText;
        if (chunk.type === 'tool_call') pendingTools.push(chunk.toolCall);
      }

      this.session.appendMessage({ role: 'assistant', content: text, thought });
      const toolResults = [];
      for (const tc of pendingTools) {
        const res = await this.sandbox.executeToolCall(tc.id, tc.name, tc.args);
        toolResults.push(res);
        this.session.appendMessage({ role: 'tool', content: res.output });
      }

      const stepRecord = { stepNumber, thought, modelOutput: text, toolCalls: pendingTools, toolResults };
      trajectory.push(stepRecord);
      await this.ctx.emit('step:after', stepRecord);
      await stepCtx.dispose();

      if (pendingTools.length === 0) return { status: 'completed', trajectory, finalOutput: text };
    }
    return { status: 'max_steps_exceeded', trajectory };
  }
}

// --- AutoGPTRuntimeEngine Unified Model Stream Adapter ---
export interface StreamDelta {
  type: 'text_chunk' | 'thought_chunk' | 'tool_call_chunk' | 'finish';
  deltaText?: string;
  deltaThought?: string;
  toolCall?: { id: string; name?: string; deltaArgs?: string };
}

export class AutoGPTRuntimeEngineModelAdapter {
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

// --- AutoGPTRuntimeEngine Tool Sandbox & Virtual OS Engine ---
export class AutoGPTRuntimeEngineToolSandbox {
  private files = new Map<string, string>();

  public async executeToolCall(id: string, name: string, args: Record<string, any>) {
    const start = Date.now();
    let output = '', isError = false;
    try {
      if (name === 'run_shell') {
        output = `[Sandbox] Executed: ${args.command}`;
      } else if (name === 'read_file') {
        output = this.files.get(args.path) || 'FileNotFound';
      } else if (name === 'write_file') {
        this.files.set(args.path, args.content);
        output = `Wrote ${args.content.length} chars to ${args.path}`;
      }
      return { toolCallId: id, name, output: this.sanitize(output), isError, durationMs: Date.now() - start };
    } catch (err: any) {
      return { toolCallId: id, name, output: err.message, isError: true, durationMs: Date.now() - start };
    }
  }

  private sanitize(text: string): string {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }
}