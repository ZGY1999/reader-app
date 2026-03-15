import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PdfParser } from '../src/services/book-parser/pdf.parser';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';

describe('PdfParser', () => {
  const parser = new PdfParser();
  let tempDir: string;
  let sampleFile: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-app-pdf-parser-'));
    sampleFile = path.join(tempDir, 'sample.pdf');

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

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('parses a PDF file', async () => {
    const book = await parser.parse(sampleFile);
    expect(book).toBeDefined();
    expect(book.content).toBeTruthy();
    expect(book.format).toBe('pdf');
    expect(Array.isArray(book.chapters)).toBe(true);
  });

  it('extracts book metadata', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.title).toBeTruthy();
  });

  it('extracts text page by page', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.content.length).toBeGreaterThan(0);
  });

  it('preserves page markers in chapters', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters).toBeDefined();
    expect(book.chapters!.length).toBeGreaterThan(0);
  });
});
