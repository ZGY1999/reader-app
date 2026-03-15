import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnnotationToolbar from '../components/AnnotationToolbar';
import TextRenderer from '../components/TextRenderer';
import { api } from '../api';
import { useBookStore } from '../store';
import { Annotation, Chapter } from '../types';

interface PendingSelection {
  startOffset: number;
  endOffset: number;
  text: string;
  rect: DOMRect;
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

interface AICitation {
  chunkId: string;
  chapterId?: string;
  chapterTitle: string;
  text: string;
  startOffset: number;
  endOffset: number;
  score: number;
}

interface ReaderAIContext {
  sourceLabel: string;
  text: string;
}

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
  const [aiQuestion, setAIQuestion] = useState('');
  const [aiAnswer, setAIAnswer] = useState('');
  const [aiCitations, setAICitations] = useState<AICitation[]>([]);
  const [aiError, setAIError] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [showAIDrawer, setShowAIDrawer] = useState(false);
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
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const chapterSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  const aiContext = useMemo<ReaderAIContext>(() => {
    if (pendingSelection) {
      return {
        sourceLabel: '选中文本',
        text: pendingSelection.text,
      };
    }

    if (selectedAnnotation) {
      return {
        sourceLabel: '当前标注',
        text: selectedAnnotation.text,
      };
    }

    const activeChapter = chapterRanges.find((chapter) => chapter.id === currentChapterId) ?? chapterRanges[0];
    if (activeChapter) {
      return {
        sourceLabel: activeChapter.title,
        text: activeChapter.content,
      };
    }

    return {
      sourceLabel: '全文',
      text: content,
    };
  }, [chapterRanges, content, currentChapterId, pendingSelection, selectedAnnotation]);

  const aiPromptSuggestions = useMemo(() => [
    '这段和上下文是什么关系？',
    '为什么这里要强调这一点？',
    '用更通俗的语言解释一下',
  ], []);

  useEffect(() => {
    if (!currentBook) return;

    let disposed = false;

    const loadReading = async () => {
      const [payload, savedProgress, savedAnnotations, aiStatus] = await Promise.all([
        api.getBookContent(currentBook.id),
        api.getProgress(currentBook.id),
        api.annotations.list(currentBook.id),
        api.ai.getStatus(),
      ]);

      if (disposed) return;

      setReading(payload);
      setContent(payload.content);
      setChapters(payload.chapters || []);
      setAnnotations(savedAnnotations);
      setCurrentChapterId(savedProgress?.chapterId ?? payload.chapters?.[0]?.id ?? null);
      setPendingSelection(null);
      setSelectedAnnotation(null);
      setAIConfigured(aiStatus.configured);
      setAIQuestion('');
      setAIAnswer('');
      setAICitations([]);
      setAIError('');
      setAILoading(false);
      setShowAIDrawer(false);
      setTTSState({
        status: 'idle',
        sourceLabel: payload.chapters?.[0]?.title ?? '当前章节',
        error: '',
      });
      setTTSHighlightRange(null);
      setPendingOffset(savedProgress?.offset ?? null);
      setSelectionToolbarPosition(null);
    };

    void loadReading();

    return () => {
      disposed = true;
    };
  }, [currentBook, setReading]);

