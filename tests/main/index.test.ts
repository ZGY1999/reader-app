import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandle = vi.fn();
const mockCreateWindow = vi.fn();

vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    getPath: vi.fn(() => '/tmp'),
    quit: vi.fn(),
  },
  ipcMain: {
    handle: mockHandle,
  },
}));

vi.mock('../../src/database/sqlite', () => ({
  Database: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../../src/main/window-manager', () => ({
  WindowManager: vi.fn().mockImplementation(() => ({
    createWindow: mockCreateWindow,
  })),
}));

vi.mock('../../src/main/ipc/book.handler', () => ({
  BookHandler: vi.fn().mockImplementation(() => ({
    importBook: vi.fn(),
    getBooks: vi.fn(),
    getBook: vi.fn(),
    getBookContent: vi.fn(),
    saveProgress: vi.fn(),
    getProgress: vi.fn(),
  })),
}));

vi.mock('../../src/main/ipc/annotation.handler', () => ({
  AnnotationHandler: vi.fn().mockImplementation(() => ({
    createAnnotation: vi.fn(),
    getAnnotations: vi.fn(),
    deleteAnnotation: vi.fn(),
  })),
}));

vi.mock('../../src/main/ipc/settings.handler', () => ({
  SettingsHandler: vi.fn().mockImplementation(() => ({
    saveSetting: vi.fn(),
    getSetting: vi.fn(),
    getAllSettings: vi.fn(),
  })),
}));

vi.mock('../../src/main/ipc/ai.handler', () => ({
  AIHandler: vi.fn().mockImplementation(() => ({
    getStatus: vi.fn(),
    ask: vi.fn(),
  })),
}));

vi.mock('../../src/services/tts/tts.service', () => ({
  TTSService: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn(),
  })),
}));

describe('Main Process', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHandle.mockClear();
    mockCreateWindow.mockClear();
  });

  it('registers only the public AI and TTS handlers for the reading flow', async () => {
    await import('../../src/main/index');
    await Promise.resolve();

    const registeredChannels = mockHandle.mock.calls.map((call) => call[0]);

    expect(registeredChannels).toContain('ai:getStatus');
    expect(registeredChannels).toContain('ai:ask');
    expect(registeredChannels).toContain('tts:synthesize');
    expect(registeredChannels).not.toContain('player:play');
    expect(registeredChannels).not.toContain('player:pause');
    expect(registeredChannels).not.toContain('player:resume');
    expect(registeredChannels).not.toContain('player:stop');
    expect(registeredChannels).not.toContain('player:getState');
    expect(registeredChannels).not.toContain('player:getProgress');
    expect(registeredChannels).not.toContain('player:setRate');
    expect(registeredChannels).not.toContain('highlight:updateProgress');
    expect(mockCreateWindow).toHaveBeenCalled();
  });
});
