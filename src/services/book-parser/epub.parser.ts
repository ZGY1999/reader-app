import AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ParsedBook, ParsedChapter } from './types';

export type Chapter = ParsedChapter;
export type Book = ParsedBook;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
});

export class EpubParser {
  async parse(filePath: string): Promise<Book> {
    const zip = new AdmZip(filePath);
    const containerXml = this.readEntry(zip, 'META-INF/container.xml');
    const container = xmlParser.parse(containerXml);
    const rootFilePath = this.readRootFilePath(container);

    if (!rootFilePath) {
      throw new Error('Invalid EPUB: missing OPF package path');
    }

    const rootDir = path.posix.dirname(rootFilePath);
    const packageDocument = xmlParser.parse(this.readEntry(zip, rootFilePath));
    const pkg = packageDocument?.package;

    const metadata = pkg?.metadata ?? {};
    const manifestItems = this.normalizeToArray(pkg?.manifest?.item);
    const spineItems = this.normalizeToArray(pkg?.spine?.itemref);
    const manifestMap = new Map(
      manifestItems.map((item: any) => [
        item['@_id'],
        {
          href: item['@_href'],
          properties: item['@_properties'] || '',
          mediaType: item['@_media-type'] || '',
        },
      ])
    );

    const navItem = manifestItems.find((item: any) => `${item['@_properties'] || ''}`.includes('nav'));
    const chapterTitles = navItem
      ? this.extractNavigationTitles(this.readEntry(zip, path.posix.join(rootDir, navItem['@_href'])), rootDir)
      : new Map<string, string>();

    const chapters: Chapter[] = [];

    for (const [index, item] of spineItems.entries()) {
      const manifestItem = manifestMap.get(item['@_idref']);
      if (!manifestItem?.href) {
        continue;
      }

      const chapterPath = path.posix.join(rootDir, manifestItem.href);
      const chapterMarkup = this.readEntry(zip, chapterPath);
      const chapterContent = this.extractBodyText(chapterMarkup);
      const richMarkup = this.extractBodyMarkup(chapterMarkup, chapterPath, zip);
      if (!chapterContent) {
        continue;
      }

      const normalizedHref = path.posix.normalize(manifestItem.href);
      const titleFromNav = chapterTitles.get(normalizedHref);
      const headingText = this.extractHeadingText(chapterMarkup);

      chapters.push({
        id: crypto.randomUUID(),
        title: titleFromNav || headingText || `Chapter ${index + 1}`,
        content: chapterContent,
        markup: richMarkup,
      });
    }

    return {
      id: crypto.randomUUID(),
      title: this.readMetadataValue(metadata, 'title') || 'Untitled EPUB',
      author: this.readMetadataValue(metadata, 'creator'),
      format: 'epub',
      content: chapters.map((chapter) => chapter.content).join('\n\n'),
      chapters,
    };
  }

  private readRootFilePath(containerDocument: any): string | undefined {
    const rootFiles = this.normalizeToArray(containerDocument?.container?.rootfiles?.rootfile);
    for (const rootFile of rootFiles) {
      const fullPath = rootFile?.['@_full-path'];
      if (typeof fullPath === 'string' && fullPath.trim()) {
        return fullPath.trim();
      }
    }

    const serialized = JSON.stringify(containerDocument);
    const match = serialized.match(/"@_full-path":"([^"]+)"/);
    return match?.[1];
  }

  private readEntry(zip: AdmZip, entryPath: string): string {
    const normalizedPath = entryPath.replace(/\\/g, '/');
    const entry = zip.getEntry(normalizedPath);
    if (!entry) {
      throw new Error(`Invalid EPUB: missing ${normalizedPath}`);
    }
    return entry.getData().toString('utf-8');
  }

  private normalizeToArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  private readMetadataValue(metadata: any, key: string): string | undefined {
    const value = metadata?.[key];
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : value[0]?.['#text'];
    }
    return value['#text'] || value;
  }

  private extractNavigationTitles(navMarkup: string, _rootDir: string): Map<string, string> {
    const navDocument = xmlParser.parse(navMarkup);
    const navNodes = this.normalizeToArray(navDocument?.html?.body?.nav);
    const tocNode = navNodes.find((nav: any) => nav?.['@_type'] === 'toc' || nav?.['@_epub:type'] === 'toc') || navNodes[0];
    const entries = new Map<string, string>();

    const visit = (node: any) => {
      if (!node) return;
      const items = this.normalizeToArray(node.li);
      for (const item of items) {
        const anchor = item?.a;
        if (anchor?.['@_href']) {
          const href = path.posix.normalize(anchor['@_href'].split('#')[0]);
          entries.set(href, this.extractTextValue(anchor));
        }

        if (item?.ol) {
          visit(item.ol);
        }
      }
    };

    if (tocNode?.ol) {
      visit(tocNode.ol);
    }

    return entries;
  }

  private extractHeadingText(markup: string): string | undefined {
    const match = markup.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    return match ? this.cleanText(match[1]) : undefined;
  }

  private extractBodyText(markup: string): string {
    const bodyMatch = markup.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const source = bodyMatch ? bodyMatch[1] : markup;
    const withoutScripts = source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');

    return this.cleanText(withoutScripts);
  }

  private extractTextValue(node: any): string {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map((item) => this.extractTextValue(item)).join(' ').trim();
    if (!node || typeof node !== 'object') return '';

    return Object.entries(node)
      .filter(([key]) => !key.startsWith('@_'))
      .map(([, value]) => this.extractTextValue(value))
      .join(' ')
      .trim();
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractBodyMarkup(markup: string, chapterPath: string, zip: AdmZip): string {
    const bodyMatch = markup.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const source = bodyMatch ? bodyMatch[1] : markup;

    const sanitized = source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\s(?:class|id)="[^"]*"/gi, '')
      .replace(/\sstyle="[^"]*"/gi, '');

    return sanitized.replace(
      /<img\b([^>]*?\s)src="([^"]+)"([^>]*)>/gi,
      (_match, beforeSrc: string, src: string, afterSrc: string) => {
        if (/^(data:|https?:|file:)/i.test(src)) {
          return `<img${beforeSrc}src="${src}"${afterSrc}>`;
        }

        const resolvedPath = path.posix.normalize(path.posix.join(path.posix.dirname(chapterPath), src));
        const entry = zip.getEntry(resolvedPath);
        if (!entry) {
          return `<img${beforeSrc}src="${src}"${afterSrc}>`;
        }

        const mediaType = this.getMediaType(resolvedPath);
        const encoded = entry.getData().toString('base64');
        return `<img${beforeSrc}src="data:${mediaType};base64,${encoded}"${afterSrc}>`;
      }
    );
  }

  private getMediaType(entryPath: string): string {
    const extension = path.posix.extname(entryPath).toLowerCase();
    switch (extension) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.svg':
        return 'image/svg+xml';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }
}
