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

class MockSpeechSynthesisUtterance {
  text: string;
  rate = 1;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onboundary: ((event: { charIndex: number; charLength?: number }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
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
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance as unknown as typeof SpeechSynthesisUtterance);
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
        utterance.onstart?.();
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'zh-CN-XiaoxiaoNeural', lang: 'zh-CN' } as SpeechSynthesisVoice,
        { name: 'en-US-JennyNeural', lang: 'en-US' } as SpeechSynthesisVoice,
      ]),
    });

    window.electronAPI = {
      importBook: vi.fn(),
      deleteBook: vi.fn(),
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
          fontSize: '16',
          lineHeight: '1.8',
          theme: 'light',
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
    expect(screen.getByTestId('toolbar-ai')).toBeDefined();
    expect(screen.getByTestId('toolbar-speak')).toBeDefined();
  });

  it('positions the floating selection toolbar above the selected text', async () => {
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
          top: 220,
          left: 260,
          width: 120,
          height: 24,
          right: 380,
          bottom: 244,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);

    const toolbar = screen.getByTestId('selection-toolbar');
    expect(toolbar.getAttribute('style')).toContain('position: fixed');
    expect(toolbar.getAttribute('style')).toContain('transform: translateX(-50%)');
    expect(toolbar.getAttribute('style')).toContain('top: 160px');
  });

  it('dismisses the floating selection toolbar when clicking outside the selection', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    await screen.findByTestId('text-renderer-ch-1');
    const chapterText = screen.getByTestId('text-renderer-ch-1');
    const selectionSpy = vi.spyOn(window, 'getSelection');

    selectionSpy.mockReturnValue({
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

    selectionSpy.mockReturnValue({
      isCollapsed: true,
      toString: () => '',
      getRangeAt: () => ({
        startOffset: 0,
        endOffset: 0,
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          right: 0,
          bottom: 0,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('selection-toolbar')).toBeNull();
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
    fireEvent.click(screen.getByTestId('toolbar-ai'));

    expect(await screen.findByTestId('tools-drawer')).toBeDefined();
    expect(screen.getAllByText(/选中文本/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText('提出问题...'), {
      target: { value: 'What is chapter one about?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

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

  it('starts TTS from the selection toolbar without opening the AI drawer', async () => {
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
    fireEvent.click(screen.getByTestId('toolbar-speak'));

    await waitFor(() => {
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });
    const utterance = vi.mocked(window.speechSynthesis.speak).mock.calls[0]?.[0] as MockSpeechSynthesisUtterance;
    expect(utterance.text).toBe('Chapter');
    expect(utterance.rate).toBe(1.4);
    expect(utterance.voice?.name).toBe('en-US-JennyNeural');
    expect(screen.queryByTestId('tools-drawer')).toBeNull();
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
    expect(screen.getByTestId('toolbar-highlight')).toBeDefined();

    fireEvent.click(screen.getByTestId('toolbar-highlight'));

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

  it('shows a pdf-style optimistic annotation immediately before persistence completes', async () => {
    let resolveCreate: ((value: unknown) => void) | null = null;
    window.electronAPI.annotations.create = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));

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
    fireEvent.click(screen.getByTestId('toolbar-highlight'));

    expect(await screen.findByTestId(/annotation-pending-/)).toBeDefined();

    resolveCreate?.({
      success: true,
      annotation: {
        id: 'ann-created-late',
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 7,
        text: 'Chapter',
        style: 'highlight',
      },
    });

    expect(await screen.findByTestId('annotation-ann-created-late')).toBeDefined();
  });

  it('creates a new txt annotation with full-chapter offsets even after prior annotations split the dom', async () => {
    const txtPayload = {
      ...readingPayload,
      content: 'Alpha Beta Gamma',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chapter 1',
          content: 'Alpha Beta Gamma',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(txtPayload);
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([
      {
        id: 'ann-existing',
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 5,
        text: 'Alpha',
        style: 'highlight',
      },
    ]);

    useBookStore.getState().setCurrentBook(txtPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const chapterText = await screen.findByTestId('text-renderer-ch-1');
    const trailingTextNode = chapterText.childNodes[1] as Text;
    const fakePrefixRange = {
      selectNodeContents: vi.fn(),
      setEnd: vi.fn(),
      toString: () => 'Alpha ',
    };
    const fakeRange = {
      startContainer: trailingTextNode,
      startOffset: 0,
      endContainer: trailingTextNode,
      endOffset: 4,
      cloneRange: vi.fn(() => fakePrefixRange),
      getBoundingClientRect: () => ({
        top: 120,
        left: 240,
        width: 120,
        height: 22,
        right: 360,
        bottom: 142,
      }),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Beta',
      getRangeAt: () => fakeRange,
    } as unknown as Selection);

    fireEvent.mouseUp(chapterText);
    fireEvent.click(screen.getByTestId('toolbar-highlight'));

    await waitFor(() => {
      expect(window.electronAPI.annotations.create).toHaveBeenCalledWith(expect.objectContaining({
        bookId: 'book-1',
        startOffset: 6,
        endOffset: 10,
        text: 'Beta',
        style: 'highlight',
      }));
    });
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

    expect(screen.getByTestId('toolbar-delete-annotation')).toBeDefined();
    expect(screen.getByTestId('annotation-ann-1').className).toContain('annotation-active');
    expect(window.electronAPI.annotations.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('toolbar-delete-annotation'));

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

    fireEvent.click(screen.getByTestId('toolbar-clear-annotation'));

    expect(screen.queryByTestId('toolbar-delete-annotation')).toBeNull();
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
    expect(screen.getByTestId('toolbar-delete-annotation')).toBeDefined();
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

  it('renders reading progress and page labels in the footer', async () => {
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1800, configurable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 700, writable: true, configurable: true });

    fireEvent.scroll(scrollContainer);

    expect((await screen.findByTestId('reader-progress')).textContent).toContain('50.0%');
    expect(screen.getByTestId('reader-page-label').textContent).toContain('第 2 / 5 页');
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

    expect(await screen.findByTestId('tools-drawer')).toBeDefined();
    expect(screen.getAllByText(/Chapter 1/).length).toBeGreaterThan(0);
    expect(screen.queryByText('TTS 朗读')).toBeNull();
  });

  it('applies reading appearance settings only to the reading content area', async () => {
    window.electronAPI.settings.getAll = vi.fn().mockResolvedValue({
      fontSize: '22',
      lineHeight: '2.2',
      theme: 'dark',
      ttsVoice: 'en-US-JennyNeural',
      ttsRate: '1.4',
    });
    useBookStore.getState().setCurrentBook(readingPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const shell = await screen.findByTestId('reader-shell');
    const textRenderer = screen.getByTestId('text-renderer-ch-1');
    const headerToolButton = screen.getByRole('button', { name: '工具' });

    expect(shell.getAttribute('data-theme')).toBe('dark');
    expect(textRenderer.getAttribute('style')).toContain('font-size: 22px');
    expect(textRenderer.getAttribute('style')).toContain('line-height: 2.2');
    expect(headerToolButton.getAttribute('style') || '').not.toContain('font-size: 22px');
  });

  it('renders epub books through rich markup chapters instead of flattening them to plain text', async () => {
    const epubPayload = {
      book: {
        id: 'book-epub',
        title: 'Rich EPUB',
        format: 'epub' as const,
        filePath: '/test.epub',
      },
      content: '第一章内容 插图说明',
      chapters: [
        {
          id: 'epub-ch-1',
          title: '第一章',
          content: '第一章内容 插图说明',
          markup: '<section><h1>第一章</h1><p>第一章内容</p><img alt="插图" src="data:image/png;base64,ZmFrZQ==" /></section>',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(epubPayload);
    useBookStore.getState().setCurrentBook(epubPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    expect(await screen.findByTestId('rich-content-renderer-epub-ch-1')).toBeDefined();
    expect(screen.getByRole('img', { name: '插图' })).toBeDefined();
    expect(screen.queryByTestId('text-renderer-epub-ch-1')).toBeNull();
  });

  it('shows the floating selection toolbar for rich epub content selections', async () => {
    const epubPayload = {
      book: {
        id: 'book-epub',
        title: 'Rich EPUB',
        format: 'epub' as const,
        filePath: '/test.epub',
      },
      content: '第一章内容 插图说明',
      chapters: [
        {
          id: 'epub-ch-1',
          title: '第一章',
          content: '第一章内容 插图说明',
          markup: '<section><h1>第一章</h1><p>第一章内容</p><img alt="插图" src="data:image/png;base64,ZmFrZQ==" /></section>',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(epubPayload);
    useBookStore.getState().setCurrentBook(epubPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const richRenderer = await screen.findByTestId('rich-content-renderer-epub-ch-1');
    const paragraphNode = screen.getByText('第一章内容').firstChild as Text;

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => '第一章',
      getRangeAt: () => ({
        startContainer: paragraphNode,
        endContainer: paragraphNode,
        commonAncestorContainer: paragraphNode,
        startOffset: 0,
        endOffset: 3,
        cloneRange: () => ({
          selectNodeContents: vi.fn(),
          setEnd: vi.fn(),
          toString: () => '',
        }),
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

    fireEvent.mouseUp(richRenderer);

    expect(await screen.findByTestId('selection-toolbar')).toBeDefined();
  });

  it('enables annotation actions for rich epub selections and creates an epub annotation', async () => {
    const epubPayload = {
      book: {
        id: 'book-epub',
        title: 'Rich EPUB',
        format: 'epub' as const,
        filePath: '/test.epub',
      },
      content: '第一章内容 第二段',
      chapters: [
        {
          id: 'epub-ch-1',
          title: '第一章',
          content: '第一章内容 第二段',
          markup: '<section><p>第一章内容</p><p>第二段</p></section>',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(epubPayload);
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([]);
    window.electronAPI.annotations.create = vi.fn().mockResolvedValue({
      success: true,
      annotation: {
        id: 'epub-ann-created',
        bookId: 'book-epub',
        startOffset: 0,
        endOffset: 3,
        text: '第一章',
        style: 'highlight',
      },
    });
    useBookStore.getState().setCurrentBook(epubPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const richRenderer = await screen.findByTestId('rich-content-renderer-epub-ch-1');
    const paragraphNode = screen.getByText('第一章内容').firstChild as Text;

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => '第一章',
      getRangeAt: () => ({
        startContainer: paragraphNode,
        endContainer: paragraphNode,
        commonAncestorContainer: paragraphNode,
        startOffset: 0,
        endOffset: 3,
        cloneRange: () => ({
          selectNodeContents: vi.fn(),
          setEnd: vi.fn(),
          toString: () => '',
        }),
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

    fireEvent.mouseUp(richRenderer);

    expect(await screen.findByTestId('selection-toolbar')).toBeDefined();
    expect(screen.getByTestId('toolbar-highlight').hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByTestId('toolbar-highlight'));

    await waitFor(() => {
      expect(window.electronAPI.annotations.create).toHaveBeenCalledWith(expect.objectContaining({
        bookId: 'book-epub',
        startOffset: 0,
        endOffset: 3,
        text: '第一章',
        style: 'highlight',
      }));
    });

    expect(await screen.findByTestId('annotation-link-epub-ann-created')).toBeDefined();
    expect(await screen.findByTestId('annotation-epub-ann-created')).toBeDefined();
  });

  it('restores existing epub annotations into rich markup and lets the user delete them from the sidebar', async () => {
    const epubPayload = {
      book: {
        id: 'book-epub',
        title: 'Rich EPUB',
        format: 'epub' as const,
        filePath: '/test.epub',
      },
      content: '第一章内容 第二段',
      chapters: [
        {
          id: 'epub-ch-1',
          title: '第一章',
          content: '第一章内容 第二段',
          markup: '<section><p>第一章内容</p><p>第二段</p></section>',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(epubPayload);
    window.electronAPI.annotations.list = vi.fn().mockResolvedValue([
      {
        id: 'epub-ann-1',
        bookId: 'book-epub',
        startOffset: 0,
        endOffset: 3,
        text: '第一章',
        style: 'highlight',
      },
    ]);
    useBookStore.getState().setCurrentBook(epubPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    fireEvent.click(await screen.findByTestId('annotation-link-epub-ann-1'));

    expect(await screen.findByTestId('annotation-epub-ann-1')).toBeDefined();
    expect(screen.getByTestId('toolbar-delete-annotation')).toBeDefined();

    fireEvent.click(screen.getByTestId('toolbar-delete-annotation'));

    await waitFor(() => {
      expect(window.electronAPI.annotations.delete).toHaveBeenCalledWith('epub-ann-1');
    });

    expect(screen.queryByTestId('annotation-link-epub-ann-1')).toBeNull();
    expect(screen.queryByTestId('annotation-epub-ann-1')).toBeNull();
  });

  it('renders pdf books through a continuous page viewer instead of flattening them to plain text', async () => {
    const pdfPayload = {
      book: {
        id: 'book-pdf',
        title: 'Layout PDF',
        format: 'pdf' as const,
        filePath: 'D:/fixtures/layout.pdf',
      },
      content: 'Page 1 text\nPage 2 text',
      chapters: [
        {
          id: 'pdf-page-1',
          title: 'Page 1',
          content: 'Page 1 text',
        },
        {
          id: 'pdf-page-2',
          title: 'Page 2',
          content: 'Page 2 text',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(pdfPayload);
    useBookStore.getState().setCurrentBook(pdfPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    expect(await screen.findByTestId('pdf-document-view')).toBeDefined();
    expect(screen.queryByTestId('text-renderer-pdf-page-1')).toBeNull();
    expect(await screen.findByTestId('chapter-section-pdf-page-1')).toBeDefined();
    expect(await screen.findByTestId('chapter-section-pdf-page-2')).toBeDefined();
  });

  it('jumps to the selected pdf page in the continuous viewer', async () => {
    const pdfPayload = {
      book: {
        id: 'book-pdf',
        title: 'Layout PDF',
        format: 'pdf' as const,
        filePath: 'D:/fixtures/layout.pdf',
      },
      content: 'Page 1 text\nPage 2 text',
      chapters: [
        {
          id: 'pdf-page-1',
          title: 'Page 1',
          content: 'Page 1 text',
        },
        {
          id: 'pdf-page-2',
          title: 'Page 2',
          content: 'Page 2 text',
          tocTitle: 'Chapter 1 Introduction',
        },
      ],
    };

    window.electronAPI.getBookContent = vi.fn().mockResolvedValue(pdfPayload);
    useBookStore.getState().setCurrentBook(pdfPayload.book);

    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );

    const scrollContainer = await screen.findByTestId('reader-scroll-container');
    const pageTwoSection = await screen.findByTestId('chapter-section-pdf-page-2');
    Object.defineProperty(pageTwoSection, 'offsetTop', { value: 860, configurable: true });

    expect(screen.getByRole('button', { name: 'Chapter 1 Introduction' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Page 1' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Chapter 1 Introduction' }));

    expect(scrollContainer.scrollTop).toBe(860);
    expect(screen.getByRole('button', { name: 'Chapter 1 Introduction' }).getAttribute('aria-current')).toBe('true');
  });
});
