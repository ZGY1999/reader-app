import { useState, useEffect } from 'react';
import './reader.css';

interface ReaderProps {
  content: string;
  bookId: string;
}

export default function Reader({ content, bookId }: ReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const handleProgress = (_event: any, data: { index: number }) => {
      setCurrentIndex(data.index);
    };

    window.electron.ipcRenderer.on('tts-progress', handleProgress);
    return () => {
      window.electron.ipcRenderer.removeListener('tts-progress', handleProgress);
    };
  }, []);

  const handlePlay = async () => {
    await window.electronAPI.ttsSpeak(content);
    setIsPlaying(true);
  };

  const handlePause = async () => {
    await window.electronAPI.ttsPause();
    setIsPlaying(false);
  };

  const handleStop = async () => {
    await window.electronAPI.ttsStop();
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const renderContent = () => {
    return content.split('').map((char, index) => (
      <span key={index} className={index === currentIndex ? 'highlight' : ''}>
        {char}
      </span>
    ));
  };

  return (
    <div className="reader">
      <div className="content">{renderContent()}</div>
      <div className="controls">
        <button onClick={handlePlay} disabled={isPlaying}>播放</button>
        <button onClick={handlePause} disabled={!isPlaying}>暂停</button>
        <button onClick={handleStop}>停止</button>
      </div>
    </div>
  );
}
