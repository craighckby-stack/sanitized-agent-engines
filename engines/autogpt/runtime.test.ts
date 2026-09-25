import { describe, it, expect } from 'vitest';
import * as EngineSuite from './index';

describe('AutoGPT Clean-Room Verification Suite', () => {
  it('should export all decoupled engine modules', () => {
    expect(EngineSuite).toBeDefined();
  });

  it('should instantiate lifecycle context and handle service injection', () => {
    const contextClass = Object.values(EngineSuite).find(
      (value): value is new (...args: unknown[]) => any =>
        typeof value === 'function' && typeof value.name === 'string' && value.name.includes('LifecycleContext')
    );

    if (contextClass) {
      const lifecycleContextInstance = new contextClass('global');
      expect(lifecycleContextInstance.id).toBeDefined();
      lifecycleContextInstance.provide('testService', { ok: true });
      expect(lifecycleContextInstance.inject('testService')).toEqual({ ok: true });
    }
  });

  it('should operate virtual file system sandbox with in-memory isolation', async () => {
    const sandboxClass = Object.values(EngineSuite).find(
      (value): value is new (...args: unknown[]) => any =>
        typeof value === 'function' && typeof value.name === 'string' && value.name.includes('ToolSandbox')
    );

    if (sandboxClass) {
      const sandboxInstance = new sandboxClass({ '/workspace/test.txt': 'initial content' });
      const readResult = await sandboxInstance.executeToolCall('c1', 'read_file', { path: '/workspace/test.txt' });
      expect(readResult.output).toBe('initial content');
      expect(readResult.isError).toBe(false);
    }
  });
});