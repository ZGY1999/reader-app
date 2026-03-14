import { Database } from '../sqlite';

export interface ProgressData {
  bookId: string;
  chapterId?: string;
  offset: number;
  progress: number;
}

export class ProgressRepository {
  constructor(private db: Database) {}

  save(data: ProgressData): void {
    this.db.query(
      'INSERT OR REPLACE INTO reading_progress (book_id, chapter_id, offset, progress, updated_at) VALUES (?, ?, ?, ?, ?)',
      [data.bookId, data.chapterId || null, data.offset, data.progress, Date.now()]
    );
    this.db.save();
  }

  get(bookId: string): ProgressData | undefined {
    const results = this.db.query('SELECT * FROM reading_progress WHERE book_id = ?', [bookId]);
    if (results.length === 0) return undefined;
    const row = results[0];
    return {
      bookId: row.book_id,
      chapterId: row.chapter_id,
      offset: row.offset,
      progress: row.progress
    };
  }
}
