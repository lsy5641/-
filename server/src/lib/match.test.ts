import { describe, it, expect } from 'vitest';
import { normalizeText, isHit, computeHits } from './match';

describe('match', () => {
  it('归一化：小写且去多余空白', () => {
    expect(normalizeText('Spring   Boot / Redis')).toBe('spring boot / redis');
  });
  it('英文子串命中（大小写不敏感）', () => {
    expect(isHit('熟练使用 SpringBoot 与 Redis', 'springboot')).toBe(true);
    expect(isHit('熟练使用 SpringBoot', 'Kafka')).toBe(false);
  });
  it('中文子串命中', () => {
    expect(isHit('负责高并发交易系统', '高并发')).toBe(true);
  });
  it('覆盖率统计', () => {
    const r = computeHits('使用 Java 与 Redis 开发', ['java', 'Redis', 'Kafka']);
    expect(r.hits).toEqual(['java', 'Redis']);
    expect(r.missing).toEqual(['Kafka']);
    expect(r.coveragePct).toBe(67);
  });
});