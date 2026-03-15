import { describe, expect, it, vi } from 'vitest';

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
  it('exposes the renderer API through contextBridge', async () => {
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
        annotations: expect.objectContaining({
          create: expect.any(Function),
          list: expect.any(Function),
          delete: expect.any(Function),
        }),
        ai: expect.objectContaining({
          getStatus: expect.any(Function),
          ask: expect.any(Function),
        }),
        settings: expect.objectContaining({
          save: expect.any(Function),
          get: expect.any(Function),
          getAll: expect.any(Function),
        }),
      })
    );
  });

  it('only exposes the stable v0.2 renderer surface', async () => {
    const { contextBridge } = await import('electron');
    await import('../../src/preload/index');

    const exposedAPI = vi.mocked(contextBridge.exposeInMainWorld).mock.calls[0][1] as Record<string, unknown>;

    expect(Object.keys(exposedAPI).sort()).toEqual([
      'ai',
      'annotations',
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
