import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('应该渲染书架标题', async () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );
    expect(await screen.findByText('书架')).toBeDefined();
  });

  it('应该显示空书架提示', async () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );
    expect(await screen.findByText('暂无书籍')).toBeDefined();
  });

  it('应该允许导入 txt、epub 和 pdf 文件', async () => {
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

    screen.getByText('导入书籍').click();

    expect(createElementSpy).toHaveBeenCalledWith('input');
    expect(input.accept).toBe('.txt,.epub,.pdf');
    expect(input.click).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
