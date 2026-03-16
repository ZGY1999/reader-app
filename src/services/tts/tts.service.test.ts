import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'stream';
import { webcrypto } from 'crypto';

const setMetadata = vi.fn();
const toStream = vi.fn();

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: {
    AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mock-format',
  },
  MsEdgeTTS: vi.fn().mockImplementation(() => ({
    setMetadata,
    toStream,
  })),
}));

import { TTSService } from './tts.service';

describe('TTSService', () => {
  beforeEach(() => {
    setMetadata.mockReset();
    toStream.mockReset();
  });

  it('hydrates web crypto in electron main environments that do not expose global crypto', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    new TTSService();

    expect(globalThis.crypto).toBe(webcrypto);

    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    } else {
      delete (globalThis as { crypto?: Crypto }).crypto;
    }
  });

  it('configures the speech engine with the selected voice before streaming audio', async () => {
    const audioStream = new PassThrough();
    toStream.mockReturnValue({ audioStream });
    setMetadata.mockResolvedValue(undefined);

    const service = new TTSService();
    const synthesizePromise = service.synthesize({
      text: 'hello world',
      voice: 'zh-CN-XiaoxiaoNeural',
      rate: 1.2,
    });

    audioStream.end(Buffer.from([1, 2, 3]));

    const result = await synthesizePromise;

    expect(setMetadata).toHaveBeenCalledWith('zh-CN-XiaoxiaoNeural', 'mock-format');
    expect(toStream).toHaveBeenCalledWith('hello world', { rate: '+20%' });
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });
});
