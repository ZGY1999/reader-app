import { BrowserWindow } from 'electron';
import * as path from 'path';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  createWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    // 开发模式：加载Vite dev server
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5174');
    } else {
      // 生产模式：加载构建后的文件
      this.mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
