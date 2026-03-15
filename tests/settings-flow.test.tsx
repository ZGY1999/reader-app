import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/renderer/src/App';
import Settings from '../src/renderer/src/pages/Settings';

describe('Settings route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/settings');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--font-size');
    document.documentElement.style.removeProperty('--line-height');
    document.documentElement.style.removeProperty('--font-family');

    window.electronAPI = {
      importBook: vi.fn(),
      getBooks: vi.fn(),
      getBook: vi.fn(),
      getBookContent: vi.fn(),
      saveProgress: vi.fn(),
      getProgress: vi.fn(),
      settings: {
        save: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        getAll: vi.fn().mockResolvedValue({
          fontSize: '16',
          lineHeight: '1.8',
          theme: 'light',
        }),
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
});
