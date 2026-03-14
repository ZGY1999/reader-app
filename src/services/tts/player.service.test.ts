import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerService, PlayerState } from './player.service';

describe('PlayerService', () => {
  let player: PlayerService;

  beforeEach(() => {
    player = new PlayerService();
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
});
