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
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const chapterSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    if (!currentBook) return;

    let disposed = false;

    const loadReading = async () => {
      const [payload, savedProgress, savedAnnotations] = await Promise.all([
        api.getBookContent(currentBook.id),
        api.getProgress(currentBook.id),
        api.annotations.list(currentBook.id),
      ]);

      if (disposed) return;

      setReading(payload);
      setContent(payload.content);
      setChapters(payload.chapters || []);
      setAnnotations(savedAnnotations);
      setCurrentChapterId(savedProgress?.chapterId ?? payload.chapters?.[0]?.id ?? null);
      setPendingSelection(null);
      setSelectedAnnotation(null);
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
