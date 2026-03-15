import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/renderer/src/App';
import Settings from '../src/renderer/src/pages/Settings';

describe('Settings route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    window.location.hash = '#/settings';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--font-size');
    document.documentElement.style.removeProperty('--line-height');
    document.documentElement.style.removeProperty('--font-family');

    window.electronAPI = {
      importBook: vi.fn(),
      getBooks: vi.fn().mockResolvedValue([]),
      getBook: vi.fn(),
      getBookContent: vi.fn(),
      saveProgress: vi.fn(),
      getProgress: vi.fn(),
      ai: {
        getStatus: vi.fn(),
        ask: vi.fn(),
      },
      annotations: {
        create: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
      },
      settings: {
        save: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        getAll: vi.fn().mockResolvedValue({
          fontSize: '16',
          lineHeight: '1.8',
          theme: 'light',
          aiApiKey: 'stored-key',
          aiBaseUrl: 'https://api.test.com/v1',
          ttsVoice: 'en-US-JennyNeural',
          ttsRate: '1.4',
        }),
      },
      tts: {
        synthesize: vi.fn(),
      },
    };
  });

  it('renders the settings page at /settings', async () => {
    render(<App />);
    expect(await screen.findByText('设置')).toBeDefined();
  });

  it('loads settings through electronAPI.settings.getAll', async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(window.electronAPI.settings.getAll).toHaveBeenCalled();
    });

    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('16px');
    expect(document.documentElement.style.getPropertyValue('--line-height')).toBe('1.8');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('saves theme through electronAPI.settings.save and applies it', async () => {
    render(<Settings />);

    fireEvent.click(screen.getByLabelText('夜间'));

    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('theme', 'dark');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('loads and saves AI settings through electronAPI.settings.save', async () => {
    render(<Settings />);

    const apiKeyInput = await screen.findByLabelText('AI API Key');
    const baseUrlInput = screen.getByLabelText('AI Base URL');

    expect((apiKeyInput as HTMLInputElement).value).toBe('stored-key');
    expect((baseUrlInput as HTMLInputElement).value).toBe('https://api.test.com/v1');

    fireEvent.change(apiKeyInput, { target: { value: 'new-key' } });
    fireEvent.change(baseUrlInput, { target: { value: 'https://api.example.com/v1' } });

    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('aiApiKey', 'new-key');
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('aiBaseUrl', 'https://api.example.com/v1');
    });
  });

  it('loads and saves TTS settings through electronAPI.settings.save', async () => {
    render(<Settings />);

    const voiceInput = await screen.findByLabelText('TTS Voice');
    const rateInput = screen.getByLabelText(/TTS Rate/);

    expect((voiceInput as HTMLInputElement).value).toBe('en-US-JennyNeural');
    expect((rateInput as HTMLInputElement).value).toBe('1.4');
    expect(screen.getByText('1.4x')).toBeDefined();

    fireEvent.change(voiceInput, { target: { value: 'zh-CN-XiaoxiaoNeural' } });
    fireEvent.change(rateInput, { target: { value: '0.8' } });

    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('ttsVoice', 'zh-CN-XiaoxiaoNeural');
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('ttsRate', '0.8');
    });
  });

  it('shows AI and TTS configuration summaries without embedding reading tools', async () => {
    render(<Settings />);

    expect(await screen.findByText('当前状态：已配置')).toBeDefined();
    expect(screen.getByText('当前将使用 stored-key 连接 https://api.test.com/v1')).toBeDefined();
    expect(screen.getByText('当前配置：en-US-JennyNeural / 1.4x')).toBeDefined();
    expect(screen.getAllByText(/保存即生效/).length).toBeGreaterThan(0);
    expect(screen.getByText('AI 配置')).toBeDefined();
    expect(screen.getByText('TTS 配置')).toBeDefined();
    expect(screen.queryByPlaceholderText('提出问题，获得来自书籍的解答...')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送问题' })).toBeNull();
  });
});
