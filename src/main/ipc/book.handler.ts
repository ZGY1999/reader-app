import { Database } from '../../database/sqlite';
import { BookRepository } from '../../database/repositories/book.repository';
import { ProgressRepository } from '../../database/repositories/progress.repository';
import { TxtParser } from '../../services/book-parser/txt.parser';
import { EpubParser } from '../../services/book-parser/epub.parser';
import { PdfParser } from '../../services/book-parser/pdf.parser';
import { extname } from 'path';
import { ParsedBook } from '../../services/book-parser/types';

export class BookHandler {
  private bookRepo: BookRepository;
  private progressRepo: ProgressRepository;
  private txtParser: TxtParser;
  private epubParser: EpubParser;
  private pdfParser: PdfParser;

  constructor(db: Database) {
    this.bookRepo = new BookRepository(db);
    this.progressRepo = new ProgressRepository(db);
    this.txtParser = new TxtParser();
    this.epubParser = new EpubParser();
    this.pdfParser = new PdfParser();
  }

  async importBook(filePath: string) {
    try {
      const book = await this.parseByFilePath(filePath);
      this.bookRepo.add({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        filePath,
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

    const parsed = await this.parseByFormat(book.format, book.filePath);
    return { content: parsed.content, chapters: parsed.chapters };
  }

  async saveProgress(bookId: string, chapterId: string, offset: number, progress: number) {
    this.progressRepo.save({ bookId, chapterId, offset, progress });
    return { success: true };
  }

  async getProgress(bookId: string) {
    return this.progressRepo.get(bookId);
  }

  private async parseByFilePath(filePath: string): Promise<ParsedBook> {
    const extension = extname(filePath).toLowerCase();

    switch (extension) {
      case '.txt':
        return this.txtParser.parse(filePath);
      case '.epub':
        return this.epubParser.parse(filePath);
      case '.pdf':
        return this.pdfParser.parse(filePath);
      default:
        throw new Error('Unsupported book format');
    }
  }

  private async parseByFormat(format: string, filePath: string): Promise<ParsedBook> {
    switch (format) {
      case 'txt':
        return this.txtParser.parse(filePath);
      case 'epub':
        return this.epubParser.parse(filePath);
      case 'pdf':
        return this.pdfParser.parse(filePath);
      default:
        throw new Error('Unsupported book format');
    }
  }
}
