import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { TTSService } from './tts.service';

vi.mock('msedge-tts', () => {
  return {
    MsEdgeTTS: vi.fn().mockImplementation(() => ({
      setMetadata: vi.fn(),
      toStream: vi.fn(),
    })),
    OUTPUT_FORMAT: {
      AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3',
    },
  };
});

describe('TTSService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该创建 TTSService 实例', () => {
    const service = new TTSService();
    expect(service).toBeDefined();
  });

  it('应该在文本为空时抛出错误', async () => {
    const service = new TTSService();
    await expect(service.synthesize({ text: '' })).rejects.toThrow('文本不能为空');
  });

  it('应该返回音频 Buffer', async () => {
    const service = new TTSService();
    const mockAudioStream = new EventEmitter();
    const audioBuffer = Buffer.from('mock audio data');

    vi.mocked(service['tts'].toStream).mockReturnValue({
      audioStream: mockAudioStream,
    });

    const resultPromise = service.synthesize({ text: '你好' });

    setTimeout(() => {
      mockAudioStream.emit('data', audioBuffer);
      mockAudioStream.emit('end');
    }, 0);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(audioBuffer);
  });

  it('应该使用自定义 voice 参数', async () => {
    const service = new TTSService();
    const mockAudioStream = new EventEmitter();
    const customVoice = 'en-US-AriaNeural';

    vi.mocked(service['tts'].toStream).mockReturnValue({
      audioStream: mockAudioStream,
    });

    const resultPromise = service.synthesize({ text: '你好', voice: customVoice });

    setTimeout(() => {
      mockAudioStream.emit('data', Buffer.from('audio'));
      mockAudioStream.emit('end');
    }, 0);

    await resultPromise;
    expect(service['tts'].setMetadata).toHaveBeenCalledWith(customVoice, 'audio-24khz-48kbitrate-mono-mp3');
  });

  it('应该使用默认 voice 参数', async () => {
    const service = new TTSService();
    const mockAudioStream = new EventEmitter();

    vi.mocked(service['tts'].toStream).mockReturnValue({
      audioStream: mockAudioStream,
    });

    const resultPromise = service.synthesize({ text: '你好' });

    setTimeout(() => {
      mockAudioStream.emit('data', Buffer.from('audio'));
      mockAudioStream.emit('end');
    }, 0);

    await resultPromise;
    expect(service['tts'].setMetadata).toHaveBeenCalledWith('zh-CN-XiaoxiaoNeural', 'audio-24khz-48kbitrate-mono-mp3');
  });

  it('应该正确处理 rate 参数', async () => {
    const service = new TTSService();
    const mockAudioStream = new EventEmitter();

    vi.mocked(service['tts'].toStream).mockReturnValue({
      audioStream: mockAudioStream,
    });

    const resultPromise = service.synthesize({ text: '你好', rate: 1.5 });

    setTimeout(() => {
      mockAudioStream.emit('data', Buffer.from('audio'));
      mockAudioStream.emit('end');
    }, 0);

    await resultPromise;
    expect(service['tts'].toStream).toHaveBeenCalledWith('你好', { rate: '50%' });
  });

  it('应该返回 Buffer 类型', async () => {
    const service = new TTSService();
    const mockAudioStream = new EventEmitter();

    vi.mocked(service['tts'].toStream).mockReturnValue({
      audioStream: mockAudioStream,
    });

    const resultPromise = service.synthesize({ text: '测试' });

    setTimeout(() => {
      mockAudioStream.emit('data', Buffer.from('chunk1'));
      mockAudioStream.emit('data', Buffer.from('chunk2'));
      mockAudioStream.emit('end');
    }, 0);

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe('chunk1chunk2');
  });
});
