import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerService } from '../../services/tts/player.service';
import { HighlightService } from '../../services/tts/highlight.service';

describe('服务集成测试', () => {
  let playerService: PlayerService;
  let highlightService: HighlightService;

  beforeEach(() => {
    playerService = new PlayerService();
    highlightService = new HighlightService();
  });

  it('播放器服务可以控制状态', () => {
    expect(playerService.getState()).toBe('stopped');

    playerService.setRate(1.5);
    expect(playerService.getProgress()).toBe(0);
  });

  it('高亮服务可以计算进度', () => {
    const result = highlightService.updateProgress(0.5, 100);
    expect(result.startOffset).toBe(50);
    expect(result.endOffset).toBeLessThanOrEqual(100);
  });
});
