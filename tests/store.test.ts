import { describe, it, expect } from 'vitest';
import { useBookStore } from '../src/renderer/src/store';

describe('BookStore', () => {
  it('应该初始化空书籍列表', () => {
    const { books } = useBookStore.getState();
    expect(books).toEqual([]);
  });

  it('应该设置书籍列表', () => {
    const mockBooks = [{ id: '1', title: '测试书籍', path: '/test.txt' }];
    useBookStore.getState().setBooks(mockBooks);
    expect(useBookStore.getState().books).toEqual(mockBooks);
  });

  it('应该设置当前书籍', () => {
    const mockBook = { id: '1', title: '测试书籍', path: '/test.txt' };
    useBookStore.getState().setCurrentBook(mockBook);
    expect(useBookStore.getState().currentBook).toEqual(mockBook);
  });

  it('应该保存统一的阅读 payload', () => {
    const reading = {
      book: {
        id: '1',
        title: '测试书籍',
        format: 'txt',
        filePath: '/test.txt',
      },
      content: '正文内容',
      chapters: [
        {
          id: 'ch-1',
          title: '第一章',
          content: '正文内容',
        },
      ],
    };

    useBookStore.getState().setReading(reading as any);
    expect(useBookStore.getState().reading).toEqual(reading);
  });
});
