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
    setPendingSelection(selection);
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
  };

  const handleDeleteAnnotation = async (id: string) => {
    const result = await api.annotations.delete(id);
    if (!result.success) return;

    setAnnotations((currentAnnotations) => currentAnnotations.filter((annotation) => annotation.id !== id));
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
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
            <AnnotationToolbar onAnnotate={handleAnnotate} />
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
                      onAnnotate={handleSelectionCaptured}
                      onDeleteAnnotation={handleDeleteAnnotation}
                    />
                  </section>
                ))}
              </div>
            ) : (
              <TextRenderer content={content} onAnnotate={handleSelectionCaptured} onDeleteAnnotation={handleDeleteAnnotation} />
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
