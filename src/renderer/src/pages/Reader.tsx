import { useBookStore } from '../store';
import { useEffect, useState } from 'react';
import TextRenderer from '../components/TextRenderer';
import * as fs from 'fs';

export default function Reader() {
  const currentBook = useBookStore((state) => state.currentBook);
  const [content, setContent] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!currentBook || !window.electronAPI) return;

    window.electronAPI.getProgress(currentBook.id).then((progress) => {
      if (progress) setOffset(progress.offset);
    });

    fetch(`file://${currentBook.path}`)
      .then(res => res.text())
      .then(setContent);
  }, [currentBook]);

  const handleScroll = (e: any) => {
    const newOffset = e.target.scrollTop;
    setOffset(newOffset);
    if (currentBook) {
      const progress = newOffset / e.target.scrollHeight;
      window.electronAPI.saveProgress({
        bookId: currentBook.id,
        chapterId: '',
        offset: newOffset,
        progress
      });
    }
  };

  if (!currentBook) return <div>请选择书籍</div>;

  return (
    <div onScroll={handleScroll} style={{ height: '100vh', overflow: 'auto' }}>
      <h1>{currentBook.title}</h1>
      <TextRenderer content={content} />
    </div>
  );
}
