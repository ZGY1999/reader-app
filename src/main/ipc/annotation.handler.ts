import { Database } from '../../database/sqlite';
import { AnnotationRepository } from '../../database/repositories/annotation.repository';
import { randomUUID } from 'crypto';

export class AnnotationHandler {
  private repo: AnnotationRepository;

  constructor(db: Database) {
    this.repo = new AnnotationRepository(db);
  }

  async createAnnotation(data: { bookId: string; startOffset: number; endOffset: number; text: string; style: string }) {
    try {
      const annotation = {
        id: randomUUID(),
        ...data
      };
      this.repo.add(annotation);
      return { success: true, annotation };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getAnnotations(bookId: string) {
    return this.repo.findByBookId(bookId);
  }

  async deleteAnnotation(id: string) {
    try {
      this.repo.delete(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
