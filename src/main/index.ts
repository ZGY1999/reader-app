import { app, ipcMain } from 'electron';
import { WindowManager } from './window-manager';
import { Database } from '../database/sqlite';
import { BookHandler } from './ipc/book.handler';
import { AnnotationHandler } from './ipc/annotation.handler';
import { SettingsHandler } from './ipc/settings.handler';
import { AIHandler } from './ipc/ai.handler';
import { AIChatHandler } from './ipc/ai-chat.handler';
import { TTSService } from '../services/tts/tts.service';
import * as path from 'path';
import { pathToFileURL } from 'url';

const windowManager = new WindowManager();
const dbPath = path.join(app.getPath('userData'), 'reader.db');
const db = new Database(dbPath);
let bookHandler: BookHandler;
let annotationHandler: AnnotationHandler;
let settingsHandler: SettingsHandler;
let aiHandler: AIHandler;
let aiChatHandler: AIChatHandler;

// 服务实例
const ttsService = new TTSService();

app.whenReady().then(async () => {
  await db.init();
  db.initialize();
  bookHandler = new BookHandler(db);
  annotationHandler = new AnnotationHandler(db);
  settingsHandler = new SettingsHandler(db);
  aiHandler = new AIHandler(bookHandler, settingsHandler);
  aiChatHandler = new AIChatHandler(db);

  // 书籍管理
  ipcMain.handle('import-book', async (_, filePath: string) => bookHandler.importBook(filePath));
  ipcMain.handle('delete-book', async (_, id: string) => bookHandler.deleteBook(id));
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
  ipcMain.handle('runtime:getPdfJsConfig', async () => {
    const appPath = app.getAppPath();
    const modulePath = path.join(appPath, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
    const workerPath = path.join(appPath, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
    const standardFontDir = path.join(appPath, 'node_modules', 'pdfjs-dist', 'standard_fonts');

    return {
      moduleUrl: pathToFileURL(modulePath).href,
      workerUrl: pathToFileURL(workerPath).href,
      standardFontDataUrl: `${pathToFileURL(standardFontDir).href}/`,
    };
  });

  ipcMain.handle('ai:getStatus', async () => aiHandler.getStatus());
  ipcMain.handle('ai:ask', async (_, options) => aiHandler.ask(options));
  ipcMain.handle('ai-chat:listThreads', async (_, bookId: string) => aiChatHandler.listThreads(bookId));
  ipcMain.handle('ai-chat:createThread', async (_, data) => aiChatHandler.createThread(data));
  ipcMain.handle('ai-chat:listMessages', async (_, threadId: string) => aiChatHandler.listMessages(threadId));
  ipcMain.handle('ai-chat:appendMessage', async (_, data) => aiChatHandler.appendMessage(data));
  ipcMain.handle('ai-chat:touchThread', async (_, threadId: string) => aiChatHandler.touchThread(threadId));

  // TTS 服务
  ipcMain.handle('tts:synthesize', async (_, options) => {
    try {
      return await ttsService.synthesize(options);
    } catch (error: any) {
      throw new Error(error.message);
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
