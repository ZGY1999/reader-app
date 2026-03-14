import { app, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { Database } from '../database/sqlite';
import { BookHandler } from './ipc/book.handler';
import { SettingsHandler } from './ipc/settings.handler';
import { TTSService } from '../services/tts/tts.service';
import { PlayerService } from '../services/tts/player.service';
import { HighlightService } from '../services/tts/highlight.service';
import { ChatService } from '../services/ai/chat.service';
import { VectorService } from '../services/ai/vector.service';
import * as path from 'path';

const windowManager = new WindowManager();
const dbPath = path.join(app.getPath('userData'), 'reader.db');
const db = new Database(dbPath);
let bookHandler: BookHandler;
let settingsHandler: SettingsHandler;

// 服务实例
const ttsService = new TTSService();
const playerService = new PlayerService(ttsService);
const highlightService = new HighlightService();
let chatService: ChatService;
let vectorService: VectorService;

app.whenReady().then(async () => {
  await db.init();
  db.initialize();
  bookHandler = new BookHandler(db);
  settingsHandler = new SettingsHandler(db);

  // 初始化 AI 服务
  const apiKey = process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  vectorService = new VectorService(apiKey, baseURL);
  chatService = new ChatService(apiKey, baseURL, vectorService);

  // 书籍管理
  ipcMain.handle('import-book', async (_, filePath: string) => bookHandler.importBook(filePath));
  ipcMain.handle('get-books', async () => bookHandler.getBooks());
  ipcMain.handle('get-book', async (_, id: string) => bookHandler.getBook(id));
  ipcMain.handle('get-book-content', async (_, id: string) => bookHandler.getBookContent(id));
  ipcMain.handle('save-progress', async (_, data) => bookHandler.saveProgress(data.bookId, data.chapterId, data.offset, data.progress));
  ipcMain.handle('get-progress', async (_, bookId: string) => bookHandler.getProgress(bookId));

  // 设置管理
  ipcMain.handle('settings:save', async (_, key: string, value: string) => settingsHandler.saveSetting(key, value));
  ipcMain.handle('settings:get', async (_, key: string) => settingsHandler.getSetting(key));
  ipcMain.handle('settings:getAll', async () => settingsHandler.getAllSettings());

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

  // AI 问答服务
  ipcMain.handle('chat:ask', async (_, options) => {
    try {
      return await chatService.chat(options);
    } catch (error: any) {
      throw new Error(error.message);
    }
  });

  ipcMain.handle('chat:stream', async (event, options) => {
    try {
      for await (const chunk of chatService.chatStream(options)) {
        event.sender.send('chat:stream:data', chunk);
      }
      event.sender.send('chat:stream:end');
    } catch (error: any) {
      event.sender.send('chat:stream:error', error.message);
    }
  });

  // 向量服务
  ipcMain.handle('vector:addDocument', async (_, bookId: string, chunks: any[]) => {
    await vectorService.addDocument(bookId, chunks);
  });

  windowManager.createWindow();
});

app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
