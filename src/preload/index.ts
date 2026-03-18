import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  importBook: (filePath: string) => ipcRenderer.invoke('import-book', filePath),
  deleteBook: (id: string) => ipcRenderer.invoke('delete-book', id),
  getBooks: () => ipcRenderer.invoke('get-books'),
  getBook: (id: string) => ipcRenderer.invoke('get-book', id),
  getBookContent: (id: string) => ipcRenderer.invoke('get-book-content', id),
  saveProgress: (data: any) => ipcRenderer.invoke('save-progress', data),
  getProgress: (bookId: string) => ipcRenderer.invoke('get-progress', bookId),
  runtime: {
    getPdfJsConfig: () => ipcRenderer.invoke('runtime:getPdfJsConfig'),
  },
  annotations: {
    create: (data: any) => ipcRenderer.invoke('annotations:create', data),
    list: (bookId: string) => ipcRenderer.invoke('annotations:list', bookId),
    delete: (id: string) => ipcRenderer.invoke('annotations:delete', id),
  },
  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    ask: (data: { bookId: string; question: string }) => ipcRenderer.invoke('ai:ask', data),
  },
  aiChat: {
    listThreads: (bookId: string) => ipcRenderer.invoke('ai-chat:listThreads', bookId),
    createThread: (data: any) => ipcRenderer.invoke('ai-chat:createThread', data),
    listMessages: (threadId: string) => ipcRenderer.invoke('ai-chat:listMessages', threadId),
    appendMessage: (data: any) => ipcRenderer.invoke('ai-chat:appendMessage', data),
    touchThread: (threadId: string) => ipcRenderer.invoke('ai-chat:touchThread', threadId),
  },
  tts: {
    synthesize: (data: { text: string; voice?: string; rate?: number }) => ipcRenderer.invoke('tts:synthesize', data),
  },

  settings: {
    save: (key: string, value: string) => ipcRenderer.invoke('settings:save', key, value),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
});
