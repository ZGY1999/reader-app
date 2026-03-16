import { Database } from '../sqlite';

export interface BookData {
  id: string;
  title: string;
  author?: string;
  format: string;
  filePath: string;
}

export class BookRepository {
  constructor(private db: Database) {}

  add(book: BookData): void {
    this.db.query(
      'INSERT INTO books (id, title, author, format, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [book.id, book.title, book.author || null, book.format, book.filePath, Date.now()]
    );
    this.db.save();
  }

  findById(id: string): BookData | undefined {
    const results = this.db.query('SELECT * FROM books WHERE id = ?', [id]);
    if (results.length === 0) return undefined;
    const row = results[0];
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      format: row.format,
      filePath: row.file_path
    };
  }

  findAll(): BookData[] {
    const results = this.db.query('SELECT * FROM books ORDER BY created_at DESC');
    return results.map(row => ({
      id: row.id,
      title: row.title,
      author: row.author,
      format: row.format,
      filePath: row.file_path
    }));
  }

  delete(id: string): void {
    this.db.query('DELETE FROM books WHERE id = ?', [id]);
    this.db.save();
  }
}
