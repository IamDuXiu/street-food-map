import { describe, expect, it } from 'vitest';
import { methodLabel, placeTrust, verificationLevelForMethod } from '@/lib/trust';

describe('可信度派生', () => {
  it('核验方式映射到可信等级', () => {
    expect(verificationLevelForMethod('onsite_menu')).toBe('高可信');
    expect(verificationLevelForMethod('receipt')).toBe('高可信');
    expect(verificationLevelForMethod('official_menu')).toBe('中高可信');
    expect(verificationLevelForMethod('community_confirmed')).toBe('中高可信');
    expect(verificationLevelForMethod('phone_check')).toBe('中可信');
    expect(verificationLevelForMethod('unknown')).toBe('中可信');
  });

  it('核验方式中文标签', () => {
    expect(methodLabel('onsite_menu')).toBe('现场价签');
    expect(methodLabel('receipt')).toBe('消费小票');
    expect(methodLabel('official_menu')).toBe('官方菜单');
    expect(methodLabel('phone_check')).toBe('电话核验');
    expect(methodLabel('community_confirmed')).toBe('双人确认');
    expect(methodLabel('external_lead')).toBe('线索');
  });

  it('地点取最高等级并统计核验次数', () => {
    expect(
      placeTrust([{ method: 'onsite_menu' }, { method: 'phone_check' }]),
    ).toEqual({ level: '高可信', verifiedCount: 2 });
    expect(
      placeTrust([{ method: 'official_menu' }, { method: 'phone_check' }]),
    ).toEqual({ level: '中高可信', verifiedCount: 2 });
    expect(placeTrust([{ method: 'phone_check' }])).toEqual({
      level: '中可信',
      verifiedCount: 1,
    });
    expect(placeTrust([])).toEqual({ level: '中可信', verifiedCount: 0 });
  });
});
