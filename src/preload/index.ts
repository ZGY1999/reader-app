import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍管理
  importBook: (filePath: string) => ipcRenderer.invoke('import-book', filePath),
  getBooks: () => ipcRenderer.invoke('get-books'),
  getBook: (id: string) => ipcRenderer.invoke('get-book', id),
  saveProgress: (data: any) => ipcRenderer.invoke('save-progress', data),
  getProgress: (bookId: string) => ipcRenderer.invoke('get-progress', bookId),

  // 设置管理
  settings: {
    save: (key: string, value: string) => ipcRenderer.invoke('settings:save', key, value),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:getAll')
  },

  // TTS 服务
  tts: {
    synthesize: (options: any) => ipcRenderer.invoke('tts:synthesize', options)
  },

  // 播放器服务
  player: {
    play: (text: string, options?: any) => ipcRenderer.invoke('player:play', text, options),
    pause: () => ipcRenderer.invoke('player:pause'),
    resume: () => ipcRenderer.invoke('player:resume'),
    stop: () => ipcRenderer.invoke('player:stop'),
    getState: () => ipcRenderer.invoke('player:getState'),
    getProgress: () => ipcRenderer.invoke('player:getProgress'),
    setRate: (rate: number) => ipcRenderer.invoke('player:setRate', rate)
  },

  // 高亮服务
  highlight: {
    updateProgress: (progress: number, totalLength: number) =>
      ipcRenderer.invoke('highlight:updateProgress', progress, totalLength)
  },

  // AI 问答服务
  chat: {
    ask: (options: any) => ipcRenderer.invoke('chat:ask', options),
    stream: (options: any, onData: (chunk: string) => void, onEnd: () => void, onError: (error: string) => void) => {
      ipcRenderer.invoke('chat:stream', options);
      ipcRenderer.on('chat:stream:data', (_, chunk) => onData(chunk));
      ipcRenderer.once('chat:stream:end', () => onEnd());
      ipcRenderer.once('chat:stream:error', (_, error) => onError(error));
    }
  },

  // 向量服务
  vector: {
    addDocument: (bookId: string, chunks: any[]) => ipcRenderer.invoke('vector:addDocument', bookId, chunks)
  }
});