  useEffect(() => {
    if (pendingOffset === null || !contentContainerRef.current) return;

    contentContainerRef.current.scrollTop = pendingOffset;
    syncCurrentChapter(pendingOffset);
    setPendingOffset(null);
  }, [chapterRanges, pendingOffset]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
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
      top: Math.max(selection.rect.top - 56, 16),
      left: Math.max(selection.rect.left, 16),
    });
  };

  const clearActiveAnnotationState = () => {
    setPendingSelection(null);
    setSelectedAnnotation(null);
    setSelectionToolbarPosition(null);
  };

  const handleAnnotate = async (style: string) => {
    if (!currentBook || !pendingSelection) return;

    const result = await api.annotations.create({
      bookId: currentBook.id,
      ...pendingSelection,
      style,
    });

    if (!result.success) return;

    setAnnotations((currentAnnotations) => [...currentAnnotations, result.annotation]);
    setPendingSelection(null);
    setSelectedAnnotation(null);
    setSelectionToolbarPosition(null);
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

  const handleOpenAIDrawer = () => {
    setShowAIDrawer(true);
    setSelectionToolbarPosition(null);
    setAIError('');
    setAIAnswer('');
    setAICitations([]);
  };

  const handleAskAI = async () => {
    if (!currentBook || !aiConfigured || !aiQuestion.trim()) return;

    setAILoading(true);
    setAIError('');
    setAIAnswer('');
    setAICitations([]);

    try {
      const result = await api.ai.ask({
        bookId: currentBook.id,
        question: aiQuestion.trim(),
      });

      if (!result.success) {
        if (result.code === 'NOT_CONFIGURED') {
          setAIConfigured(false);
        }
        setAIError(result.error);
        setAILoading(false);
        return;
      }

      setAIAnswer(result.answer);
      setAICitations(result.citations);
      setAILoading(false);
    } catch (error) {
      setAIError(error instanceof Error ? error.message : 'AI 请求失败');
      setAILoading(false);
    }
  };

  const releaseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
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

  const updateTTSHighlight = (audio: HTMLAudioElement, target: TTSTarget) => {
    if (!audio.duration || Number.isNaN(audio.duration) || audio.duration <= 0) {
      return;
    }

    const ratio = Math.min(Math.max(audio.currentTime / audio.duration, 0), 1);
    const spanLength = Math.max(target.endOffset - target.startOffset, 1);
    const rangeStart = target.startOffset + Math.floor(spanLength * ratio);
    const rangeEnd = Math.min(target.endOffset, rangeStart + 15);

    setTTSHighlightRange({
      startOffset: rangeStart,
      endOffset: Math.max(rangeEnd, rangeStart + 1),
    });
  };

  const handlePlayTTS = async () => {
    const target = resolveTTSTarget();
    if (!target?.text.trim()) {
      setTTSState({ status: 'idle', sourceLabel: '当前章节', error: '当前没有可朗读的文本' });
      setTTSHighlightRange(null);
      return;
    }

    releaseAudio();
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
      const audioBytes = await api.tts.synthesize({
        text: target.text,
        voice: settings.ttsVoice || undefined,
        rate: settings.ttsRate ? Number(settings.ttsRate) : 1,
      });
      const normalizedBytes = audioBytes instanceof Uint8Array ? audioBytes : new Uint8Array(audioBytes as ArrayLike<number>);
      const audioPayload = Uint8Array.from(normalizedBytes);
      const audioUrl = URL.createObjectURL(new Blob([audioPayload], { type: 'audio/mpeg' }));
      const audio = new Audio(audioUrl);

      audioRef.current = audio;
      audioUrlRef.current = audioUrl;

      audio.addEventListener('timeupdate', () => updateTTSHighlight(audio, target));
      audio.addEventListener('ended', () => {
        setTTSState({
          status: 'idle',
          sourceLabel: target.sourceLabel,
          error: '',
        });
        setTTSHighlightRange(null);
      });
      audio.addEventListener('pause', () => {
        if (audio.ended) return;
        setTTSState((current) => ({
          status: current.status === 'idle' ? 'idle' : 'paused',
          sourceLabel: target.sourceLabel,
          error: current.error,
        }));
      });
      audio.addEventListener('play', () => {
        setTTSState({
          status: 'playing',
          sourceLabel: target.sourceLabel,
          error: '',
        });
      });

      await audio.play();
      updateTTSHighlight(audio, target);
    } catch (error) {
      releaseAudio();
      setTTSHighlightRange(null);
      setTTSState({
        status: 'idle',
        sourceLabel: target.sourceLabel,
        error: error instanceof Error ? error.message : 'TTS 播放失败',
      });
    }
  };

  const handlePauseTTS = () => {
    audioRef.current?.pause();
  };

  const handleResumeTTS = async () => {
    if (!audioRef.current) return;
    await audioRef.current.play();
  };

  const handleStopTTS = () => {
    releaseAudio();
    setTTSHighlightRange(null);
    setTTSState((current) => ({
      status: 'idle',
      sourceLabel: current.sourceLabel,
      error: '',
    }));
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
    const chapterId = syncCurrentChapter(offset) ?? chapterRanges[0]?.id;

    void api.saveProgress({
      bookId: currentBook.id,
      chapterId,
      offset,
      progress,
    });
  };

  const handleChapterJump = (chapterId: string) => {
    const scrollContainer = contentContainerRef.current;
    const section = chapterSectionRefs.current[chapterId];
    if (!scrollContainer || !section) return;

    scrollContainer.scrollTop = section.offsetTop;
    setCurrentChapterId(chapterId);
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
      return;
    }

    if (annotationElement) {
      scrollContainer.scrollTop = Math.max(annotationElement.offsetTop - 24, 0);
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

  if (!currentBook) return <div>请选择书籍</div>;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#f5f1e8',
        color: '#2f2924',
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid #e6ded2',
          background: '#fbf8f3',
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
        <button type="button" onClick={handleOpenAIDrawer}>工具</button>
        <button onClick={() => navigate('/settings')}>设置</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSidebar && (
          <div style={{ width: '250px', borderRight: '1px solid #ddd', overflowY: 'auto', padding: '10px' }}>
            <h3>目录</h3>
            {chapterRanges.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {chapterRanges.map((chapter) => (
                  <li key={chapter.id} style={{ padding: '5px 0' }}>
                    <button
                      type="button"
                      aria-current={currentChapterId === chapter.id ? 'true' : 'false'}
                      onClick={() => handleChapterJump(chapter.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: currentChapterId === chapter.id ? '#e8f0ff' : 'transparent',
                        border: 'none',
                        padding: '6px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {chapter.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>无章节信息</p>
            )}

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 8px' }}>标注</h3>
              {annotationGroups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {annotationGroups.map((group) => (
                    <section key={group.id}>
                      <div
                        data-testid={`annotation-group-title-${group.id}`}
                        style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{group.title}</span>
                        <span>{group.annotations.length}</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.annotations.map((annotation) => (
                          <li key={annotation.id}>
                            <div
                              style={{
                                background: selectedAnnotation?.id === annotation.id ? '#fff1b8' : '#fafafa',
                                border: '1px solid #e8e8e8',
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
                                <div style={{ fontSize: '13px', color: '#1f1f1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                <p style={{ margin: 0, color: '#8c8c8c', fontSize: '13px' }}>当前书籍还没有标注</p>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', minWidth: 0, position: 'relative', background: '#fffdf9' }}>
          <div style={{ flex: showAIDrawer ? '1 1 calc(100% - 420px)' : '1 1 100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              ref={contentContainerRef}
              data-testid="reader-scroll-container"
              onScroll={handleContentScroll}
              style={{ flex: 1, overflowY: 'auto' }}
            >
              {chapterRanges.length > 0 ? (
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
                      <h3 style={{ margin: '0 0 12px', color: '#3a332d' }}>{chapter.title}</h3>
                      <TextRenderer
                        testId={`text-renderer-${chapter.id}`}
                        content={chapter.content}
                        offsetBase={chapter.startOffset}
                        annotations={getChapterAnnotations(chapter.id)}
                        activeAnnotationId={selectedAnnotation?.id}
                        highlightRange={getChapterTTSHighlight(chapter.id)}
                        onAnnotate={handleSelectionCaptured}
                        onSelectAnnotation={handleSelectAnnotation}
                        onClearSelection={clearActiveAnnotationState}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <TextRenderer
                  content={content}
                  activeAnnotationId={selectedAnnotation?.id}
                  highlightRange={ttsHighlightRange}
                  onAnnotate={handleSelectionCaptured}
                  onSelectAnnotation={handleSelectAnnotation}
                  onClearSelection={clearActiveAnnotationState}
                />
              )}
            </div>
          </div>

          {pendingSelection && selectionToolbarPosition ? (
            <AnnotationToolbar
              mode="selection"
              onAnnotate={handleAnnotate}
              onCopySelection={() => void handleCopySelection()}
              onAskAI={handleOpenAIDrawer}
              style={{
                position: 'absolute',
                top: `${selectionToolbarPosition.top}px`,
                left: `${selectionToolbarPosition.left}px`,
                zIndex: 20,
              }}
            />
          ) : null}

          {selectedAnnotation ? (
            <AnnotationToolbar
              mode="annotation"
              onAnnotate={handleAnnotate}
              onDeleteAnnotation={() => void handleDeleteAnnotation()}
              onClearActive={clearActiveAnnotationState}
              style={{
                position: 'absolute',
                top: '24px',
                right: showAIDrawer ? '444px' : '24px',
                zIndex: 20,
              }}
            />
          ) : null}

          {showAIDrawer ? (
            <aside
              data-testid="ai-drawer"
              style={{
                width: '428px',
                borderLeft: '1px solid #e7dfd3',
                background: '#f7f5f1',
                boxShadow: '-16px 0 28px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid #ece4d8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#2f2924', marginBottom: '4px' }}>AI 问书</div>
                    <div style={{ fontSize: '12px', color: '#8a8177', marginBottom: '4px' }}>{currentBook.title}</div>
                    <div style={{ fontSize: '13px', color: '#5f574f' }}>当前来源：{aiContext.sourceLabel}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAIDrawer(false)}
                    style={{ padding: '6px 10px', border: '1px solid #d7cec0', borderRadius: '999px', background: '#fff', color: '#7d7469' }}
                  >
                    关闭
                  </button>
                </div>
              </div>

              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                <div style={{ background: '#dceeff', border: '1px solid #c9def4', borderRadius: '14px', padding: '14px 16px', color: '#31404d', lineHeight: 1.75, fontSize: '14px', maxHeight: '140px', overflowY: 'auto' }}>
                  {aiContext.text || '当前没有可用文本上下文。'}
                </div>

                {!aiConfigured ? (
                  <div style={{ background: '#fff', border: '1px solid #e8dfd3', borderRadius: '16px', padding: '16px', color: '#5a524a', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>AI 当前未配置</div>
                    <div style={{ marginBottom: '12px' }}>请先在设置页填写 API Key 和 Base URL。设置页只负责配置和状态，保存后这里会立即可用。</div>
                    <button type="button" onClick={() => navigate('/settings')}>去设置</button>
                  </div>
                ) : (
                  <>
                    <div data-testid="ai-answer" style={{ background: '#fff', border: '1px solid #e8dfd3', borderRadius: '16px', padding: '18px', flex: 1, minHeight: '360px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '13px', color: '#7d7469' }}>回答</div>
                      {aiLoading ? (
                        <div style={{ color: '#5c544c', lineHeight: 1.9 }}>思考中...</div>
                      ) : aiAnswer ? (
                        <>
                          <div style={{ color: '#39322c', lineHeight: 1.92, fontSize: '15px' }}>{aiAnswer}</div>
                          {aiCitations.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {aiCitations.map((citation) => (
                                <div key={citation.chunkId} style={{ borderTop: '1px solid #f0e8dd', paddingTop: '8px' }}>
                                  <div style={{ fontSize: '12px', color: '#8a8177', marginBottom: '4px' }}>{citation.chapterTitle}</div>
                                  <div style={{ fontSize: '14px', lineHeight: 1.8, color: '#4b443d' }}>{citation.text}</div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div style={{ color: '#7d7469', lineHeight: 1.9 }}>从当前选中文本、当前标注或当前章节发起提问，回答会显示在这里。</div>
                      )}
                      {aiError ? <div role="alert" style={{ color: '#cf1322' }}>{aiError}</div> : null}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {aiPromptSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setAIQuestion(suggestion)}
                          style={{ padding: '10px 14px', borderRadius: '999px', background: '#fff', border: '1px solid #e6ddd2', color: '#5c544c', fontSize: '13px' }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <textarea
                        placeholder="提出问题，获得来自书籍的解答..."
                        value={aiQuestion}
                        onChange={(event) => setAIQuestion(event.target.value)}
                        rows={3}
                        style={{ flex: 1, resize: 'none', background: '#fff', border: '1px solid #d7cec0', borderRadius: '16px', padding: '14px 16px', color: '#3a332d' }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAskAI()}
                        disabled={!aiQuestion.trim() || aiLoading}
                        style={{ minWidth: '82px', height: '42px', borderRadius: '999px', border: 'none', background: '#44a6ff', color: '#fff', padding: '0 16px', fontWeight: 600 }}
                      >
                        发送问题
                      </button>
                    </div>
                  </>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderTop: '1px solid #ddd', background: '#f5f5f5' }}>
        <button onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? '隐藏目录' : '显示目录'}
        </button>
      </div>
    </div>
  );
}
