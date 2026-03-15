import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnnotationToolbar from '../components/AnnotationToolbar';
import TextRenderer from '../components/TextRenderer';
import { api } from '../api';
import { useBookStore } from '../store';
import { Chapter } from '../types';

export default function Reader() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const setReading = useBookStore((state) => state.setReading);
  const [content, setContent] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!currentBook) return;

    let disposed = false;

    const loadReading = async () => {
      const [payload, savedProgress] = await Promise.all([
        api.getBookContent(currentBook.id),
        api.getProgress(currentBook.id),
      ]);

      if (disposed) return;

      setReading(payload);
      setContent(payload.content);
      setChapters(payload.chapters || []);
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
    setPendingOffset(null);
  }, [content, pendingOffset]);

  const handleAnnotate = (style: string) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) return;

    console.log('Annotation style:', style, 'Selected text:', selection.toString());
  };

  const handleContentScroll = () => {
    if (!currentBook || !contentContainerRef.current) return;

    const scrollContainer = contentContainerRef.current;
    const maxOffset = Math.max(scrollContainer.scrollHeight - scrollContainer.clientHeight, 0);
    const offset = scrollContainer.scrollTop;
    const progress = maxOffset === 0 ? 0 : offset / maxOffset;

    void api.saveProgress({
      bookId: currentBook.id,
      chapterId: chapters[0]?.id,
      offset,
      progress,
    });
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
            {chapters.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {chapters.map((chapter) => (
                  <li key={chapter.id} style={{ padding: '5px 0', cursor: 'pointer' }}>
                    {chapter.title}
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
            <TextRenderer content={content} />
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
