import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import * as path from 'path';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  app: {
    getAppPath: vi.fn(() => '/app'),
  },
}));

describe('WindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  it('creates a browser window', async () => {
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    const win = manager.createWindow();

    expect(BrowserWindow).toHaveBeenCalled();
    expect(win).toBeDefined();
  });

  it('returns the main window instance', async () => {
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    manager.createWindow();
    const mainWin = manager.getMainWindow();

    expect(mainWin).toBe(mockWindow);
  });

  it('loads the fixed Vite dev server URL in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    manager.createWindow();

    expect(mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:5174');
    expect(mockWindow.loadFile).not.toHaveBeenCalled();
  });

  it('loads the compiled renderer html from dist/renderer in production mode', async () => {
    const { WindowManager } = await import('../../src/main/window-manager');
    const manager = new WindowManager();

    const mockWindow = {
      loadFile: vi.fn(),
      loadURL: vi.fn(),
      on: vi.fn(),
    };
    (BrowserWindow as any).mockImplementation(() => mockWindow);

    manager.createWindow();

    expect(mockWindow.loadFile).toHaveBeenCalledWith(expect.stringContaining(path.join('dist', 'renderer', 'index.html')));
    expect(mockWindow.loadURL).not.toHaveBeenCalled();
  });
});
