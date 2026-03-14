import { Database } from '../sqlite';

export interface AnnotationData {
  id: string;
  bookId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  style: string;
}

export class AnnotationRepository {
  constructor(private db: Database) {}

  add(annotation: AnnotationData): void {
    this.db.query(
      'INSERT INTO annotations (id, book_id, start_offset, end_offset, text, style, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [annotation.id, annotation.bookId, annotation.startOffset, annotation.endOffset, annotation.text, annotation.style, Date.now()]
    );
    this.db.save();
  }

  findById(id: string): AnnotationData | undefined {
    const results = this.db.query('SELECT * FROM annotations WHERE id = ?', [id]);
    if (results.length === 0) return undefined;
    const row = results[0];
    return {
      id: row.id,
      bookId: row.book_id,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      text: row.text,
      style: row.style
    };
  }

  findByBookId(bookId: string): AnnotationData[] {
    const results = this.db.query('SELECT * FROM annotations WHERE book_id = ? ORDER BY start_offset', [bookId]);
    return results.map(row => ({
      id: row.id,
      bookId: row.book_id,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      text: row.text,
      style: row.style
    }));
  }

  delete(id: string): void {
    this.db.query('DELETE FROM annotations WHERE id = ?', [id]);
    this.db.save();
  }
}
