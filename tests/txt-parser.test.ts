import { describe, it, expect } from 'vitest';
import { TxtParser } from '../src/services/book-parser/txt.parser';
import * as path from 'path';

describe('TxtParser', () => {
  const parser = new TxtParser();
  const sampleFile = path.join(__dirname, 'fixtures', 'sample.txt');

  it('应该解析 TXT 文件', async () => {
    const book = await parser.parse(sampleFile);
    expect(book).toBeDefined();
    expect(book.content).toBeTruthy();
    expect(book.format).toBe('txt');
    expect(Array.isArray(book.chapters)).toBe(true);
  });

  it('应该提取书籍标题', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.title).toBe('三体');
  });

  it('应该提取作者信息', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.author).toBe('刘慈欣');
  });

  it('应该识别章节', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters).toBeDefined();
    expect(book.chapters!.length).toBe(3);
  });

  it('应该正确提取章节标题', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters![0].title).toBe('第一章 科学边界');
    expect(book.chapters![1].title).toBe('第二章 台球');
    expect(book.chapters![2].title).toBe('第三章 射手和农场主');
  });

  it('应该正确提取章节内容', async () => {
    const book = await parser.parse(sampleFile);
    expect(book.chapters![0].content).toContain('这是第一章的内容');
    expect(book.chapters![1].content).toContain('汪淼走进了台球室');
  });
});
