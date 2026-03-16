import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import dynamicImport from '../../utils/dynamic-import';
import { ParsedBook, ParsedChapter } from './types';

export type Chapter = ParsedChapter;
export type Book = ParsedBook;

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

type PdfTextItem = {
  str?: string;
  transform?: number[];
  height?: number;
};

export interface PdfPageLine {
  text: string;
  y: number;
  fontSize: number;
}

export interface PdfPageSnapshot {
  pageNumber: number;
  text: string;
  lines: PdfPageLine[];
}

export interface PdfTocEntry {
  pageNumber: number;
  title: string;
  level: number;
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

const ensurePdfJsRuntimeCompatibility = () => {
  if (typeof process.getBuiltinModule !== 'function') {
    Object.defineProperty(process, 'getBuiltinModule', {
      configurable: true,
      writable: true,
      value: (name: string) => require(name),
    });
  }
};

const loadPdfJs = async () => {
  if (!pdfJsModulePromise) {
    ensurePdfJsRuntimeCompatibility();
    pdfJsModulePromise = dynamicImport<PdfJsModule>('pdfjs-dist/legacy/build/pdf.mjs');
  }

  return pdfJsModulePromise;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

export const extractPdfPageSnapshot = (items: PdfTextItem[], pageNumber: number): PdfPageSnapshot => {
  const normalizedItems = items
    .map((item) => ({
      text: normalizeText(item.str ?? ''),
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      fontSize: Math.abs(item.height ?? item.transform?.[0] ?? 0),
    }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => {
      if (Math.abs(right.y - left.y) > 3) {
        return right.y - left.y;
      }

      return left.x - right.x;
    });

  const lines: Array<PdfPageLine & { parts: string[] }> = [];

  normalizedItems.forEach((item) => {
    const lastLine = lines.at(-1);
    if (lastLine && Math.abs(lastLine.y - item.y) <= 3) {
      lastLine.parts.push(item.text);
      lastLine.fontSize = Math.max(lastLine.fontSize, item.fontSize);
      return;
    }

    lines.push({
      text: '',
      y: item.y,
      fontSize: item.fontSize,
      parts: [item.text],
    });
  });

  const finalizedLines = lines
    .map((line) => ({
      text: normalizeText(line.parts.join(' ')),
      y: line.y,
      fontSize: line.fontSize,
    }))
    .filter((line) => line.text.length > 0);

  return {
    pageNumber,
    text: finalizedLines.map((line) => line.text).join('\n'),
    lines: finalizedLines,
  };
};

const scoreHeadingCandidate = (
  line: PdfPageLine,
  lineIndex: number,
  maxFontSize: number,
  pageNumber: number
) => {
  const text = line.text;
  const compactText = normalizeText(text);

  if (compactText.length < 2 || compactText.length > 72) {
    return -Infinity;
  }

  let score = 0;

  if (lineIndex === 0) {
    score += 3;
  }
  if (lineIndex <= 2) {
    score += 2;
  }
  if (compactText.length <= 28) {
    score += 2;
  }
  if (line.fontSize >= maxFontSize - 0.1) {
    score += 3;
  }
  if (/^第[一二三四五六七八九十百千零两0-9]+[章节回部卷篇]/.test(compactText)) {
    score += 7;
  }
  if (/^(chapter|section|part)\b/i.test(compactText)) {
    score += 7;
  }
  if (/^\d+(\.\d+){0,3}\s+\S+/.test(compactText)) {
    score += 5;
  }
  if (/^[A-Z][A-Z0-9\s:&-]{3,}$/.test(compactText)) {
    score += 4;
  }
  if (pageNumber === 1 && lineIndex === 0) {
    score += 1;
  }
  if (/^(page|p\.)\s*\d+$/i.test(compactText)) {
    score -= 8;
  }
  if (/content:/i.test(compactText)) {
    score -= 3;
  }
  if (/^[\d\s./-]+$/.test(compactText)) {
    score -= 6;
  }

  return score;
};

export const inferPdfTocEntries = (pages: PdfPageSnapshot[]): PdfTocEntry[] => {
  const seenTitles = new Set<string>();

  return pages.flatMap((page) => {
    if (page.lines.length === 0) {
      return [];
    }

    const maxFontSize = Math.max(...page.lines.map((line) => line.fontSize), 0);
    let bestTitle = '';
    let bestScore = -Infinity;

    page.lines.slice(0, 6).forEach((line, index) => {
      const score = scoreHeadingCandidate(line, index, maxFontSize, page.pageNumber);
      if (score < 6) {
        return;
      }

      if (score > bestScore) {
        bestTitle = line.text;
        bestScore = score;
      }
    });

    if (!bestTitle) {
      return [];
    }

    const dedupeKey = bestTitle.toLocaleLowerCase();
    if (seenTitles.has(dedupeKey)) {
      return [];
    }

    seenTitles.add(dedupeKey);

    return [{
      pageNumber: page.pageNumber,
      title: bestTitle,
      level: 1,
    }];
  });
};

const flattenOutlineEntries = async (
  pdf: any,
  items: any[],
  level: number,
  bucket: PdfTocEntry[]
): Promise<void> => {
  for (const item of items) {
    const pageNumber = await resolveOutlinePageNumber(pdf, item.dest);
    const title = normalizeText(item.title ?? '');

    if (pageNumber && title) {
      bucket.push({
        pageNumber,
        title,
        level,
      });
    }

    if (Array.isArray(item.items) && item.items.length > 0) {
      await flattenOutlineEntries(pdf, item.items, level + 1, bucket);
    }
  }
};

const resolveOutlinePageNumber = async (pdf: any, dest: unknown): Promise<number | null> => {
  if (!dest) {
    return null;
  }

  let resolvedDest = dest;
  if (typeof dest === 'string') {
    resolvedDest = await pdf.getDestination?.(dest);
  }

  if (!Array.isArray(resolvedDest) || resolvedDest.length === 0) {
    return null;
  }

  const destinationRef = resolvedDest[0];

  if (typeof destinationRef === 'number') {
    return destinationRef + 1;
  }

  try {
    const pageIndex = await pdf.getPageIndex(destinationRef);
    return pageIndex + 1;
  } catch {
    return null;
  }
};

export const extractPdfOutlineEntries = async (pdf: any): Promise<PdfTocEntry[]> => {
  const outline = await pdf.getOutline?.();
  if (!Array.isArray(outline) || outline.length === 0) {
    return [];
  }

  const entries: PdfTocEntry[] = [];
  await flattenOutlineEntries(pdf, outline, 1, entries);

  const seenPages = new Set<number>();

  return entries
    .filter((entry) => {
      if (seenPages.has(entry.pageNumber)) {
        return false;
      }

      seenPages.add(entry.pageNumber);
      return true;
    })
    .sort((left, right) => left.pageNumber - right.pageNumber);
};

export const applyPdfTocEntries = (chapters: Chapter[], tocEntries: PdfTocEntry[]): Chapter[] => {
  if (tocEntries.length === 0) {
    return chapters;
  }

  const chapterMap = new Map(chapters.map((chapter) => [chapter.pageNumber, chapter]));

  return chapters.map((chapter) => {
    const sourceChapter = chapterMap.get(chapter.pageNumber);
    const tocEntry = tocEntries.find((entry) => entry.pageNumber === sourceChapter?.pageNumber);

    if (!tocEntry) {
      return chapter;
    }

    return {
      ...chapter,
      tocTitle: tocEntry.title,
    };
  });
};

export class PdfParser {
  async parse(filePath: string): Promise<Book> {
    const buffer = await fs.readFile(filePath);
    const data = new Uint8Array(buffer);
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const metadata = await pdf.getMetadata();
    const info = metadata.info as Record<string, string> | undefined;
    const title = info?.Title || 'Untitled PDF';
    const author = info?.Author;

    const pageSnapshots: PdfPageSnapshot[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pageSnapshots.push(extractPdfPageSnapshot(textContent.items as PdfTextItem[], pageNumber));
    }

    const fullContent = pageSnapshots.map((page) => page.text).filter(Boolean).join('\n');
    const pageChapters: Chapter[] = pageSnapshots.map((page) => ({
      id: crypto.randomUUID(),
      title: `Page ${page.pageNumber}`,
      content: page.text,
      pageNumber: page.pageNumber,
    }));

    const outlineEntries = await extractPdfOutlineEntries(pdf);
    const tocEntries = outlineEntries.length > 0 ? outlineEntries : inferPdfTocEntries(pageSnapshots);
    const chapters = applyPdfTocEntries(pageChapters, tocEntries);

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
