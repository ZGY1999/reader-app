import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

async function createSamplePDF() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([600, 400]);
  page1.drawText('Sample Book Title', { x: 50, y: 350, size: 20, font });
  page1.drawText('Page 1 Content: This is the first page.', { x: 50, y: 300, size: 12, font });

  const page2 = pdfDoc.addPage([600, 400]);
  page2.drawText('Page 2 Content: This is the second page.', { x: 50, y: 350, size: 12, font });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(path.join(__dirname, 'sample.pdf'), pdfBytes);
  console.log('Sample PDF created');
}

createSamplePDF();
