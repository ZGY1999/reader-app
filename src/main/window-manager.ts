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

    // 寮€鍙戞ā寮忥細鍔犺浇Vite dev server
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5174');
    } else {
      // 鐢熶骇妯″紡锛氬姞杞芥瀯寤哄悗鐨勬枃浠?
      this.mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    }

    return this.mainWindow;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
