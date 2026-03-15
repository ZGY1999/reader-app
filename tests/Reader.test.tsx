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

class MockAudio {
  static instances: MockAudio[] = [];

  currentTime = 0;
  duration = 10;
  ended = false;
  paused = true;
  src: string;
  private listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
    MockAudio.instances.push(this);
  }

  addEventListener(event: string, handler: () => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }

  removeEventListener(event: string, handler: () => void) {
    this.listeners.get(event)?.delete(handler);
  }

  async play() {
    this.paused = false;
    this.emit('play');
  }

  pause() {
    this.paused = true;
    this.emit('pause');
  }

  emit(event: string) {
    this.listeners.get(event)?.forEach((handler) => handler());
  }
}

describe('Reader', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    MockAudio.instances = [];
    useBookStore.setState({
      books: [],
      currentBook: null,
      reading: null,
    });

    vi.stubGlobal('Audio', MockAudio);
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn().mockReturnValue('blob:tts-audio'),
        revokeObjectURL: vi.fn(),
      })
    );

    window.electronAPI = {
      importBook: vi.fn(),
      getBooks: vi.fn(),
      getBook: vi.fn(),
      getBookContent: vi.fn().mockResolvedValue(readingPayload),
      saveProgress: vi.fn().mockResolvedValue(undefined),
      getProgress: vi.fn().mockResolvedValue(undefined),
      ai: {
        getStatus: vi.fn().mockResolvedValue({ configured: false }),
        ask: vi.fn(),
      },
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
        getAll: vi.fn().mockResolvedValue({
          ttsVoice: 'en-US-JennyNeural',
          ttsRate: '1.4',
        }),
      },
      tts: {
        synthesize: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
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

  it('keeps the reading page free of persistent AI and TTS panels', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    await screen.findByTestId('text-renderer-ch-1');
    expect(screen.queryByText('AI 问书')).toBeNull();
    expect(screen.queryByText('TTS 朗读')).toBeNull();
    expect(screen.getByRole('button', { name: '工具' })).toBeDefined();
  });

  it('shows a floating selection toolbar with AI entry after selecting text', async () => {
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
        getBoundingClientRect: () => ({
          top: 120,
          left: 240,
          width: 120,
          height: 22,
          right: 360,
          bottom: 142,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);

    expect(screen.getByTestId('selection-toolbar')).toBeDefined();
    expect(screen.getByRole('button', { name: 'AI问书' })).toBeDefined();
  });

  it('opens the AI drawer from the floating toolbar and asks questions there', async () => {
    window.electronAPI.ai.getStatus = vi.fn().mockResolvedValue({ configured: true });
    window.electronAPI.ai.ask = vi.fn().mockResolvedValue({
      success: true,
      answer: 'Chapter 1 focuses on the opening discussion.',
      citations: [
        {
          chunkId: 'book-1:chunk-1',
          chapterId: 'ch-1',
          chapterTitle: 'Chapter 1',
          text: 'Chapter one content',
          score: 0.91,
        },
      ],
    });

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
        getBoundingClientRect: () => ({
          top: 120,
          left: 240,
          width: 120,
          height: 22,
          right: 360,
          bottom: 142,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);
    fireEvent.click(screen.getByRole('button', { name: 'AI问书' }));

    expect(await screen.findByTestId('ai-drawer')).toBeDefined();
    expect(screen.getByText('当前来源：选中文本')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('提出问题，获得来自书籍的解答...'), {
      target: { value: 'What is chapter one about?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }));

    await waitFor(() => {
      expect(window.electronAPI.ai.ask).toHaveBeenCalledWith({
        bookId: 'book-1',
        question: 'What is chapter one about?',
      });
    });

    const answerPanel = await screen.findByTestId('ai-answer');
    expect(answerPanel.textContent).toContain('Chapter 1 focuses on the opening discussion.');
    expect(answerPanel.textContent).toContain('Chapter 1');
    expect(answerPanel.textContent).toContain('Chapter one content');
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
      {
        id: 'ann-2',
        bookId: 'book-1',
        startOffset: 21,
        endOffset: 28,
        text: 'Chapter',
        style: 'underline',
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
    expect(await screen.findByTestId('annotation-ann-2')).toBeDefined();
    expect(screen.getByTestId('annotation-group-title-ch-1').textContent).toContain('Chapter 1');
    expect(screen.getByTestId('annotation-group-title-ch-2').textContent).toContain('Chapter 2');
    expect(screen.getByTestId('annotation-group-title-ch-1').textContent).toContain('1');
    expect(screen.getByTestId('annotation-group-title-ch-2').textContent).toContain('1');
    expect(useBookStore.getState().reading).toEqual(readingPayload);
  });

  it('shows visible selection feedback and clears it after creating an annotation', async () => {
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
        getBoundingClientRect: () => ({
          top: 120,
          left: 240,
          width: 120,
          height: 22,
          right: 360,
          bottom: 142,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);

    expect(screen.getByTestId('selection-toolbar')).toBeDefined();
    expect(screen.getByRole('button', { name: '马克笔' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '马克笔' }));

    await waitFor(() => {
      expect(window.electronAPI.annotations.create).toHaveBeenCalledWith(expect.objectContaining({
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 7,
        text: 'Chapter',
        style: 'highlight',
      }));
    });

    expect(await screen.findByTestId('annotation-ann-created')).toBeDefined();
    expect(screen.queryByTestId('selection-toolbar')).toBeNull();
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

  it('deletes an existing annotation only after explicit confirmation in the toolbar', async () => {
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

    expect(screen.getByRole('button', { name: '删除标注' })).toBeDefined();
    expect(screen.getByTestId('annotation-ann-1').className).toContain('annotation-active');
    expect(window.electronAPI.annotations.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '删除标注' }));

    await waitFor(() => {
      expect(window.electronAPI.annotations.delete).toHaveBeenCalledWith('ann-1');
    });
    expect(screen.queryByTestId('annotation-ann-1')).toBeNull();
  });

  it('clears the active annotation state when the toolbar selection is cancelled', async () => {
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

    expect(screen.getByTestId('annotation-ann-1').className).toContain('annotation-active');

    fireEvent.click(screen.getByRole('button', { name: '取消选中' }));

    expect(screen.queryByRole('button', { name: '删除标注' })).toBeNull();
    expect(screen.getByTestId('annotation-ann-1').className).not.toContain('annotation-active');
  });

  it('jumps to the selected annotation from the sidebar list', async () => {
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([
      {
        id: 'ann-2',
        bookId: 'book-1',
        startOffset: 21,
        endOffset: 28,
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

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    const chapterTwoSection = await screen.findByTestId('chapter-section-ch-2');
    const targetAnnotation = await screen.findByTestId('annotation-ann-2');

    Object.defineProperty(chapterTwoSection, 'offsetTop', { value: 480, configurable: true });
    Object.defineProperty(targetAnnotation, 'offsetTop', { value: 60, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true, configurable: true });

    fireEvent.click(screen.getByTestId('annotation-link-ann-2'));

    expect(scrollContainer.scrollTop).toBe(516);
    expect(screen.getByRole('button', { name: 'Chapter 2' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('annotation-ann-2').className).toContain('annotation-active');
    expect(screen.getByRole('button', { name: '删除标注' })).toBeDefined();
    expect((screen.getByTestId('annotation-focus-ann-2') as HTMLButtonElement).disabled).toBe(true);
  });

  it('deletes an annotation from the sidebar list', async () => {
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

    fireEvent.click(await screen.findByTestId('annotation-link-ann-1'));
    fireEvent.click(screen.getByTestId('annotation-delete-ann-1'));

    await waitFor(() => {
      expect(window.electronAPI.annotations.delete).toHaveBeenCalledWith('ann-1');
    });

    expect(screen.queryByTestId('annotation-link-ann-1')).toBeNull();
    expect(screen.queryByTestId('annotation-ann-1')).toBeNull();
    expect(screen.getByText('当前书籍还没有标注')).toBeDefined();
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

  it('opens the AI drawer from the header tool button with current chapter context', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    await screen.findByTestId('text-renderer-ch-1');
    fireEvent.click(screen.getByRole('button', { name: '工具' }));

    expect(await screen.findByTestId('ai-drawer')).toBeDefined();
    expect(screen.getByText('当前来源：Chapter 1')).toBeDefined();
    expect(screen.queryByText('TTS 朗读')).toBeNull();
  });
});
