import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserWindow } from 'electron';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    getAppPath: vi.fn(() => '/app'),
  },
}));

describe('WindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该创建窗口', async () => {
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    const win = manager.createWindow();

    expect(BrowserWindow).toHaveBeenCalled();
    expect(win).toBeDefined();
  });

  it('应该返回主窗口实例', async () => {
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    manager.createWindow();
    const mainWin = manager.getMainWindow();

    expect(mainWin).toBe(mockWindow);
  });
});
