import { describe, expect, it } from 'vitest';
import {
  ageInDays,
  freshness,
  freshnessLabel,
  relativePublishedLabel,
  relativeVerificationLabel,
} from '@/lib/freshness';

describe('新鲜度分档', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 86400000).toISOString();

  it('30/31/90/91/180/181 边界', () => {
    expect(freshness(daysAgo(30), now)).toBe('recent');
    expect(freshness(daysAgo(31), now)).toBe('valid');
    expect(freshness(daysAgo(90), now)).toBe('valid');
    expect(freshness(daysAgo(91), now)).toBe('stale');
    expect(freshness(daysAgo(180), now)).toBe('stale');
    expect(freshness(daysAgo(181), now)).toBe('expired');
  });

  it('分档中文标签', () => {
    expect(freshnessLabel('recent')).toBe('近期核验');
    expect(freshnessLabel('valid')).toBe('有效');
    expect(freshnessLabel('stale')).toBe('可能过期');
    expect(freshnessLabel('expired')).toBe('已过期');
  });

  it('相对时间文案', () => {
    expect(relativeVerificationLabel({ observedAt: daysAgo(0) }, now)).toBe(
      '今天核验',
    );
    expect(relativeVerificationLabel({ observedAt: daysAgo(1) }, now)).toBe(
      '1 天前核验',
    );
    expect(relativeVerificationLabel({ observedAt: daysAgo(5) }, now)).toBe(
      '5 天前核验',
    );
    expect(
      relativeVerificationLabel({ observedAt: daysAgo(0), ageDays: 3 }, now),
    ).toBe('3 天前核验');
    expect(relativePublishedLabel({ observedAt: daysAgo(0) }, now)).toBe(
      '今天发布',
    );
    expect(relativePublishedLabel({ observedAt: daysAgo(2) }, now)).toBe(
      '2 天前发布',
    );
  });

  it('ageInDays 从日期字符串计算天数', () => {
    expect(ageInDays('2026-09-11', now)).toBeLessThanOrEqual(0);
    expect(ageInDays('2026-09-01', now)).toBeGreaterThanOrEqual(9);
  });
});
