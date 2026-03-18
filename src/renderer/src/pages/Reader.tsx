import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnnotationToolbar from '../components/AnnotationToolbar';
import PdfDocumentView from '../components/PdfDocumentView';
import RichContentRenderer from '../components/RichContentRenderer';
import TextRenderer from '../components/TextRenderer';
import { api } from '../api';
import { useBookStore } from '../store';
import { AICitation, AIChatMessage, AIChatStoredMessage, AIChatThread, Annotation, Chapter } from '../types';

interface PendingSelection {
  startOffset: number;
  endOffset: number;
  text: string;
  rect: DOMRect;
  rects?: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  }>;
}

interface TTSState {
  status: 'idle' | 'loading' | 'playing' | 'paused';
  sourceLabel: string;
  error: string;
}

interface TTSTarget {
  text: string;
  startOffset: number;
  endOffset: number;
  chapterId: string | null;
  sourceLabel: string;
}

interface ReaderAIContext {
  sourceLabel: string;
  text: string;
  sourceType: 'selection' | 'annotation' | 'chapter' | 'book';
  chapterId: string | null;
  chapterTitle: string;
}

interface ReadingSettings {
  fontSize: number;
  lineHeight: string;
  theme: 'light' | 'dark';
}

interface FooterMetrics {
  currentPage: number;
  totalPages: number;
  progressPercent: number;
}

const defaultReadingSettings: ReadingSettings = {
  fontSize: 16,
  lineHeight: '1.8',
  theme: 'light',
};

