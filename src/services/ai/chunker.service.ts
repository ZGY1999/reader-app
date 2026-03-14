import * as crypto from 'crypto';
import { Chapter } from '../book-parser/txt.parser';

export interface TextChunk {
  id: string;
  bookId: string;
  chapterId?: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

export class ChunkerService {
  chunkByChapter(chapters: Chapter[], bookId: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    let offset = 0;

    for (const chapter of chapters) {
      if (!chapter.content.trim()) continue;

      const startOffset = offset;
      const endOffset = offset + chapter.content.length;

      chunks.push({
        id: crypto.randomUUID(),
        bookId,
        chapterId: chapter.id,
        content: chapter.content,
        startOffset,
        endOffset
      });

      offset = endOffset;
    }

    return chunks;
  }

  chunkByParagraph(
    text: string,
    bookId: string,
    chapterId?: string,
    chunkSize: number = 500,
    overlap: number = 50
  ): TextChunk[] {
    if (chunkSize <= 0) {
      throw new Error('chunkSize must be positive');
    }
    if (overlap < 0 || overlap >= chunkSize) {
      throw new Error('overlap must be >= 0 and < chunkSize');
    }
    if (!text.trim()) return [];

    const chunks: TextChunk[] = [];
    let offset = 0;

    while (offset < text.length) {
      const endOffset = Math.min(offset + chunkSize, text.length);
      const content = text.substring(offset, endOffset);

      chunks.push({
        id: crypto.randomUUID(),
        bookId,
        chapterId,
        content,
        startOffset: offset,
        endOffset
      });

      if (endOffset === text.length) break;
      offset = endOffset - overlap;
    }

    return chunks;
  }
}
