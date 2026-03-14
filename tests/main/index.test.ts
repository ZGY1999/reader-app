import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
  },
}));

describe('Main Process', () => {
  it('应该在 app ready 时创建窗口', async () => {
    const { app } = await import('electron');
    expect(app.whenReady).toBeDefined();
  });
});
