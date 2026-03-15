import { app, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { Database } from '../database/sqlite';
import { BookHandler } from './ipc/book.handler';
import { AnnotationHandler } from './ipc/annotation.handler';
import { SettingsHandler } from './ipc/settings.handler';
import { AIHandler } from './ipc/ai.handler';
import { TTSService } from '../services/tts/tts.service';
import { PlayerService } from '../services/tts/player.service';
import { HighlightService } from '../services/tts/highlight.service';
import * as path from 'path';

const windowManager = new WindowManager();
const dbPath = path.join(app.getPath('userData'), 'reader.db');
const db = new Database(dbPath);
let bookHandler: BookHandler;
let annotationHandler: AnnotationHandler;
let settingsHandler: SettingsHandler;
let aiHandler: AIHandler;

// 服务实例
const ttsService = new TTSService();
const playerService = new PlayerService(ttsService);
const highlightService = new HighlightService();

app.whenReady().then(async () => {
  await db.init();
  db.initialize();
  bookHandler = new BookHandler(db);
  annotationHandler = new AnnotationHandler(db);
  settingsHandler = new SettingsHandler(db);
  aiHandler = new AIHandler(bookHandler, settingsHandler);

  // 书籍管理
  ipcMain.handle('import-book', async (_, filePath: string) => bookHandler.importBook(filePath));
  ipcMain.handle('get-books', async () => bookHandler.getBooks());
  ipcMain.handle('get-book', async (_, id: string) => bookHandler.getBook(id));
  ipcMain.handle('get-book-content', async (_, id: string) => bookHandler.getBookContent(id));
  ipcMain.handle('save-progress', async (_, data) => bookHandler.saveProgress(data.bookId, data.chapterId, data.offset, data.progress));
  ipcMain.handle('get-progress', async (_, bookId: string) => bookHandler.getProgress(bookId));
  ipcMain.handle('annotations:create', async (_, data) => annotationHandler.createAnnotation(data));
  ipcMain.handle('annotations:list', async (_, bookId: string) => annotationHandler.getAnnotations(bookId));
  ipcMain.handle('annotations:delete', async (_, id: string) => annotationHandler.deleteAnnotation(id));

  // 设置管理
  ipcMain.handle('settings:save', async (_, key: string, value: string) => settingsHandler.saveSetting(key, value));
  ipcMain.handle('settings:get', async (_, key: string) => settingsHandler.getSetting(key));
  ipcMain.handle('settings:getAll', async () => settingsHandler.getAllSettings());

  ipcMain.handle('ai:getStatus', async () => aiHandler.getStatus());
  ipcMain.handle('ai:ask', async (_, options) => aiHandler.ask(options));

  // TTS 服务
  ipcMain.handle('tts:synthesize', async (_, options) => {
    try {
      return await ttsService.synthesize(options);
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

  // 播放器服务
  ipcMain.handle('player:play', async (_, text: string, options?: any) => {
    try {
      return await playerService.play(text, options);
    } catch (error: any) {
      console.error('Player play error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:pause', () => {
    try {
      return playerService.pause();
    } catch (error: any) {
      console.error('Player pause error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:resume', () => {
    try {
      return playerService.resume();
    } catch (error: any) {
      console.error('Player resume error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:stop', () => {
    try {
      return playerService.stop();
    } catch (error: any) {
      console.error('Player stop error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:getState', () => {
    try {
      return playerService.getState();
    } catch (error: any) {
      console.error('Player getState error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:getProgress', () => {
    try {
      return playerService.getProgress();
    } catch (error: any) {
      console.error('Player getProgress error:', error);
      throw error;
    }
  });
  ipcMain.handle('player:setRate', (_, rate: number) => {
    try {
      return playerService.setRate(rate);
    } catch (error: any) {
      console.error('Player setRate error:', error);
      throw error;
    }
  });

  // 高亮服务
  ipcMain.handle('highlight:updateProgress', (_, progress: number, totalLength: number) => {
    try {
      return highlightService.updateProgress(progress, totalLength);
    } catch (error: any) {
      console.error('Highlight updateProgress error:', error);
      throw error;
    }
  });

  windowManager.createWindow();
});

app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
