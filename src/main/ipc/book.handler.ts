import { Database } from '../../database/sqlite';
import { BookRepository } from '../../database/repositories/book.repository';
import { ProgressRepository } from '../../database/repositories/progress.repository';
import { TxtParser } from '../../services/book-parser/txt.parser';

export class BookHandler {
  private bookRepo: BookRepository;
  private progressRepo: ProgressRepository;
  private txtParser: TxtParser;

  constructor(db: Database) {
    this.bookRepo = new BookRepository(db);
    this.progressRepo = new ProgressRepository(db);
    this.txtParser = new TxtParser();
  }

  async importBook(filePath: string) {
    try {
      const book = await this.txtParser.parse(filePath);
      this.bookRepo.add({
        id: book.id,
        title: book.title,
        author: book.author,
        format: 'txt',
        filePath
      });
      return { success: true, book };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getBooks() {
    return this.bookRepo.findAll();
  }

  async getBook(id: string) {
    return this.bookRepo.findById(id);
  }

  async getBookContent(id: string) {
    const book = this.bookRepo.findById(id);
    if (!book) throw new Error('Book not found');

    const parsed = await this.txtParser.parse(book.filePath);
    return { content: parsed.content, chapters: parsed.chapters };
  }

  async saveProgress(bookId: string, chapterId: string, offset: number, progress: number) {
    this.progressRepo.save({ bookId, chapterId, offset, progress });
    return { success: true };
  }

  async getProgress(bookId: string) {
    return this.progressRepo.get(bookId);
  }
}
