export interface ElectronAPI {
  importBook: (filePath: string) => Promise<any>;
  getBooks: () => Promise<any[]>;
  getBook: (id: string) => Promise<any>;
  getBookContent: (id: string) => Promise<any>;
  saveProgress: (data: any) => Promise<any>;
  getProgress: (bookId: string) => Promise<any>;

  annotations: {
    create: (data: {
      bookId: string;
      startOffset: number;
      endOffset: number;
      text: string;
      style: string;
    }) => Promise<any>;
    list: (bookId: string) => Promise<any[]>;
    delete: (id: string) => Promise<any>;
  };

  ai: {
    getStatus: () => Promise<{ configured: boolean }>;
    ask: (data: { bookId: string; question: string }) => Promise<
      | {
          success: true;
          answer: string;
          citations: Array<{
            chunkId: string;
            chapterId?: string;
            chapterTitle: string;
            text: string;
            startOffset: number;
            endOffset: number;
            score: number;
          }>;
        }
      | {
          success: false;
          code: string;
          error: string;
        }
    >;
  };

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
