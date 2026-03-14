import { useBookStore } from '../store';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnnotationToolbar from '../components/AnnotationToolbar';

interface Chapter {
  id: string;
  title: string;
  content: string;
}

export default function Reader() {
  const navigate = useNavigate();
  const currentBook = useBookStore((state) => state.currentBook);
  const [content, setContent] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!currentBook || !window.electronAPI) return;

    window.electronAPI.getBookContent(currentBook.id).then((data) => {
      setContent(data.content);
      setChapters(data.chapters || []);
    });
  }, [currentBook]);

  const handleAnnotate = (style: string) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().length === 0) return;

    // TODO: 实现标注功能
    console.log('标注样式:', style, '选中文本:', selection.toString());
  };

  const handlePlay = async () => {
    if (!content) return;
    await window.electronAPI.player.play(content);
    setIsPlaying(true);
  };

  const handlePause = async () => {
    await window.electronAPI.player.pause();
    setIsPlaying(false);
  };

  const handleStop = async () => {
    await window.electronAPI.player.stop();
    setIsPlaying(false);
  };

  if (!currentBook) return <div>请选择书籍</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部工具栏 */}
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
        {/* 侧边栏 - 目录 */}
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

        {/* 主内容区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 标注工具栏 */}
          <div style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
            <AnnotationToolbar onAnnotate={handleAnnotate} />
          </div>

          {/* 文本内容 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', lineHeight: '1.8' }}>
            {content}
          </div>
        </div>
      </div>

      {/* 底部TTS控制栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderTop: '1px solid #ddd', background: '#f5f5f5' }}>
        <button onClick={handlePlay} disabled={isPlaying}>▶ 播放</button>
        <button onClick={handlePause} disabled={!isPlaying}>⏸ 暂停</button>
        <button onClick={handleStop}>⏹ 停止</button>
        <button onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? '隐藏目录' : '显示目录'}
        </button>
      </div>
    </div>
  );
}
