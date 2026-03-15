import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Reader from '../src/renderer/src/pages/Reader';
import { useBookStore } from '../src/renderer/src/store';

const readingPayload = {
  book: {
    id: 'book-1',
    title: 'Test Book',
    format: 'txt' as const,
    filePath: '/test.txt',
  },
  content: 'Chapter one content\n\nChapter two content',
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter 1',
      content: 'Chapter one content',
    },
    {
      id: 'ch-2',
      title: 'Chapter 2',
      content: 'Chapter two content',
    },
  ],
};

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
      getBookContent: vi.fn().mockResolvedValue(readingPayload),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      getProgress: vi.fn().mockResolvedValue(undefined),
      annotations: {
        create: vi.fn().mockResolvedValue({
          success: true,
          annotation: {
            id: 'ann-created',
            bookId: 'book-1',
            startOffset: 0,
            endOffset: 7,
            text: 'Chapter',
            style: 'highlight',
          },
        }),
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({ success: true }),
      },
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

  it('loads the reading payload, annotations, and writes the payload into the store', async () => {
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([
      {
        id: 'ann-1',
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 7,
        text: 'Chapter',
        style: 'highlight',
      },
    ]);

    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const firstChapterText = await screen.findByTestId('text-renderer-ch-1');
    expect(firstChapterText.textContent).toContain('Chapter one content');
    expect(window.electronAPI.getBookContent).toHaveBeenCalledWith('book-1');
    expect(window.electronAPI.annotations.list).toHaveBeenCalledWith('book-1');
    expect(await screen.findByTestId('annotation-ann-1')).toBeDefined();
    expect(useBookStore.getState().reading).toEqual(readingPayload);
  });

  it('restores saved reading progress after loading content', async () => {
    window.electronAPI.getProgress = vi.fn().mockResolvedValue({
      bookId: 'book-1',
      chapterId: 'ch-1',
      offset: 240,
      progress: 0.3,
    });

    useBookStore.getState().setCurrentBook(readingPayload.book);

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

  it('creates an annotation from the current selection and renders it', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    await screen.findByTestId('text-renderer-ch-1');

    const chapterText = screen.getByTestId('text-renderer-ch-1');
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'Chapter',
      getRangeAt: () => ({
        startOffset: 0,
        endOffset: 7,
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);
    fireEvent.click(screen.getByRole('button', { name: '高亮' }));

    await waitFor(() => {
      expect(window.electronAPI.annotations.create).toHaveBeenCalledWith({
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 7,
        text: 'Chapter',
        style: 'highlight',
      });
    });

    expect(await screen.findByTestId('annotation-ann-created')).toBeDefined();
  });

  it('deletes an existing annotation when the marked text is clicked', async () => {
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([
      {
        id: 'ann-1',
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 7,
        text: 'Chapter',
        style: 'highlight',
      },
    ]);

    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    fireEvent.click(await screen.findByTestId('annotation-ann-1'));

    await waitFor(() => {
      expect(window.electronAPI.annotations.delete).toHaveBeenCalledWith('ann-1');
    });
    expect(screen.queryByTestId('annotation-ann-1')).toBeNull();
  });

  it('jumps to a chapter when the sidebar entry is clicked', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    const chapterTwoSection = await screen.findByTestId('chapter-section-ch-2');
    Object.defineProperty(chapterTwoSection, 'offsetTop', { value: 480, configurable: true });

    fireEvent.click(screen.getByRole('button', { name: 'Chapter 2' }));

    expect(scrollContainer.scrollTop).toBe(480);
    expect(screen.getByRole('button', { name: 'Chapter 2' }).getAttribute('aria-current')).toBe('true');
  });

  it('saves reading progress with the visible chapter when the content container scrolls', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    const chapterOneSection = await screen.findByTestId('chapter-section-ch-1');
    const chapterTwoSection = await screen.findByTestId('chapter-section-ch-2');

    Object.defineProperty(chapterOneSection, 'offsetTop', { value: 0, configurable: true });
    Object.defineProperty(chapterTwoSection, 'offsetTop', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 500, writable: true, configurable: true });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(window.electronAPI.saveProgress).toHaveBeenCalled();
    });

    const lastCall = vi.mocked(window.electronAPI.saveProgress).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      bookId: 'book-1',
      chapterId: 'ch-2',
      offset: 500,
    });
    expect(lastCall.progress).toBeCloseTo(0.625);
    expect(screen.getByRole('button', { name: 'Chapter 2' }).getAttribute('aria-current')).toBe('true');
  });
});
