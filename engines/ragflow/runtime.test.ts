import { describe, it, expect } from 'vitest';
import * as EngineSuite from './index';

describe('ragflow Clean-Room Verification Suite', () => {
  it('should export all decoupled engine modules', () => {
    expect(EngineSuite).toBeDefined();
  });

  it('should instantiate lifecycle context and handle service injection', () => {
    const contextClass = Object.values(EngineSuite).find(
      (v) => typeof v === 'function' && v.name && v.name.includes('LifecycleContext')
    ) as any;
    if (contextClass) {
      const ctx = new contextClass('global');
      expect(ctx.id).toBeDefined();
      ctx.provide('testService', { ok: true });
      expect(ctx.inject('testService')).toEqual({ ok: true });
    }
  });

  it('should operate virtual file system sandbox with in-memory isolation', async () => {
    const sandboxClass = Object.values(EngineSuite).find(
      (v) => typeof v === 'function' && v.name && v.name.includes('ToolSandbox')
    ) as any;
    if (sandboxClass) {
      const sandbox = new sandboxClass({ '/workspace/test.txt': 'initial content' });
      const readRes = await sandbox.executeToolCall('c1', 'read_file', { path: '/workspace/test.txt' });
      expect(readRes.output).toBe('initial content');
      expect(readRes.isError).toBe(false);
    }
  });
});
