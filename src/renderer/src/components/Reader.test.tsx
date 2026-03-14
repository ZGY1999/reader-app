import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Reader from './Reader';

describe('Reader', () => {
  beforeEach(() => {
    global.window.electronAPI = {
      ttsSpeak: vi.fn(),
      ttsPause: vi.fn(),
      ttsStop: vi.fn()
    };
    global.window.electron = {
      ipcRenderer: {
        on: vi.fn(),
        removeListener: vi.fn()
      }
    };
  });

  it('渲染内容', () => {
    const { container } = render(<Reader content="测试文本" bookId="book1" />);
    expect(container.textContent).toContain('测试文本');
  });

  it('点击播放按钮调用TTS', async () => {
    render(<Reader content="测试" bookId="book1" />);
    const playBtn = screen.getByText('播放');
    fireEvent.click(playBtn);
    await waitFor(() => {
      expect(window.electronAPI.ttsSpeak).toHaveBeenCalledWith('测试');
    });
  });

  it('点击停止按钮调用TTS停止', async () => {
    render(<Reader content="测试" bookId="book1" />);
    const stopBtn = screen.getByText('停止');
    fireEvent.click(stopBtn);
    await waitFor(() => {
      expect(window.electronAPI.ttsStop).toHaveBeenCalled();
    });
  });
});
