import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ParsedBook, ParsedChapter } from './types';

export type Chapter = ParsedChapter;
export type Book = ParsedBook;

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
      format: 'pdf',
      content: fullContent.trim(),
      chapters,
    };
  }
}
