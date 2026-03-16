// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';

vi.mock('../src/utils/dynamic-import', () => ({
  default: (specifier: string) => import(specifier),
}));

describe('PdfParser electron compatibility', () => {
  let tempDir: string;
  let sampleFile: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-app-pdf-electron-compat-'));
    sampleFile = path.join(tempDir, 'sample.pdf');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('Electron compatibility sample', { x: 50, y: 300, size: 18, font });

    await fs.writeFile(sampleFile, await pdfDoc.save());
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('parses pdf files even when process.getBuiltinModule is unavailable', async () => {
    const originalGetBuiltinModule = process.getBuiltinModule;
    vi.resetModules();

    try {
      Object.defineProperty(process, 'getBuiltinModule', {
        configurable: true,
        writable: true,
        value: undefined,
      });

      const { PdfParser } = await import('../src/services/book-parser/pdf.parser');
      const parser = new PdfParser();
      const book = await parser.parse(sampleFile);

      expect(book.content).toContain('Electron compatibility sample');
    } finally {
      Object.defineProperty(process, 'getBuiltinModule', {
        configurable: true,
        writable: true,
        value: originalGetBuiltinModule,
      });
    }
  });
});
