import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/renderer/src/App';
import Settings from '../src/renderer/src/pages/Settings';
import { useBookStore } from '../src/renderer/src/store';

const currentBook = {
  id: 'book-1',
  title: 'Test Book',
  format: 'txt' as const,
  filePath: '/test.txt',
};

const readingPayload = {
  book: currentBook,
  content: 'Chapter one content',
  chapters: [
    {
      id: 'ch-1',
      title: 'Chapter 1',
      content: 'Chapter one content',
    },
  ],
};

describe('Settings route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    window.location.hash = '#/settings';

    useBookStore.setState({
      books: [],
      currentBook: null,
      reading: null,
    });

    window.electronAPI = {
      importBook: vi.fn(),
      deleteBook: vi.fn(),
      getBooks: vi.fn().mockResolvedValue([]),
      getBook: vi.fn(),
      getBookContent: vi.fn().mockResolvedValue(readingPayload),
      saveProgress: vi.fn(),
      getProgress: vi.fn(),
      ai: {
        getStatus: vi.fn().mockResolvedValue({ configured: false }),
        ask: vi.fn(),
      },
      annotations: {
        create: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
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

  const renderSettings = () => render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );

  it('renders the settings page at /settings', async () => {
    render(<App />);
    expect(await screen.findByTestId('settings-hero')).toBeDefined();
  });

  it('shows a settings header and card layout', async () => {
    renderSettings();

    expect(await screen.findByTestId('settings-hero')).toBeDefined();
    expect(screen.getByTestId('settings-card-reading')).toBeDefined();
    expect(screen.getByTestId('settings-card-ai')).toBeDefined();
    expect(screen.getByTestId('settings-card-tts')).toBeDefined();
  });

  it('returns to the reader page when the current book exists', async () => {
    useBookStore.getState().setCurrentBook(currentBook);

    render(<App />);

    fireEvent.click((await screen.findByTestId('settings-hero')).querySelector('.settings-back-button') as HTMLButtonElement);

    await screen.findByText('Test Book');
    expect(window.location.hash).toBe('#/reader');
  });

  it('loads settings without applying global font variables to the whole document', async () => {
    renderSettings();

    await waitFor(() => {
      expect(window.electronAPI.settings.getAll).toHaveBeenCalled();
    });

    expect(document.documentElement.style.getPropertyValue('--font-size')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--line-height')).toBe('');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('saves theme through electronAPI.settings.save', async () => {
    renderSettings();

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);

    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  it('loads and saves AI settings through electronAPI.settings.save', async () => {
    renderSettings();

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
    renderSettings();

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
    renderSettings();

    const aiCard = await screen.findByTestId('settings-card-ai');
    const ttsCard = screen.getByTestId('settings-card-tts');

    expect(aiCard.textContent).toContain('stored-key');
    expect(aiCard.textContent).toContain('https://api.test.com/v1');
    expect(aiCard.textContent).toContain('AI API Key');
    expect(aiCard.textContent).toContain('AI Base URL');
    expect(ttsCard.textContent).toContain('en-US-JennyNeural');
    expect(ttsCard.textContent).toContain('1.4x');
    expect(aiCard.textContent?.length || 0).toBeGreaterThan(20);
    expect(ttsCard.textContent?.length || 0).toBeGreaterThan(20);
    expect(screen.queryByPlaceholderText('提出问题，获得来自书籍的解答...')).toBeNull();
    expect(screen.queryByRole('button', { name: '发送问题' })).toBeNull();
  });

  it('restores reading preferences to defaults', async () => {
    renderSettings();

    fireEvent.click((await screen.findByTestId('settings-card-reading')).querySelector('.settings-reset-button') as HTMLButtonElement);

    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('fontSize', '16');
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('lineHeight', '1.8');
      expect(window.electronAPI.settings.save).toHaveBeenCalledWith('theme', 'light');
    });

    const readingCard = screen.getByTestId('settings-card-reading');
    const fontSizeInput = readingCard.querySelector('#font-size') as HTMLInputElement;
    const lineHeightInput = readingCard.querySelector('#line-height') as HTMLInputElement;

    expect(fontSizeInput.value).toBe('16');
    expect(lineHeightInput.value).toBe('1.8');
  });
});

