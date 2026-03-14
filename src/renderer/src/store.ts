import { create } from 'zustand';
import { Book } from './types';

interface BookStore {
  books: Book[];
  currentBook: Book | null;
  setBooks: (books: Book[]) => void;
  setCurrentBook: (book: Book) => void;
}

export const useBookStore = create<BookStore>((set) => ({
  books: [],
  currentBook: null,
  setBooks: (books) => set({ books }),
  setCurrentBook: (book) => set({ currentBook: book }),
}));
