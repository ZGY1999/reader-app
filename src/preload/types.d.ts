export interface ElectronAPI {
  importBook: (filePath: string) => Promise<any>;
  getBooks: () => Promise<any[]>;
  getBook: (id: string) => Promise<any>;
  saveProgress: (data: any) => Promise<any>;
  getProgress: (bookId: string) => Promise<any>;

  settings: {
    save: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    getAll: () => Promise<Record<string, string>>;
  };

  tts: {
    synthesize: (options: any) => Promise<Buffer>;
  };

  player: {
    play: (text: string, options?: any) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    getState: () => Promise<string>;
    getProgress: () => Promise<number>;
    setRate: (rate: number) => Promise<void>;
  };

  highlight: {
    updateProgress: (progress: number, totalLength: number) => Promise<any>;
  };

  chat: {
    ask: (options: any) => Promise<string>;
    stream: (options: any, onData: (chunk: string) => void, onEnd: () => void, onError: (error: string) => void) => void;
  };

  vector: {
    addDocument: (bookId: string, chunks: any[]) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
