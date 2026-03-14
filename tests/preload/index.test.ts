import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
  },
}));

describe('Preload', () => {
  it('应该通过 contextBridge 暴露 API', async () => {
    const { contextBridge } = await import('electron');
    await import('../../src/preload/index');

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.any(Object)
    );
  });
});
