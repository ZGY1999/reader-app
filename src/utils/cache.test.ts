import { LRUCache } from './cache';

describe('LRUCache', () => {
  it('应该存储和获取值', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('应该在超过容量时移除最旧的项', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('应该在访问时更新项的顺序', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('应该清空缓存', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });
});
