// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';

vi.mock('../src/utils/dynamic-import', () => ({
  default: (specifier: string) => import(specifier),
}));

describe('PdfParser', () => {
  let parserModule: typeof import('../src/services/book-parser/pdf.parser');
  let parser: import('../src/services/book-parser/pdf.parser').PdfParser;
  let tempDir: string;
  let sampleFile: string;

  beforeAll(async () => {
    parserModule = await import('../src/services/book-parser/pdf.parser');
    parser = new parserModule.PdfParser();

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-app-pdf-parser-'));
    sampleFile = path.join(tempDir, 'sample.pdf');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page1 = pdfDoc.addPage([600, 400]);
    page1.drawText('Sample Book Title', { x: 50, y: 350, size: 24, font });
    page1.drawText('Page 1 Content: This is the first page.', { x: 50, y: 300, size: 12, font });

    const page2 = pdfDoc.addPage([600, 400]);
    page2.drawText('Chapter 1 Introduction', { x: 50, y: 350, size: 20, font });
    page2.drawText('Page 2 Content: This is the second page.', { x: 50, y: 300, size: 12, font });

    const page3 = pdfDoc.addPage([600, 400]);
    page3.drawText('Chapter 2 Deep Dive', { x: 50, y: 350, size: 20, font });
    page3.drawText('Page 3 Content: This is the third page.', { x: 50, y: 300, size: 12, font });

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
    expect(book.content).toContain('Page 1 Content');
    expect(book.content).toContain('Page 2 Content');
    expect(book.content).toContain('Page 3 Content');
  });

  it('keeps one chapter per page for continuous rendering', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters).toBeDefined();
    expect(book.chapters.length).toBe(3);
    expect(book.chapters[0].title).toBe('Page 1');
    expect(book.chapters[1].title).toBe('Page 2');
    expect(book.chapters[2].title).toBe('Page 3');
  });

  it('assigns heuristic toc titles to heading-like pages', async () => {
    const book = await parser.parse(sampleFile);

    expect(book.chapters[1].tocTitle).toBe('Chapter 1 Introduction');
    expect(book.chapters[2].tocTitle).toBe('Chapter 2 Deep Dive');
  });

  it('applies outline entries onto existing page chapters', () => {
    const chapters = [
      {
        id: 'page-1',
        title: 'Page 1',
        pageNumber: 1,
        content: 'Page 1',
      },
      {
        id: 'page-2',
        title: 'Page 2',
        pageNumber: 2,
        content: 'Page 2',
      },
    ];

    const result = parserModule.applyPdfTocEntries(chapters, [
      { pageNumber: 2, title: 'Chapter 1', level: 1 },
    ]);

    expect(result[0].tocTitle).toBeUndefined();
    expect(result[1].tocTitle).toBe('Chapter 1');
  });
});
