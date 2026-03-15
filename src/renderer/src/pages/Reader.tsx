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

interface StatusCard {
  status: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
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
  const [ttsState, setTTSState] = useState<TTSState>({
    status: 'idle',
    sourceLabel: '当前章节',
    error: '',
  });
  const [ttsHighlightRange, setTTSHighlightRange] = useState<{ startOffset: number; endOffset: number } | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
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
  const ttsReady = chapterRanges.length > 0 || content.trim().length > 0;

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

  const aiCard = useMemo<StatusCard>(() => {
    if (!aiConfigured) {
      return {
        status: '未配置',
        description: '需要先在设置页填写 AI API Key，保存后即可在阅读页提问。',
        actionLabel: '去设置配置 AI',
        onAction: () => navigate('/settings'),
      };
    }

    if (aiLoading) {
      return {
        status: '处理中',
        description: '正在根据当前书籍内容生成回答和引用来源。',
      };
    }

    if (aiError) {
      return {
        status: '请求失败',
        description: aiError,
        actionLabel: '重新提问',
        onAction: () => void handleAskAI(),
      };
    }

    if (aiAnswer) {
      return {
        status: '可使用',
        description: '回答已生成，可继续提问，或根据引用来源回到正文核对内容。',
      };
    }

    return {
      status: '可使用',
      description: '可以直接针对当前书籍提问，回答会附带对应引用来源。',
    };
  }, [aiAnswer, aiConfigured, aiError, aiLoading, navigate]);

  const ttsCard = useMemo<StatusCard>(() => {
    if (!ttsReady) {
      return {
        status: '准备中',
        description: '正文还在加载中，加载完成后即可从当前章节、选中文本或当前标注开始朗读。',
      };
    }

    if (ttsState.status === 'loading') {
      return {
        status: '处理中',
        description: '正在合成音频并准备播放。',
      };
    }

    if (ttsState.error) {
      return {
        status: '失败',
        description: ttsState.error,
        actionLabel: '重新尝试',
        onAction: () => void handlePlayTTS(),
      };
    }

    return {
      status: '可使用',
      description: '可直接朗读当前章节、选中文本或当前标注，设置修改后会立即生效。',
    };
  }, [ttsReady, ttsState.error, ttsState.status]);

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
      setTTSState({
        status: 'idle',
        sourceLabel: payload.chapters?.[0]?.title ?? '当前章节',
        error: '',
      });
      setTTSHighlightRange(null);
      setPendingOffset(savedProgress?.offset ?? null);
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
  };

  const clearActiveAnnotationState = () => {
    setPendingSelection(null);
    setSelectedAnnotation(null);
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
  };

  const handleSelectAnnotation = (annotation: Annotation) => {
    setPendingSelection(null);
    setSelectedAnnotation(annotation);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px', borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
        <button onClick={() => navigate('/')} style={{ marginRight: '10px' }}>← 返回书架</button>
        <h2 style={{ flex: 1, margin: 0 }}>{currentBook.title}</h2>
        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginRight: '10px', padding: '5px' }}
        />
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

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
            <AnnotationToolbar
              onAnnotate={handleAnnotate}
              selectionText={pendingSelection?.text}
              selectedAnnotationText={selectedAnnotation?.text}
              disabled={!pendingSelection || !!selectedAnnotation}
              onDeleteAnnotation={selectedAnnotation ? handleDeleteAnnotation : undefined}
              onClearActive={pendingSelection || selectedAnnotation ? clearActiveAnnotationState : undefined}
            />
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#fcfcfc' }}>
            <h3 style={{ margin: '0 0 8px' }}>AI 问书</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#595959' }}>状态：{aiCard.status}</p>
                <p style={{ margin: 0, color: aiCard.status === '请求失败' ? '#cf1322' : '#434343', fontSize: '14px' }}>
                  {aiCard.description}
                </p>
                {aiCard.actionLabel ? (
                  <div style={{ marginTop: '10px' }}>
                    <button type="button" onClick={aiCard.onAction}>
                      {aiCard.actionLabel}
                    </button>
                  </div>
                ) : null}
              </div>
              {aiConfigured ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <textarea
                  placeholder="针对当前书籍提问..."
                  value={aiQuestion}
                  onChange={(event) => setAIQuestion(event.target.value)}
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" disabled={!aiQuestion.trim() || aiLoading} onClick={() => void handleAskAI()}>
                    {aiLoading ? '回答中...' : '发送提问'}
                  </button>
                </div>
                {aiError ? <p role="alert" style={{ margin: 0, color: '#cf1322' }}>{aiError}</p> : null}
                {aiAnswer ? (
                  <div data-testid="ai-answer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0, color: '#1f1f1f' }}>{aiAnswer}</p>
                    {aiCitations.length > 0 ? (
                      <div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '6px' }}>引用来源</div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {aiCitations.map((citation) => (
                            <li key={citation.chunkId} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '6px', padding: '8px 10px' }}>
                              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>{citation.chapterTitle}</div>
                              <div style={{ fontSize: '13px', color: '#1f1f1f' }}>{citation.text}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', background: '#f8fbff' }}>
            <h3 style={{ margin: '0 0 8px' }}>TTS 朗读</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ background: '#fff', border: '1px solid #d6e4ff', borderRadius: '8px', padding: '12px 14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#595959' }}>状态：{ttsCard.status}</p>
                <p style={{ margin: 0, color: ttsCard.status === '失败' ? '#cf1322' : '#434343', fontSize: '14px' }}>
                  {ttsCard.description}
                </p>
                {ttsCard.actionLabel ? (
                  <div style={{ marginTop: '10px' }}>
                    <button type="button" onClick={ttsCard.onAction}>
                      {ttsCard.actionLabel}
                    </button>
                  </div>
                ) : null}
              </div>
              <p style={{ margin: 0, color: '#595959', fontSize: '13px' }}>当前来源：{ttsState.sourceLabel}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ttsState.status === 'idle' || ttsState.status === 'loading' ? (
                  <button type="button" disabled={ttsState.status === 'loading' || !ttsReady} onClick={() => void handlePlayTTS()}>
                    {ttsState.status === 'loading' ? '准备中...' : '开始朗读'}
                  </button>
                ) : null}
                {ttsState.status === 'playing' ? (
                  <button type="button" onClick={handlePauseTTS}>暂停</button>
                ) : null}
                {ttsState.status === 'paused' ? (
                  <button type="button" onClick={() => void handleResumeTTS()}>继续</button>
                ) : null}
                {ttsState.status === 'playing' || ttsState.status === 'paused' ? (
                  <button type="button" onClick={handleStopTTS}>停止</button>
                ) : null}
              </div>
              {ttsState.error ? <p role="alert" style={{ margin: 0, color: '#cf1322' }}>{ttsState.error}</p> : null}
            </div>
          </div>

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
                    <h3 style={{ margin: '0 0 12px' }}>{chapter.title}</h3>
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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderTop: '1px solid #ddd', background: '#f5f5f5' }}>
        <button onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? '隐藏目录' : '显示目录'}
        </button>
      </div>
    </div>
  );
}
