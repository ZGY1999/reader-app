export interface ElectronAPI {
  importBook: (filePath: string) => Promise<any>;
  getBooks: () => Promise<any[]>;
  getBook: (id: string) => Promise<any>;
  getBookContent: (id: string) => Promise<any>;
  saveProgress: (data: any) => Promise<any>;
  getProgress: (bookId: string) => Promise<any>;

  settings: {
    save: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    getAll: () => Promise<Record<string, string>>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
