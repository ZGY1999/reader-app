import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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

export class PdfParser {
  async parse(filePath: string): Promise<Book> {
    const buffer = await fs.readFile(filePath);
    const data = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const metadata = await pdf.getMetadata();
    const info = metadata.info as any;
    const title = info?.Title || '未命名';
    const author = info?.Author;

    let fullContent = '';
    const chapters: Chapter[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      fullContent += pageText + '\n';

      chapters.push({
        id: crypto.randomUUID(),
        title: `第 ${i} 页`,
        content: pageText
      });
    }

    return {
      id: crypto.randomUUID(),
      title,
      author,
      content: fullContent.trim(),
      chapters
    };
  }
}
