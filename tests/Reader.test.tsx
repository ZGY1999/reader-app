import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
          title: 'Test Book',
          format: 'txt',
          filePath: '/test.txt',
        },
        content: 'Chapter one content',
        chapters: [
          {
            id: 'ch-1',
            title: 'Chapter 1',
            content: 'Chapter one content',
          },
        ],
      }),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      getProgress: vi.fn().mockResolvedValue(undefined),
      settings: {
        save: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      },
    };
  });

  it('renders an empty state when no book is selected', () => {
    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    expect(screen.getByText('请选择书籍')).toBeDefined();
  });

  it('loads the reading payload and writes it into the store', async () => {
    useBookStore.getState().setCurrentBook({
      id: 'book-1',
      title: 'Test Book',
      format: 'txt',
      filePath: '/test.txt',
    });

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    expect(await screen.findByText('Chapter one content')).toBeDefined();
    expect(window.electronAPI.getBookContent).toHaveBeenCalledWith('book-1');
    expect(useBookStore.getState().reading).toEqual({
      book: {
        id: 'book-1',
        title: 'Test Book',
        format: 'txt',
        filePath: '/test.txt',
      },
      content: 'Chapter one content',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chapter 1',
          content: 'Chapter one content',
        },
      ],
    });
  });

  it('restores saved reading progress after loading content', async () => {
    window.electronAPI.getProgress = vi.fn().mockResolvedValue({
      bookId: 'book-1',
      offset: 240,
      progress: 0.3,
    });

    useBookStore.getState().setCurrentBook({
      id: 'book-1',
      title: 'Test Book',
      format: 'txt',
      filePath: '/test.txt',
    });

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');

    await waitFor(() => {
      expect(window.electronAPI.getProgress).toHaveBeenCalledWith('book-1');
      expect(scrollContainer.scrollTop).toBe(240);
    });
  });

  it('saves reading progress when the content container scrolls', async () => {
    useBookStore.getState().setCurrentBook({
      id: 'book-1',
      title: 'Test Book',
      format: 'txt',
      filePath: '/test.txt',
    });

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 300, writable: true, configurable: true });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(window.electronAPI.saveProgress).toHaveBeenCalled();
    });

    const lastCall = vi.mocked(window.electronAPI.saveProgress).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      bookId: 'book-1',
      chapterId: 'ch-1',
      offset: 300,
    });
    expect(lastCall.progress).toBeCloseTo(0.375);
  });
});
