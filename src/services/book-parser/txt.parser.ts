import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as jschardet from 'jschardet';
import * as iconv from 'iconv-lite';
import { ParsedBook, ParsedChapter } from './types';

export type Chapter = ParsedChapter;
export type Book = ParsedBook;

export class TxtParser {
  async parse(filePath: string): Promise<Book> {
    const buffer = await fs.readFile(filePath);
    const detected = jschardet.detect(buffer);
    const encoding = detected.encoding || 'utf-8';
    const content = iconv.decode(buffer, encoding);

    const lines = content.split('\n');

    const title = lines[0]?.trim() || '未命名';
    const author = lines[1]?.startsWith('作者：') ? lines[1].replace('作者：', '').trim() : undefined;

    const chapters = this.extractChapters(content);

    return {
      id: crypto.randomUUID(),
      title,
      author,
      format: 'txt',
      content,
      chapters,
    };
  }

  private extractChapters(content: string): Chapter[] {
    const lines = content.split('\n');
    const chapters: Chapter[] = [];
    let currentChapter: { title: string; content: string[] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^第[一二三四五六七八九十\d]+章/.test(trimmed)) {
        if (currentChapter) {
          chapters.push({
            id: crypto.randomUUID(),
            title: currentChapter.title,
            content: currentChapter.content.join('\n').trim()
          });
        }
        currentChapter = { title: trimmed, content: [] };
      } else if (currentChapter && trimmed) {
        currentChapter.content.push(line);
      }
    }

    if (currentChapter) {
      chapters.push({
        id: crypto.randomUUID(),
        title: currentChapter.title,
        content: currentChapter.content.join('\n').trim()
      });
    }

    return chapters;
  }
}
