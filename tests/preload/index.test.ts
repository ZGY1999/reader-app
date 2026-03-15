import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

describe('Preload', () => {
  it('应该通过 contextBridge 暴露 API', async () => {
    const { contextBridge } = await import('electron');
    await import('../../src/preload/index');

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        importBook: expect.any(Function),
        getBooks: expect.any(Function),
        getBook: expect.any(Function),
        getBookContent: expect.any(Function),
        saveProgress: expect.any(Function),
        getProgress: expect.any(Function),
        settings: expect.objectContaining({
          save: expect.any(Function),
          get: expect.any(Function),
          getAll: expect.any(Function),
        }),
      })
    );
  });

  it('应该只暴露 v0.1 所需的稳定 API', async () => {
    const { contextBridge } = await import('electron');
    await import('../../src/preload/index');

    const exposedAPI = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0][1] as Record<string, unknown>;

    expect(Object.keys(exposedAPI).sort()).toEqual([
      'getBook',
      'getBookContent',
      'getBooks',
      'getProgress',
      'importBook',
      'saveProgress',
      'settings',
    ]);
  });
});
