import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  importBook: (filePath: string) => ipcRenderer.invoke('import-book', filePath),
  getBooks: () => ipcRenderer.invoke('get-books'),
  getBook: (id: string) => ipcRenderer.invoke('get-book', id),
  saveProgress: (data: any) => ipcRenderer.invoke('save-progress', data),
  getProgress: (bookId: string) => ipcRenderer.invoke('get-progress', bookId)
});
