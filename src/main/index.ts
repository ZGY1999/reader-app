import { app, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { Database } from '../database/sqlite';
import { BookHandler } from './ipc/book.handler';
import { SettingsHandler } from './ipc/settings.handler';
import * as path from 'path';

const windowManager = new WindowManager();
const dbPath = path.join(app.getPath('userData'), 'reader.db');
const db = new Database(dbPath);
let bookHandler: BookHandler;
let settingsHandler: SettingsHandler;

app.whenReady().then(async () => {
  await db.init();
  db.initialize();
  bookHandler = new BookHandler(db);
  settingsHandler = new SettingsHandler(db);

  ipcMain.handle('import-book', async (_, filePath: string) => bookHandler.importBook(filePath));
  ipcMain.handle('get-books', async () => bookHandler.getBooks());
  ipcMain.handle('get-book', async (_, id: string) => bookHandler.getBook(id));
  ipcMain.handle('save-progress', async (_, data) => bookHandler.saveProgress(data.bookId, data.chapterId, data.offset, data.progress));
  ipcMain.handle('get-progress', async (_, bookId: string) => bookHandler.getProgress(bookId));

  ipcMain.handle('settings:save', async (_, key: string, value: string) => settingsHandler.saveSetting(key, value));
  ipcMain.handle('settings:get', async (_, key: string) => settingsHandler.getSetting(key));
  ipcMain.handle('settings:getAll', async () => settingsHandler.getAllSettings());

  windowManager.createWindow();
});

app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
