import { randomUUID } from 'crypto';
import { Database } from '../../database/sqlite';

interface CreateThreadInput {
  bookId: string;
  chapterId?: string | null;
  chapterTitle: string;
  title: string;
}

interface AppendMessageInput {
  threadId: string;
  bookId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  sourceType?: string | null;
  sourceText?: string | null;
  chapterId?: string | null;
  chapterTitle?: string | null;
  citations?: unknown[] | null;
}

export class AIChatHandler {
  constructor(private readonly db: Database) {}

  async listThreads(bookId: string) {
    return this.db.query(
      `SELECT id, book_id AS bookId, chapter_id AS chapterId, chapter_title AS chapterTitle, title, created_at AS createdAt, updated_at AS updatedAt
       FROM ai_threads
       WHERE book_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      [bookId]
    );
  }

  async createThread(input: CreateThreadInput) {
    const timestamp = Date.now();
    const id = randomUUID();

    this.db.query(
      `INSERT INTO ai_threads (id, book_id, chapter_id, chapter_title, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.bookId, input.chapterId ?? null, input.chapterTitle, input.title, timestamp, timestamp]
    );
    this.db.save();

    return {
      id,
      bookId: input.bookId,
      chapterId: input.chapterId ?? null,
      chapterTitle: input.chapterTitle,
      title: input.title,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async listMessages(threadId: string) {
    return this.db.query(
      `SELECT id, thread_id AS threadId, book_id AS bookId, role, text, source_type AS sourceType, source_text AS sourceText,
              chapter_id AS chapterId, chapter_title AS chapterTitle, citations_json AS citationsJson, created_at AS createdAt
       FROM ai_messages
       WHERE thread_id = ?
       ORDER BY created_at ASC`,
      [threadId]
    );
  }

  async appendMessage(input: AppendMessageInput) {
    const id = randomUUID();
    const timestamp = Date.now();
    const citationsJson = input.citations ? JSON.stringify(input.citations) : null;

    this.db.query(
      `INSERT INTO ai_messages (id, thread_id, book_id, role, text, source_type, source_text, chapter_id, chapter_title, citations_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.threadId,
        input.bookId,
        input.role,
        input.text,
        input.sourceType ?? null,
        input.sourceText ?? null,
        input.chapterId ?? null,
        input.chapterTitle ?? null,
        citationsJson,
        timestamp,
      ]
    );

    this.db.query(
      `UPDATE ai_threads
       SET updated_at = ?
       WHERE id = ?`,
      [timestamp, input.threadId]
    );

    this.db.save();

    return {
      id,
      threadId: input.threadId,
      bookId: input.bookId,
      role: input.role,
      text: input.text,
      sourceType: input.sourceType ?? null,
      sourceText: input.sourceText ?? null,
      chapterId: input.chapterId ?? null,
      chapterTitle: input.chapterTitle ?? null,
      citationsJson,
      createdAt: timestamp,
    };
  }

  async touchThread(threadId: string) {
    const timestamp = Date.now();
    this.db.query(
      `UPDATE ai_threads
       SET updated_at = ?
       WHERE id = ?`,
      [timestamp, threadId]
    );
    this.db.save();

    return {
      success: true,
      updatedAt: timestamp,
    };
  }
}
