import { describe, expect, it } from 'vitest';
import { categoryEmoji } from '@/lib/category-emoji';

describe('品类 emoji', () => {
  it('关键词映射', () => {
    expect(categoryEmoji('粉面')).toBe('🍜');
    expect(categoryEmoji('米线')).toBe('🍜');
    expect(categoryEmoji('米饭')).toBe('🍚');
    expect(categoryEmoji('快餐')).toBe('🍚');
    expect(categoryEmoji('园区食堂')).toBe('🍲');
    expect(categoryEmoji('档口')).toBe('🥘');
    expect(categoryEmoji('便利店')).toBe('🥡');
    expect(categoryEmoji('打包')).toBe('🥡');
    expect(categoryEmoji('咖喱饭')).toBe('🍛');
  });

  it('默认值与多候选回退', () => {
    expect(categoryEmoji('早餐')).toBe('🍚');
    expect(categoryEmoji(undefined, '早餐', '米饭')).toBe('🍚');
    expect(categoryEmoji(null, '咖喱')).toBe('🍛');
    expect(categoryEmoji('')).toBe('🍚');
  });
});
