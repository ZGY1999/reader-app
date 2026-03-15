import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Bookshelf from '../src/renderer/src/pages/Bookshelf';

describe('Bookshelf', () => {
  beforeEach(() => {
    window.electronAPI = {
      importBook: vi.fn(),
      getBooks: vi.fn().mockResolvedValue([]),
      getBook: vi.fn(),
      getBookContent: vi.fn(),
      saveProgress: vi.fn(),
      getProgress: vi.fn(),
      settings: {
        save: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      },
    };
  });

  it('renders the bookshelf title', async () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );

    expect(await screen.findByRole('heading', { name: '书架' })).toBeDefined();
  });

  it('shows an empty bookshelf message', async () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );

    expect(await screen.findByText('暂无书籍')).toBeDefined();
  });

  it('allows importing txt, epub, and pdf files', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const input = {
      type: '',
      accept: '',
      onchange: null,
      click: vi.fn(),
    } as unknown as HTMLInputElement;

    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName === 'input') {
          return input;
        }
        return originalCreateElement(tagName);
      }) as typeof document.createElement);

    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.electronAPI.getBooks).toHaveBeenCalled();
    });

    screen.getByRole('button', { name: '导入书籍' }).click();

    expect(createElementSpy).toHaveBeenCalledWith('input');
    expect(input.accept).toBe('.txt,.epub,.pdf');
    expect(input.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('shows an error message when importing fails', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const input = {
      type: '',
      accept: '',
      onchange: null,
      click: vi.fn(),
    } as unknown as HTMLInputElement;

    vi.mocked(window.electronAPI.importBook).mockResolvedValue({
      success: false,
      error: 'Unsupported book format',
    });

    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName === 'input') {
          return input;
        }
        return originalCreateElement(tagName);
      }) as typeof document.createElement);

    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(window.electronAPI.getBooks).toHaveBeenCalled();
    });

    screen.getByRole('button', { name: '导入书籍' }).click();

    await act(async () => {
      await input.onchange?.({
        target: {
          files: [{ path: 'broken.docx' }],
        },
      } as unknown as Event);
    });

    expect(await screen.findByText('Unsupported book format')).toBeDefined();

    createElementSpy.mockRestore();
  });
});
