import { create } from 'zustand';
import { Book, ReadingPayload } from './types';

interface BookStore {
  books: Book[];
  currentBook: Book | null;
  reading: ReadingPayload | null;
  setBooks: (books: Book[]) => void;
  setCurrentBook: (book: Book) => void;
  setReading: (reading: ReadingPayload | null) => void;
}

export const useBookStore = create<BookStore>((set) => ({
  books: [],
  currentBook: null,
  reading: null,
  setBooks: (books) => set({ books }),
  setCurrentBook: (book) => set({ currentBook: book }),
  setReading: (reading) => set({ reading }),
}));