const parseAICitations = (citationsJson?: string | null): AICitation[] => {
  if (!citationsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(citationsJson) as AICitation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeAIMessage = (message: AIChatStoredMessage): AIChatMessage => ({
  id: message.id,
  threadId: message.threadId,
  bookId: message.bookId,
  role: message.role,
  text: message.text,
  sourceType: message.sourceType,
  sourceText: message.sourceText,
  chapterId: message.chapterId,
  chapterTitle: message.chapterTitle,
  citations: parseAICitations(message.citationsJson),
  createdAt: message.createdAt,
});

const sortAIThreads = (threads: AIChatThread[]) => (
  [...threads].sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)
);

const buildAIThreadTitle = (chapterTitle: string, question: string) => {
  const summary = question.trim().replace(/\s+/g, ' ').slice(0, 18);
  return summary ? `${chapterTitle} · ${summary}` : chapterTitle;
};

export default function Reader() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const setReading = useBookStore((state) => state.setReading);
  const [content, setContent] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [aiConfigured, setAIConfigured] = useState(false);
  const [aiComposer, setAIComposer] = useState('');
  const [aiThreads, setAIThreads] = useState<AIChatThread[]>([]);
  const [activeAIThreadId, setActiveAIThreadId] = useState<string | null>(null);
  const [aiMessages, setAIMessages] = useState<AIChatMessage[]>([]);
  const [aiThreadMode, setAIThreadMode] = useState<'auto' | 'manual'>('auto');
  const [aiLoading, setAILoading] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [ttsState, setTTSState] = useState<TTSState>({
    status: 'idle',
    sourceLabel: '当前章节',
    error: '',
  });
  const [ttsHighlightRange, setTTSHighlightRange] = useState<{ startOffset: number; endOffset: number } | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const [selectionToolbarPosition, setSelectionToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const [readingSettings, setReadingSettings] = useState<ReadingSettings>(defaultReadingSettings);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [footerMetrics, setFooterMetrics] = useState<FooterMetrics>({
    currentPage: 1,
    totalPages: 1,
    progressPercent: 0,
  });
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const chapterSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
  const progressSaveTimerRef = useRef<number | null>(null);
  const pendingProgressRef = useRef<{ bookId: string; chapterId: string | null; offset: number; progress: number } | null>(null);

  const chapterRanges = useMemo(() => {
    let searchFrom = 0;

    return chapters.map((chapter) => {
      const matchIndex = content.indexOf(chapter.content, searchFrom);
      const startOffset = matchIndex >= 0 ? matchIndex : searchFrom;
      const endOffset = startOffset + chapter.content.length;
      searchFrom = endOffset;

      return {
        ...chapter,
        startOffset,
        endOffset,
      };
    });
  }, [chapters, content]);

  const annotationEntries = useMemo(() => {
    return annotations.map((annotation) => {
      const chapter = chapterRanges.find((item) => annotation.startOffset >= item.startOffset && annotation.endOffset <= item.endOffset);

      return {
        ...annotation,
        chapterId: chapter?.id ?? null,
        chapterTitle: chapter?.title ?? '全文',
      };
    });
  }, [annotations, chapterRanges]);

  const annotationGroups = useMemo(() => {
    const chapterGroupMap = new Map(
      chapterRanges.map((chapter) => [
        chapter.id,
        {
          id: chapter.id,
          title: chapter.title,
          annotations: [] as typeof annotationEntries,
        },
      ])
    );
    const ungroupedAnnotations: typeof annotationEntries = [];

    annotationEntries.forEach((annotation) => {
      if (annotation.chapterId && chapterGroupMap.has(annotation.chapterId)) {
        chapterGroupMap.get(annotation.chapterId)?.annotations.push(annotation);
        return;
      }

      ungroupedAnnotations.push(annotation);
    });

    const orderedGroups = Array.from(chapterGroupMap.values()).filter((group) => group.annotations.length > 0);

    if (ungroupedAnnotations.length > 0) {
      orderedGroups.push({
        id: 'ungrouped',
        title: '全文',
        annotations: ungroupedAnnotations,
      });
    }

    return orderedGroups;
  }, [annotationEntries, chapterRanges]);

  const isPdfBook = currentBook?.format === 'pdf';
  const isRichEpubBook = currentBook?.format === 'epub' && chapters.some((chapter) => !!chapter.markup);
  const isAnnotationEnabled = currentBook?.format === 'txt' || currentBook?.format === 'epub' || currentBook?.format === 'pdf';

  const sidebarChapters = useMemo(() => {
    if (!isPdfBook) {
      return chapterRanges;
    }

    const tocEntries = chapterRanges.filter((chapter) => !!chapter.tocTitle);
    return tocEntries.length > 0 ? tocEntries : chapterRanges;
  }, [chapterRanges, isPdfBook]);

  const activeSidebarChapterId = useMemo(() => {
    if (!isPdfBook || !currentChapterId) {
      return currentChapterId;
    }

    const currentPageIndex = chapterRanges.findIndex((chapter) => chapter.id === currentChapterId);
    if (currentPageIndex < 0) {
      return sidebarChapters[0]?.id ?? currentChapterId;
    }

    let activeId = sidebarChapters[0]?.id ?? currentChapterId;

    sidebarChapters.forEach((chapter) => {
      const entryIndex = chapterRanges.findIndex((rangeChapter) => rangeChapter.id === chapter.id);
      if (entryIndex <= currentPageIndex) {
        activeId = chapter.id;
      }
    });

    return activeId;
  }, [chapterRanges, currentChapterId, isPdfBook, sidebarChapters]);

  const aiContext = useMemo<ReaderAIContext>(() => {
    if (pendingSelection) {
      const chapter = chapterRanges.find((item) => pendingSelection.startOffset >= item.startOffset && pendingSelection.endOffset <= item.endOffset);
      return {
        sourceLabel: '选中文本',
        text: pendingSelection.text,
        sourceType: 'selection',
        chapterId: chapter?.id ?? currentChapterId ?? null,
        chapterTitle: chapter?.title ?? '当前章节',
      };
    }

    if (selectedAnnotation) {
      const chapter = chapterRanges.find((item) => selectedAnnotation.startOffset >= item.startOffset && selectedAnnotation.endOffset <= item.endOffset);
      return {
        sourceLabel: '当前标注',
        text: selectedAnnotation.text,
        sourceType: 'annotation',
        chapterId: chapter?.id ?? currentChapterId ?? null,
        chapterTitle: chapter?.title ?? '当前章节',
      };
    }

    const activeChapter = chapterRanges.find((chapter) => chapter.id === currentChapterId) ?? chapterRanges[0];
    if (activeChapter) {
      return {
        sourceLabel: activeChapter.title,
        text: activeChapter.content,
        sourceType: 'chapter',
        chapterId: activeChapter.id,
        chapterTitle: activeChapter.title,
      };
    }

    return {
      sourceLabel: '全文',
      text: content,
      sourceType: 'book',
      chapterId: null,
      chapterTitle: '全文',
    };
  }, [chapterRanges, content, currentChapterId, pendingSelection, selectedAnnotation]);

  const aiPromptSuggestions = useMemo(() => [
    '这段和上下文是什么关系？',
    '为什么这里要强调这一点？',
    '用更通俗的语言解释一下',
  ], []);

  const activeAIThread = useMemo(
    () => aiThreads.find((thread) => thread.id === activeAIThreadId) ?? null,
    [activeAIThreadId, aiThreads]
  );

  const themePalette = useMemo(() => {
    if (readingSettings.theme === 'dark') {
      return {
        shellBg: '#171311',
        panelBg: '#201b18',
        contentBg: '#191512',
        drawerBg: '#241f1b',
        text: '#efe5d7',
        subText: '#b7ab9c',
        border: '#3b332d',
        accentBg: '#2e3f52',
        accentBorder: '#42566d',
        accentText: '#d8e8f8',
        chapterActive: '#2c3d51',
        cardBg: '#221d1a',
      };
    }

    return {
      shellBg: '#f5f1e8',
      panelBg: '#fbf8f3',
      contentBg: '#fffdf9',
      drawerBg: '#f7f5f1',
      text: '#2f2924',
      subText: '#7c7368',
      border: '#e6ded2',
      accentBg: '#dceeff',
      accentBorder: '#c9def4',
      accentText: '#31404d',
      chapterActive: '#e8f0ff',
      cardBg: '#ffffff',
    };
  }, [readingSettings.theme]);

  useEffect(() => {
    if (!currentBook) return;

    let disposed = false;

    const loadReading = async () => {
      const [payload, savedProgress, savedAnnotations, aiStatus, settings, savedThreads] = await Promise.all([
        api.getBookContent(currentBook.id),
        api.getProgress(currentBook.id),
        api.annotations.list(currentBook.id),
        api.ai.getStatus(),
        api.settings.getAll(),
        api.aiChat.listThreads(currentBook.id),
      ]);
      const initialThread = (savedThreads[0] ?? null) as AIChatThread | null;
      const savedMessages = initialThread
        ? await api.aiChat.listMessages(initialThread.id)
        : [];

      if (disposed) return;

      setReading(payload);
      setContent(payload.content);
      setChapters(payload.chapters || []);
      setPdfData(payload.pdfData ?? null);
      setAnnotations(savedAnnotations);
      setCurrentChapterId(savedProgress?.chapterId ?? payload.chapters?.[0]?.id ?? null);
      setPendingSelection(null);
      setSelectedAnnotation(null);
      setAIConfigured(aiStatus.configured);
      setAIComposer('');
      setAIThreads(sortAIThreads(savedThreads as AIChatThread[]));
      setActiveAIThreadId(initialThread?.id ?? null);
      setAIMessages((savedMessages as AIChatStoredMessage[]).map(normalizeAIMessage));
      setAIThreadMode('auto');
      setAILoading(false);
      setShowToolsDrawer(false);
      setTTSState({
        status: 'idle',
        sourceLabel: payload.chapters?.[0]?.title ?? '当前章节',
        error: '',
      });
      setTTSHighlightRange(null);
      setPendingOffset(savedProgress?.offset ?? null);
      setSelectionToolbarPosition(null);
      setReadingSettings({
        fontSize: Number(settings.fontSize || defaultReadingSettings.fontSize),
        lineHeight: settings.lineHeight || defaultReadingSettings.lineHeight,
        theme: settings.theme === 'dark' ? 'dark' : 'light',
      });
    };

    void loadReading();

    return () => {
      disposed = true;
    };
  }, [currentBook, setReading]);

  const updateFooterMetrics = (scrollContainer: HTMLDivElement) => {
    const viewportHeight = Math.max(scrollContainer.clientHeight, 1);
    const maxOffset = Math.max(scrollContainer.scrollHeight - viewportHeight, 0);
    const currentPage = Math.max(1, Math.floor(scrollContainer.scrollTop / viewportHeight) + 1);
    const totalPages = Math.max(1, Math.ceil(scrollContainer.scrollHeight / viewportHeight));
    const progressPercent = maxOffset === 0 ? 0 : Number(((scrollContainer.scrollTop / maxOffset) * 100).toFixed(1));

    setFooterMetrics({
      currentPage: Math.min(currentPage, totalPages),
      totalPages,
      progressPercent,
    });
  };

  useEffect(() => {
    if (!contentContainerRef.current) return;
    updateFooterMetrics(contentContainerRef.current);
  }, [chapterRanges]);

  useEffect(() => {
    if (pendingOffset === null || !contentContainerRef.current) return;

    const scrollContainer = contentContainerRef.current;
    let nextOffset = pendingOffset;

    if (isPdfBook && currentChapterId) {
      const targetSection = chapterSectionRefs.current[currentChapterId];
      if (targetSection && pendingOffset <= chapterRanges.length) {
        nextOffset = targetSection.offsetTop;
      }
    }

    scrollContainer.scrollTop = nextOffset;
    syncCurrentChapter(nextOffset);
    updateFooterMetrics(scrollContainer);
    setPendingOffset(null);
  }, [chapterRanges, currentChapterId, isPdfBook, pendingOffset]);

  useEffect(() => {
    if (!pendingSelection) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (selectionToolbarRef.current?.contains(event.target as Node)) {
        return;
      }
      clearActiveAnnotationState();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [pendingSelection]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel?.();
      utteranceRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (progressSaveTimerRef.current !== null) {
        window.clearTimeout(progressSaveTimerRef.current);
      }
    };
  }, []);

  const getVisibleChapterId = (offset: number) => {
    if (chapterRanges.length === 0) return null;

    let activeChapterId = chapterRanges[0].id;

    for (const chapter of chapterRanges) {
      const section = chapterSectionRefs.current[chapter.id];
      if (!section) continue;

      if (section.offsetTop <= offset + 24) {
        activeChapterId = chapter.id;
      }
    }

    return activeChapterId;
  };

  const syncCurrentChapter = (offset: number) => {
    const nextChapterId = getVisibleChapterId(offset);
    if (nextChapterId) {
      setCurrentChapterId(nextChapterId);
    }
    return nextChapterId;
  };

  const handleSelectionCaptured = (selection: PendingSelection) => {
    setSelectedAnnotation(null);
    setPendingSelection(selection);
    setSelectionToolbarPosition({
      top: Math.max(selection.rect.top - 60, 16),
      left: Math.max(selection.rect.left + selection.rect.width / 2, 32),
    });
  };

  const clearActiveAnnotationState = () => {
    setPendingSelection(null);
    setSelectedAnnotation(null);
    setSelectionToolbarPosition(null);
  };

  const handleAnnotate = async (style: string) => {
    if (!currentBook || !pendingSelection) return;

    const optimisticAnnotation: Annotation = {
      id: `pending-${Date.now()}`,
      bookId: currentBook.id,
      startOffset: pendingSelection.startOffset,
      endOffset: pendingSelection.endOffset,
      text: pendingSelection.text,
      style,
    };

    setAnnotations((currentAnnotations) => [...currentAnnotations, optimisticAnnotation]);
    setPendingSelection(null);
    setSelectedAnnotation(null);
    setSelectionToolbarPosition(null);

    const result = await api.annotations.create({
      bookId: currentBook.id,
      ...pendingSelection,
      style,
    });

    if (!result.success) {
      setAnnotations((currentAnnotations) => currentAnnotations.filter((annotation) => annotation.id !== optimisticAnnotation.id));
      return;
    }

    setAnnotations((currentAnnotations) => currentAnnotations.map((annotation) => (
      annotation.id === optimisticAnnotation.id ? result.annotation : annotation
    )));
  };

  const handleSelectAnnotation = (annotation: Annotation) => {
    setPendingSelection(null);
    setSelectedAnnotation(annotation);
    setSelectionToolbarPosition(null);
  };

  const handleDeleteAnnotationById = async (annotationId: string) => {
    const result = await api.annotations.delete(annotationId);
    if (!result.success) return;

    setAnnotations((currentAnnotations) => currentAnnotations.filter((annotation) => annotation.id !== annotationId));
    setSelectedAnnotation((currentAnnotation) => (currentAnnotation?.id === annotationId ? null : currentAnnotation));
  };

  const handleDeleteAnnotation = async () => {
    if (!selectedAnnotation) return;

    await handleDeleteAnnotationById(selectedAnnotation.id);
  };

  const handleCopySelection = async () => {
    if (!pendingSelection?.text) return;

    await navigator.clipboard?.writeText?.(pendingSelection.text);
    setSelectionToolbarPosition(null);
  };

  const openToolsDrawer = () => {
    setShowToolsDrawer(true);
    setSelectionToolbarPosition(null);
  };

  const handleOpenAIDrawer = () => {
    openToolsDrawer();
  };

  const handleSelectAIThread = async (threadId: string, mode: 'auto' | 'manual' = 'manual') => {
    const messages = await api.aiChat.listMessages(threadId);
    setActiveAIThreadId(threadId);
    setAIThreadMode(mode);
    setAIMessages((messages as AIChatStoredMessage[]).map(normalizeAIMessage));
  };

  const bumpAIThread = (threadId: string, updatedAt: number) => {
    setAIThreads((currentThreads) => sortAIThreads(currentThreads.map((thread) => (
      thread.id === threadId
        ? {
            ...thread,
            updatedAt,
          }
        : thread
    ))));
  };

  const appendLocalAIMessage = (message: AIChatStoredMessage) => {
    setAIMessages((currentMessages) => [...currentMessages, normalizeAIMessage(message)]);
  };

  const resolveAIThreadForQuestion = async (question: string, context: ReaderAIContext) => {
    if (!currentBook) {
      return null;
    }

    const manualThread = aiThreadMode === 'manual'
      ? aiThreads.find((thread) => thread.id === activeAIThreadId) ?? null
      : null;
    if (manualThread) {
      return manualThread;
    }

    const chapterId = context.chapterId ?? null;
    const activeThread = aiThreads.find((thread) => thread.id === activeAIThreadId) ?? null;
    if (activeThread && activeThread.chapterId === chapterId) {
      setAIThreadMode('auto');
      return activeThread;
    }

    const matchedThread = aiThreads.find((thread) => thread.chapterId === chapterId) ?? null;
    if (matchedThread) {
      if (matchedThread.id !== activeAIThreadId) {
        await handleSelectAIThread(matchedThread.id, 'auto');
      } else {
        setAIThreadMode('auto');
      }
      return matchedThread;
    }

    const createdThread = await api.aiChat.createThread({
      bookId: currentBook.id,
      chapterId,
      chapterTitle: context.chapterTitle,
      title: buildAIThreadTitle(context.chapterTitle, question),
    }) as AIChatThread;

    setAIThreads((currentThreads) => sortAIThreads([createdThread, ...currentThreads]));
    setActiveAIThreadId(createdThread.id);
    setAIThreadMode('auto');
    setAIMessages([]);

    return createdThread;
  };

  const persistAIMessage = async (threadId: string, role: 'user' | 'assistant' | 'system', text: string, context: ReaderAIContext, citations?: AICitation[]) => {
    if (!currentBook) {
      return null;
    }

    const savedMessage = await api.aiChat.appendMessage({
      threadId,
      bookId: currentBook.id,
      role,
      text,
      sourceType: context.sourceType,
      sourceText: context.text,
      chapterId: context.chapterId,
      chapterTitle: context.chapterTitle,
      citations: citations ?? null,
    }) as AIChatStoredMessage;

    appendLocalAIMessage(savedMessage);
    bumpAIThread(threadId, savedMessage.createdAt);

    return savedMessage;
  };

  const handleAskAI = async () => {
    if (!currentBook || !aiConfigured || !aiComposer.trim()) return;

    const question = aiComposer.trim();
    const context = aiContext;
    let resolvedThread: AIChatThread | null = null;
    setAILoading(true);
    setAIComposer('');

    try {
      resolvedThread = await resolveAIThreadForQuestion(question, context);
      if (!resolvedThread) {
        setAILoading(false);
        return;
      }

      await persistAIMessage(resolvedThread.id, 'user', question, context);

      const result = await api.ai.ask({
        bookId: currentBook.id,
        question,
      });

      if (!result.success) {
        if (result.code === 'NOT_CONFIGURED') {
          setAIConfigured(false);
        }

        await persistAIMessage(resolvedThread.id, 'system', result.error, context);
        setAILoading(false);
        return;
      }

      await persistAIMessage(resolvedThread.id, 'assistant', result.answer, context, result.citations);
      setAILoading(false);
    } catch (error) {
      if (resolvedThread) {
        await persistAIMessage(
          resolvedThread.id,
          'system',
          error instanceof Error ? error.message : 'AI 请求失败',
          context
        );
      }
      setAILoading(false);
    }
  };

  const stopSpeech = (preserveError = false) => {
    window.speechSynthesis?.cancel?.();
    utteranceRef.current = null;
    setTTSHighlightRange(null);
    setTTSState((current) => ({
      status: 'idle',
      sourceLabel: current.sourceLabel,
      error: preserveError ? current.error : '',
    }));
  };

  const resolveTTSTarget = (): TTSTarget | null => {
    if (pendingSelection) {
      const chapter = chapterRanges.find((item) => pendingSelection.startOffset >= item.startOffset && pendingSelection.endOffset <= item.endOffset);
      return {
        text: pendingSelection.text,
        startOffset: pendingSelection.startOffset,
        endOffset: pendingSelection.endOffset,
        chapterId: chapter?.id ?? null,
        sourceLabel: pendingSelection.text.length > 16 ? `选中文本：${pendingSelection.text.slice(0, 16)}...` : `选中文本：${pendingSelection.text}`,
      };
    }

    if (selectedAnnotation) {
      const chapter = chapterRanges.find((item) => selectedAnnotation.startOffset >= item.startOffset && selectedAnnotation.endOffset <= item.endOffset);
      return {
        text: selectedAnnotation.text,
        startOffset: selectedAnnotation.startOffset,
        endOffset: selectedAnnotation.endOffset,
        chapterId: chapter?.id ?? null,
        sourceLabel: chapter?.title ?? '当前标注',
      };
    }

    const activeChapter = chapterRanges.find((chapter) => chapter.id === currentChapterId) ?? chapterRanges[0];
    if (activeChapter) {
      return {
        text: activeChapter.content,
        startOffset: activeChapter.startOffset,
        endOffset: activeChapter.endOffset,
        chapterId: activeChapter.id,
        sourceLabel: activeChapter.title,
      };
    }

    if (!content) return null;

    return {
      text: content,
      startOffset: 0,
      endOffset: content.length,
      chapterId: null,
      sourceLabel: '全文',
    };
  };

  const updateTTSHighlight = (target: TTSTarget, charIndex: number, charLength = 12) => {
    const rangeStart = Math.min(target.startOffset + charIndex, target.endOffset);
    const rangeEnd = Math.min(target.endOffset, rangeStart + Math.max(charLength, 1));

    setTTSHighlightRange({
      startOffset: rangeStart,
      endOffset: Math.max(rangeEnd, rangeStart + 1),
    });
  };

  const findSpeechVoice = (voiceName?: string) => {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    if (!voiceName) {
      return voices[0] ?? null;
    }

    const exactVoice = voices.find((voice) => voice.name === voiceName);
    if (exactVoice) {
      return exactVoice;
    }

    const localeMatch = voiceName.match(/[A-Za-z]{2}-[A-Za-z]{2}/)?.[0];
    if (localeMatch) {
      return voices.find((voice) => voice.lang === localeMatch) ?? null;
    }

    return voices[0] ?? null;
  };

  const handlePlayTTS = async (explicitTarget?: TTSTarget | null) => {
    const target = explicitTarget ?? resolveTTSTarget();
    if (!target?.text.trim()) {
      setTTSState({ status: 'idle', sourceLabel: '当前章节', error: '当前没有可朗读的文本' });
      setTTSHighlightRange(null);
      return;
    }

    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setTTSState({
        status: 'idle',
        sourceLabel: target.sourceLabel,
        error: '当前环境不支持系统朗读',
      });
      setTTSHighlightRange(null);
      return;
    }

    stopSpeech();
    setTTSState({
      status: 'loading',
      sourceLabel: target.sourceLabel,
      error: '',
    });
    setTTSHighlightRange({
      startOffset: target.startOffset,
      endOffset: Math.min(target.endOffset, target.startOffset + 15),
    });

    try {
      const settings = await api.settings.getAll();
      const utterance = new SpeechSynthesisUtterance(target.text);
      const rate = settings.ttsRate ? Number(settings.ttsRate) : 1;
      const voice = findSpeechVoice(settings.ttsVoice || undefined);

      utterance.rate = Number.isFinite(rate) ? rate : 1;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onstart = () => {
        setTTSState({
          status: 'playing',
          sourceLabel: target.sourceLabel,
          error: '',
        });
      };
      utterance.onpause = () => {
        setTTSState((current) => ({
          status: current.status === 'idle' ? 'idle' : 'paused',
          sourceLabel: target.sourceLabel,
          error: current.error,
        }));
      };
      utterance.onresume = () => {
        setTTSState({
          status: 'playing',
          sourceLabel: target.sourceLabel,
          error: '',
        });
      };
      utterance.onboundary = (event) => {
        updateTTSHighlight(target, event.charIndex, event.charLength ?? 12);
      };
      utterance.onend = () => {
        utteranceRef.current = null;
        setTTSHighlightRange(null);
        setTTSState({
          status: 'idle',
          sourceLabel: target.sourceLabel,
          error: '',
        });
      };
      utterance.onerror = (event) => {
        utteranceRef.current = null;
        setTTSHighlightRange(null);
        setTTSState({
          status: 'idle',
          sourceLabel: target.sourceLabel,
          error: event.error || 'TTS 播放失败',
        });
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      utteranceRef.current = null;
      setTTSHighlightRange(null);
      setTTSState({
        status: 'idle',
        sourceLabel: target.sourceLabel,
        error: error instanceof Error ? error.message : 'TTS 播放失败',
      });
    }
  };

  const handleSpeakSelection = () => {
    const target = resolveTTSTarget();
    clearActiveAnnotationState();
    void handlePlayTTS(target);
  };

  const handlePauseTTS = () => {
    window.speechSynthesis?.pause?.();
  };

  const handleResumeTTS = async () => {
    window.speechSynthesis?.resume?.();
  };

  const handleStopTTS = () => {
    stopSpeech();
  };

  const getChapterTTSHighlight = (chapterId: string) => {
    const chapter = chapterRanges.find((item) => item.id === chapterId);
    if (!chapter || !ttsHighlightRange) return null;
    if (ttsHighlightRange.endOffset <= chapter.startOffset || ttsHighlightRange.startOffset >= chapter.endOffset) {
      return null;
    }

    return {
      startOffset: Math.max(ttsHighlightRange.startOffset - chapter.startOffset, 0),
      endOffset: Math.min(ttsHighlightRange.endOffset - chapter.startOffset, chapter.content.length),
    };
  };

  const handleContentScroll = () => {
    if (!currentBook || !contentContainerRef.current) return;

    const scrollContainer = contentContainerRef.current;
    const maxOffset = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);
    const offset = scrollContainer.scrollTop;
    const progress = maxOffset === 0 ? 0 : offset / maxOffset;
    const chapterId = syncCurrentChapter(offset) ?? chapterRanges[0]?.id ?? null;
    updateFooterMetrics(scrollContainer);

    pendingProgressRef.current = {
      bookId: currentBook.id,
      chapterId,
      offset,
      progress,
    };

    if (progressSaveTimerRef.current !== null) {
      return;
    }

    progressSaveTimerRef.current = window.setTimeout(() => {
      progressSaveTimerRef.current = null;
      const nextPayload = pendingProgressRef.current;
      pendingProgressRef.current = null;

      if (nextPayload) {
        void api.saveProgress(nextPayload);
      }
    }, 180);
  };

  const handleChapterJump = (chapterId: string) => {
    const scrollContainer = contentContainerRef.current;
    const section = chapterSectionRefs.current[chapterId];
    if (!scrollContainer || !section || !currentBook) return;

    scrollContainer.scrollTop = section.offsetTop;
    setCurrentChapterId(chapterId);
    updateFooterMetrics(scrollContainer);
    const maxOffset = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);

    void api.saveProgress({
      bookId: currentBook.id,
      chapterId,
      offset: section.offsetTop,
      progress: maxOffset === 0 ? 0 : section.offsetTop / maxOffset,
    });
  };

  const handleAnnotationJump = (annotation: Annotation) => {
    const scrollContainer = contentContainerRef.current;
    if (!scrollContainer) return;

    const chapter = chapterRanges.find((item) => annotation.startOffset >= item.startOffset && annotation.endOffset <= item.endOffset);
    const section = chapter ? chapterSectionRefs.current[chapter.id] : null;
    const annotationElement = document.querySelector(`[data-testid="annotation-${annotation.id}"]`) as HTMLElement | null;

    setPendingSelection(null);
    setSelectedAnnotation(annotation);

    if (chapter) {
      setCurrentChapterId(chapter.id);
    }

    if (section) {
      const nextOffset = Math.max(section.offsetTop + (annotationElement?.offsetTop ?? 0) - 24, 0);
      scrollContainer.scrollTop = nextOffset;
      updateFooterMetrics(scrollContainer);
      return;
    }

    if (annotationElement) {
      scrollContainer.scrollTop = Math.max(annotationElement.offsetTop - 24, 0);
      updateFooterMetrics(scrollContainer);
    }
  };

  const getChapterAnnotations = (chapterId: string) => {
    const chapter = chapterRanges.find((item) => item.id === chapterId);
    if (!chapter) return [];

    return annotations
      .filter((annotation) => annotation.startOffset >= chapter.startOffset && annotation.endOffset <= chapter.endOffset)
      .map((annotation) => ({
        ...annotation,
        startOffset: annotation.startOffset - chapter.startOffset,
        endOffset: annotation.endOffset - chapter.startOffset,
      }));
  };

  const getChapterPendingSelection = (chapterId: string) => {
    if (!pendingSelection) return null;

    const chapter = chapterRanges.find((item) => item.id === chapterId);
    if (!chapter) return null;
    if (pendingSelection.endOffset <= chapter.startOffset || pendingSelection.startOffset >= chapter.endOffset) {
      return null;
    }

    return {
      startOffset: Math.max(pendingSelection.startOffset - chapter.startOffset, 0),
      endOffset: Math.min(pendingSelection.endOffset - chapter.startOffset, chapter.content.length),
    };
  };

  const getChapterPendingSelectionRects = (chapterId: string) => {
    if (!pendingSelection?.rects?.length) return null;

    const chapter = chapterRanges.find((item) => item.id === chapterId);
    if (!chapter) return null;
    if (pendingSelection.endOffset <= chapter.startOffset || pendingSelection.startOffset >= chapter.endOffset) {
      return null;
    }

    return pendingSelection.rects;
  };

  const pdfPages = useMemo(() => {
    if (!isPdfBook) {
      return [];
    }

    return chapterRanges.map((chapter, index) => ({
      id: chapter.id,
      title: chapter.title,
      pageNumber: index + 1,
      startOffset: chapter.startOffset,
      content: chapter.content,
      annotations: getChapterAnnotations(chapter.id),
      pendingSelectionRange: getChapterPendingSelection(chapter.id),
      pendingSelectionRects: getChapterPendingSelectionRects(chapter.id),
      highlightRange: getChapterTTSHighlight(chapter.id),
    }));
  }, [chapterRanges, isPdfBook, annotations, pendingSelection, ttsHighlightRange]);

  if (!currentBook) return <div>请选择书籍</div>;

  const readerTextStyle = {
    fontSize: `${readingSettings.fontSize}px`,
    lineHeight: readingSettings.lineHeight,
    color: themePalette.text,
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
  };

  const currentPdfPage = isPdfBook
    ? Math.max(chapterRanges.findIndex((chapter) => chapter.id === currentChapterId) + 1, 1)
    : footerMetrics.currentPage;
  const totalPdfPages = isPdfBook ? Math.max(chapterRanges.length, 1) : footerMetrics.totalPages;
  const pdfProgressPercent = footerMetrics.progressPercent;

  const footerLabel = `第 ${currentPdfPage} / ${totalPdfPages} 页`;
  const progressLabel = `${pdfProgressPercent.toFixed(1)}%`;

  return (
    <div
      data-testid="reader-shell"
      data-theme={readingSettings.theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: themePalette.shellBg,
        color: themePalette.text,
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: `1px solid ${themePalette.border}`,
          background: themePalette.panelBg,
          gap: '12px',
        }}
      >
        <button onClick={() => navigate('/')} style={{ marginRight: '4px' }}>← 返回书架</button>
        <h2 style={{ flex: 1, margin: 0, fontSize: '18px', fontWeight: 700 }}>{currentBook.title}</h2>
        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginRight: '4px', padding: '8px 10px' }}
        />
        <button type="button" onClick={openToolsDrawer}>工具</button>
        <button onClick={() => navigate('/settings')}>设置</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSidebar && (
          <div style={{ width: '250px', borderRight: `1px solid ${themePalette.border}`, overflowY: 'auto', padding: '10px', background: themePalette.panelBg }}>
            <h3>目录</h3>
            {sidebarChapters.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sidebarChapters.map((chapter) => (
                  <li key={chapter.id} style={{ padding: '5px 0' }}>
                    <button
                      type="button"
                      aria-current={activeSidebarChapterId === chapter.id ? 'true' : 'false'}
                      onClick={() => handleChapterJump(chapter.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: activeSidebarChapterId === chapter.id ? themePalette.chapterActive : 'transparent',
                        color: themePalette.text,
                        border: 'none',
                        padding: '6px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {chapter.tocTitle ?? chapter.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>无章节信息</p>
            )}

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${themePalette.border}` }}>
              <h3 style={{ margin: '0 0 8px' }}>标注</h3>
              {!isAnnotationEnabled ? (
                <p style={{ margin: 0, color: themePalette.subText, fontSize: '13px' }}>当前阅读模式暂不支持标注</p>
              ) : annotationGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {annotationGroups.map((group) => (
                    <section key={group.id}>
                      <div
                        data-testid={`annotation-group-title-${group.id}`}
                        style={{ fontSize: '12px', color: themePalette.subText, marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{group.title}</span>
                        <span>{group.annotations.length}</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.annotations.map((annotation) => (
                          <li key={annotation.id}>
                            <div
                              style={{
                                background: selectedAnnotation?.id === annotation.id ? '#fff1b8' : themePalette.cardBg,
                                border: `1px solid ${themePalette.border}`,
                                borderRadius: '6px',
                                padding: '8px 10px',
                              }}
                            >
                              <button
                                type="button"
                                data-testid={`annotation-link-${annotation.id}`}
                                aria-current={selectedAnnotation?.id === annotation.id ? 'true' : 'false'}
                                onClick={() => handleAnnotationJump(annotation)}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  background: 'transparent',
                                  border: 'none',
                                  padding: 0,
                                  marginBottom: '8px',
                                }}
                              >
                                <div style={{ fontSize: '13px', color: themePalette.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {annotation.text}
                                </div>
                              </button>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  data-testid={`annotation-focus-${annotation.id}`}
                                  disabled={selectedAnnotation?.id === annotation.id}
                                  onClick={() => handleAnnotationJump(annotation)}
                                  style={{ flex: 1 }}
                                >
                                  {selectedAnnotation?.id === annotation.id ? '已定位' : '定位'}
                                </button>
                                <button
                                  type="button"
                                  data-testid={`annotation-delete-${annotation.id}`}
                                  onClick={() => {
                                    void handleDeleteAnnotationById(annotation.id);
                                  }}
                                  style={{ flex: 1 }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: themePalette.subText, fontSize: '13px' }}>当前书籍还没有标注</p>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', minWidth: 0, position: 'relative', background: themePalette.contentBg }}>
          <div data-testid="reader-content-frame" style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              ref={contentContainerRef}
              data-testid="reader-scroll-container"
              onScroll={handleContentScroll}
              style={{ flex: 1, overflowY: 'auto' }}
            >
              {isPdfBook ? (
                <div style={{ padding: '20px 0' }}>
                  <PdfDocumentView
                    documentData={pdfData ?? undefined}
                    pages={pdfPages}
                    scrollContainer={contentContainerRef.current}
                    activeAnnotationId={selectedAnnotation?.id}
                    onAnnotate={handleSelectionCaptured}
                    onSelectAnnotation={handleSelectAnnotation}
                    onClearSelection={clearActiveAnnotationState}
                    onSectionRef={(pageId, element) => {
                      chapterSectionRefs.current[pageId] = element;
                    }}
                  />
                </div>
              ) : chapterRanges.length > 0 ? (
                <div style={{ padding: '20px' }}>
                  {chapterRanges.map((chapter) => (
                    <section
                      key={chapter.id}
                      ref={(element) => {
                        chapterSectionRefs.current[chapter.id] = element;
                      }}
                      data-testid={`chapter-section-${chapter.id}`}
                      style={{ marginBottom: '32px' }}
                    >
                      <h3 style={{ margin: '0 0 12px', color: themePalette.text }}>{chapter.title}</h3>
                      {isRichEpubBook && chapter.markup ? (
                        <RichContentRenderer
                          testId={`rich-content-renderer-${chapter.id}`}
                          markup={chapter.markup}
                          annotations={getChapterAnnotations(chapter.id)}
                          offsetBase={chapter.startOffset}
                          activeAnnotationId={selectedAnnotation?.id}
                          onSelectAnnotation={isAnnotationEnabled ? handleSelectAnnotation : undefined}
                          onAnnotate={handleSelectionCaptured}
                          onClearSelection={clearActiveAnnotationState}
                          style={readerTextStyle}
                        />
                      ) : (
                        <TextRenderer
                          testId={`text-renderer-${chapter.id}`}
                          content={chapter.content}
                          offsetBase={chapter.startOffset}
                          annotations={getChapterAnnotations(chapter.id)}
                          activeAnnotationId={selectedAnnotation?.id}
                          highlightRange={getChapterTTSHighlight(chapter.id)}
                          style={readerTextStyle}
                          onAnnotate={isAnnotationEnabled ? handleSelectionCaptured : undefined}
                          onSelectAnnotation={isAnnotationEnabled ? handleSelectAnnotation : undefined}
                          onClearSelection={clearActiveAnnotationState}
                        />
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <TextRenderer
                  content={content}
                  activeAnnotationId={selectedAnnotation?.id}
                  highlightRange={ttsHighlightRange}
                  style={readerTextStyle}
                  onAnnotate={isAnnotationEnabled ? handleSelectionCaptured : undefined}
                  onSelectAnnotation={isAnnotationEnabled ? handleSelectAnnotation : undefined}
                  onClearSelection={clearActiveAnnotationState}
                />
              )}
            </div>
          </div>

          {pendingSelection && selectionToolbarPosition ? (
            <div ref={selectionToolbarRef}>
              <AnnotationToolbar
                mode="selection"
                onAnnotate={handleAnnotate}
                onCopySelection={() => void handleCopySelection()}
                onAskAI={handleOpenAIDrawer}
                onSpeakSelection={handleSpeakSelection}
                annotationActionsEnabled={isAnnotationEnabled}
                style={{
                  position: 'fixed',
                  top: `${selectionToolbarPosition.top}px`,
                  left: `${selectionToolbarPosition.left}px`,
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                }}
              />
            </div>
          ) : null}

          {selectedAnnotation && isAnnotationEnabled ? (
            <AnnotationToolbar
              mode="annotation"
              onAnnotate={handleAnnotate}
              onDeleteAnnotation={() => void handleDeleteAnnotation()}
              onClearActive={clearActiveAnnotationState}
              style={{
                position: 'absolute',
                top: '24px',
                right: showToolsDrawer ? '416px' : '24px',
                zIndex: 20,
              }}
              />
          ) : null}

          {showToolsDrawer ? (
            <aside
              data-testid="tools-drawer"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                bottom: '16px',
                width: '392px',
                border: `1px solid ${themePalette.border}`,
                borderRadius: '20px',
                background: themePalette.drawerBg,
                boxShadow: '0 20px 48px rgba(30, 24, 19, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 25,
              }}
            >
              <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${themePalette.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: themePalette.text }}>AI 问书</div>
                  <div style={{ fontSize: '12px', color: themePalette.subText, marginTop: '2px' }}>
                    {currentBook.title}・{activeAIThread?.title ?? aiContext.sourceLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToolsDrawer(false)}
                  style={{ padding: '4px 10px', border: `1px solid ${themePalette.border}`, borderRadius: '999px', background: themePalette.cardBg, color: themePalette.subText, fontSize: '13px' }}
                >
                  关闭
                </button>
              </div>

              {aiThreads.length > 0 ? (
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${themePalette.border}`, display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {aiThreads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      data-testid={`ai-thread-${thread.id}`}
                      aria-pressed={activeAIThreadId === thread.id}
                      onClick={() => {
                        void handleSelectAIThread(thread.id);
                      }}
                      style={{
                        flex: '0 0 auto',
                        padding: '8px 12px',
                        borderRadius: '999px',
                        border: `1px solid ${activeAIThreadId === thread.id ? themePalette.accentBorder : themePalette.border}`,
                        background: activeAIThreadId === thread.id ? themePalette.accentBg : themePalette.cardBg,
                        color: activeAIThreadId === thread.id ? themePalette.accentText : themePalette.text,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {thread.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${themePalette.border}`, background: themePalette.accentBg }}>
                <div style={{ color: themePalette.accentText, lineHeight: 1.75, fontSize: '13.5px', maxHeight: '96px', overflowY: 'auto' }}>
                  {aiContext.text || '选中文本或标注后，内容显示在这里。'}
                </div>
              </div>

              <div data-testid="ai-answer" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!aiConfigured ? (
                  <div style={{ background: themePalette.cardBg, border: `1px solid ${themePalette.border}`, borderRadius: '12px', padding: '16px', color: themePalette.text, lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>AI 当前未配置</div>
                    <div style={{ marginBottom: '12px' }}>请先在设置页填写 API Key 和 Base URL。设置页只负责配置和状态，保存后这里会立即可用。</div>
                    <button type="button" onClick={() => navigate('/settings')}>去设置</button>
                  </div>
                ) : aiMessages.length > 0 ? (
                  <>
                    {aiMessages.map((message) => {
                      const isUser = message.role === 'user';
                      const isSystem = message.role === 'system';

                      return (
                        <div
                          key={message.id}
                          data-testid={`ai-message-${message.id}`}
                          data-role={message.role}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isUser ? 'flex-end' : 'flex-start',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              maxWidth: '88%',
                              padding: '12px 14px',
                              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              background: isUser ? '#44a6ff' : isSystem ? '#fff4df' : themePalette.cardBg,
                              border: isUser ? 'none' : `1px solid ${themePalette.border}`,
                              color: isUser ? '#ffffff' : themePalette.text,
                              fontSize: '13.5px',
                              lineHeight: 1.8,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {message.text}
                          </div>

                          {message.citations.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                              <div style={{ fontSize: '12px', color: themePalette.subText, fontWeight: 600 }}>引用来源</div>
                              {message.citations.map((citation) => (
                                <div key={`${message.id}-${citation.chunkId}`} style={{ background: themePalette.cardBg, borderRadius: '12px', border: `1px solid ${themePalette.border}`, padding: '10px 12px' }}>
                                  <div style={{ fontSize: '11px', color: themePalette.subText, marginBottom: '3px' }}>{citation.chapterTitle}</div>
                                  <div style={{ fontSize: '13px', lineHeight: 1.7, color: themePalette.text }}>{citation.text}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ color: themePalette.subText, lineHeight: 1.9, fontSize: '13.5px', padding: '8px 0' }}>从当前选中文本、标注或章节发起提问，回答会显示在这里。</div>
                )}
                {aiLoading ? <div style={{ color: themePalette.subText, lineHeight: 1.9 }}>思考中...</div> : null}
              </div>

              {aiConfigured ? (
                <div style={{ padding: '12px 18px 16px', borderTop: `1px solid ${themePalette.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {aiPromptSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setAIComposer(suggestion)}
                        style={{ padding: '7px 12px', borderRadius: '999px', background: themePalette.cardBg, border: `1px solid ${themePalette.border}`, color: themePalette.text, fontSize: '12.5px' }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <textarea
                      placeholder="提出问题..."
                      value={aiComposer}
                      onChange={(event) => setAIComposer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleAskAI();
                        }
                      }}
                      rows={2}
                      style={{ flex: 1, resize: 'none', background: themePalette.cardBg, border: `1px solid ${themePalette.border}`, borderRadius: '12px', padding: '10px 14px', color: themePalette.text, fontSize: '13.5px' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskAI()}
                      disabled={!aiComposer.trim() || aiLoading}
                      style={{ minWidth: '64px', height: '38px', borderRadius: '999px', border: 'none', background: (!aiComposer.trim() || aiLoading) ? '#b3d9ff' : '#44a6ff', color: '#fff', padding: '0 14px', fontWeight: 600, fontSize: '13px', cursor: (!aiComposer.trim() || aiLoading) ? 'default' : 'pointer' }}
                    >
                      发送
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 14px',
          borderTop: `1px solid ${themePalette.border}`,
          background: themePalette.panelBg,
          color: themePalette.subText,
        }}
      >
        <button onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? '隐藏目录' : '显示目录'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px' }}>
          <span data-testid="reader-page-label">{footerLabel}</span>
          <span data-testid="reader-progress">{progressLabel}</span>
        </div>
      </div>
    </div>
  );
}
