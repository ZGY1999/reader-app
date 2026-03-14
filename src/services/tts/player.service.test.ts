import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerService, PlayerState } from './player.service';
import { TTSService } from './tts.service';

vi.mock('./tts.service');

describe('PlayerService', () => {
  let player: PlayerService;
  let mockTTS: any;

  beforeEach(() => {
    mockTTS = {
      synthesize: vi.fn().mockResolvedValue(undefined)
    };
    player = new PlayerService(mockTTS);
  });

  it('初始状态应该是 STOPPED', () => {
    expect(player.getState()).toBe(PlayerState.STOPPED);
  });

  it('播放后状态应该变为 PLAYING', async () => {
    await player.play('测试文本');
    expect(player.getState()).toBe(PlayerState.PLAYING);
  });

  it('暂停后状态应该变为 PAUSED', async () => {
    await player.play('测试文本');
    player.pause();
    expect(player.getState()).toBe(PlayerState.PAUSED);
  });

  it('恢复后状态应该变为 PLAYING', async () => {
    await player.play('测试文本');
    player.pause();
    player.resume();
    expect(player.getState()).toBe(PlayerState.PLAYING);
  });

  it('停止后状态应该变为 STOPPED', async () => {
    await player.play('测试文本');
    player.stop();
    expect(player.getState()).toBe(PlayerState.STOPPED);
  });

  it('应该支持设置语速', async () => {
    player.setRate(1.5);
    await player.play('测试文本');
    expect(player.getState()).toBe(PlayerState.PLAYING);
  });

  it('停止状态时进度应该是 0%', () => {
    expect(player.getProgress()).toBe(0);
  });

  it('播放状态时进度应该大于 0%', async () => {
    await player.play('测试文本');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(player.getProgress()).toBeGreaterThan(0);
  });

  it('暂停状态时进度应该保持不变', async () => {
    await player.play('测试文本');
    const progressBeforePause = player.getProgress();
    player.pause();
    const progressAfterPause = player.getProgress();
    expect(progressAfterPause).toBe(progressBeforePause);
  }, { timeout: 30000 });

  it('停止后进度应该重置为 0%', async () => {
    await player.play('测试文本');
    player.stop();
    expect(player.getProgress()).toBe(0);
  });

  it('setRate 应该验证范围 0.5-2.0', () => {
    expect(() => player.setRate(0.3)).toThrow('语速必须在 0.5 到 2.0 之间');
    expect(() => player.setRate(2.5)).toThrow('语速必须在 0.5 到 2.0 之间');
    expect(() => player.setRate(1.5)).not.toThrow();
  });

  it('非 PAUSED 状态调用 resume 应该抛出错误', () => {
    expect(() => player.resume()).toThrow('只能在暂停状态下恢复播放');
  });

  it('TTS 失败时状态应该保持 STOPPED', async () => {
    mockTTS.synthesize.mockRejectedValue(new Error('TTS 失败'));
    await expect(player.play('测试文本')).rejects.toThrow('TTS 失败');
    expect(player.getState()).toBe(PlayerState.STOPPED);
  });
});
