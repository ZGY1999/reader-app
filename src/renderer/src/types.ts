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
}

export interface Annotation {
  id: string;
  bookId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  style: string;
}

export interface ReadingPayload {
  book: Book;
  content: string;
  chapters: Chapter[];
}
