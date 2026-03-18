export interface Book {
  id: string;
  title: string;
  author?: string;
  format: 'txt' | 'epub' | 'pdf';
  filePath: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  markup?: string;
  pageNumber?: number;
  tocTitle?: string;
}

export interface Annotation {
  id: string;
  bookId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  style: string;
}

export interface AICitation {
  chunkId: string;
  chapterId?: string;
  chapterTitle: string;
  text: string;
  startOffset: number;
  endOffset: number;
  score: number;
}

export interface AIChatThread {
  id: string;
  bookId: string;
  chapterId: string | null;
  chapterTitle: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AIChatStoredMessage {
  id: string;
  threadId: string;
  bookId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  sourceType: string | null;
  sourceText: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  citationsJson: string | null;
  createdAt: number;
}

export interface AIChatMessage {
  id: string;
  threadId: string;
  bookId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  sourceType: string | null;
  sourceText: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  citations: AICitation[];
  createdAt: number;
}

export interface ReadingPayload {
  book: Book;
  content: string;
  chapters: Chapter[];
  pdfData?: Uint8Array;
}
