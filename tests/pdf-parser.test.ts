import { describe, it, expect, beforeAll } from 'vitest';
import { PdfParser } from '../src/services/book-parser/pdf.parser';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';

describe('PdfParser', () => {
  const parser = new PdfParser();
  const sampleFile = path.join(__dirname, 'fixtures', 'sample.pdf');

  beforeAll(async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page1 = pdfDoc.addPage([600, 400]);
    page1.drawText('Sample Book Title', { x: 50, y: 350, size: 20, font });
    page1.drawText('Page 1 Content: This is the first page.', { x: 50, y: 300, size: 12, font });

    const page2 = pdfDoc.addPage([600, 400]);
    page2.drawText('Page 2 Content: This is the second page.', { x: 50, y: 350, size: 12, font });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(sampleFile, pdfBytes);
  });

  it('应该解析 PDF 文件', async () => {
    const book = await parser.parse(sampleFile);
    expect(book).toBeDefined();
    expect(book.content).toBeTruthy();
  });

  it('应该提取书籍元数据', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.title).toBeTruthy();
  });

  it('应该逐页提取文本', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.content.length).toBeGreaterThan(0);
  });

  it('应该保留页码信息', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters).toBeDefined();
    expect(book.chapters!.length).toBeGreaterThan(0);
  });
});
