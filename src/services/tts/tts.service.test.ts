import { describe, it, expect, vi } from 'vitest';
import { TTSService } from './tts.service';

describe('TTSService', () => {
  it('应该在文本为空时抛出错误', async () => {
    const service = new TTSService();
    await expect(service.synthesize({ text: '' })).rejects.toThrow('文本不能为空');
  });

  it('应该创建 TTSService 实例', () => {
    const service = new TTSService();
    expect(service).toBeDefined();
  });
});
