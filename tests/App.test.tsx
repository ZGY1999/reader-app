import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/src/App';

describe('App', () => {
  beforeEach(() => {
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
        save: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn().mockResolvedValue({}),
      },
      tts: {
        synthesize: vi.fn(),
      },
    };
  });

  it('renders the bookshelf on the default hash route', async () => {
    window.history.pushState({}, '', '/');
    window.location.hash = '#/';

    render(<App />);

    expect(await screen.findByText('书架')).toBeDefined();
  });

  it('uses hash-based routing in the renderer', async () => {
    window.history.pushState({}, '', '/');
    window.location.hash = '#/';

    render(<App />);
    await screen.findByText('书架');

    expect(window.location.hash).toBe('#/');
  });

  it('still renders the default page when opened from a file-style path', async () => {
    window.history.pushState({}, '', '/dist/index.html');
    window.location.hash = '';

    render(<App />);

    expect(await screen.findByText('书架')).toBeDefined();
  });
});
