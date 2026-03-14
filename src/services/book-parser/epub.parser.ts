import ePub from 'epubjs';
import * as crypto from 'crypto';

export interface Chapter {
  id: string;
  title: string;
  content: string;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  content: string;
  chapters?: Chapter[];
}

export class EpubParser {
  async parse(filePath: string): Promise<Book> {
    const book = ePub(filePath);
    await book.ready;

    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;

    const chapters = await this.extractChapters(book, navigation);
    const content = chapters.map(c => c.content).join('\n\n');

    return {
      id: crypto.randomUUID(),
      title: metadata.title || '未命名',
      author: metadata.creator,
      content,
      chapters
    };
  }

  private async extractChapters(book: any, navigation: any): Promise<Chapter[]> {
    const chapters: Chapter[] = [];
    const toc = navigation.toc;

    for (const item of toc) {
      const section = book.spine.get(item.href);
      if (section) {
        await section.load(book.load.bind(book));
        const doc = section.document;
        const text = doc.body?.textContent || '';

        chapters.push({
          id: crypto.randomUUID(),
          title: item.label,
          content: text.trim()
        });
      }
    }

    return chapters;
  }
}
