import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Reader from '../src/renderer/src/pages/Reader';
import { useBookStore } from '../src/renderer/src/store';

describe('Reader', () => {
  beforeEach(() => {
    useBookStore.setState({
      books: [],
      currentBook: null,
      reading: null,
    });

    window.electronAPI = {
      importBook: vi.fn(),
      getBooks: vi.fn(),
      getBook: vi.fn(),
      getBookContent: vi.fn().mockResolvedValue({
        book: {
          id: 'book-1',
          title: '测试书籍',
          format: 'txt',
          filePath: '/test.txt',
        },
        content: '章节一内容',
        chapters: [
          {
            id: 'ch-1',
            title: '第一章',
            content: '章节一内容',
          },
        ],
      }),
      saveProgress: vi.fn(),
      getProgress: vi.fn(),
      settings: {
        save: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      },
    };
  });

  it('应该渲染阅读器', () => {
    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );
    expect(screen.getByText('请选择书籍')).toBeDefined();
  });

  it('应该加载阅读 payload 并写入 store', async () => {
    useBookStore.getState().setCurrentBook({
      id: 'book-1',
      title: '测试书籍',
      format: 'txt',
      filePath: '/test.txt',
    });

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    expect(await screen.findByText('章节一内容')).toBeDefined();
    expect(window.electronAPI.getBookContent).toHaveBeenCalledWith('book-1');
    expect(useBookStore.getState().reading).toEqual({
      book: {
        id: 'book-1',
        title: '测试书籍',
        format: 'txt',
        filePath: '/test.txt',
      },
      content: '章节一内容',
      chapters: [
        {
          id: 'ch-1',
          title: '第一章',
          content: '章节一内容',
        },
      ],
    });
  });
});
