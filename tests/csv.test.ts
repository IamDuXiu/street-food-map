import { describe, expect, it } from 'vitest';
import {
  BUDGET_IMPORT_DISPLAY_HEADERS,
  BUDGET_IMPORT_HEADERS,
  parseCsvRFC4180,
} from '@/lib/csv';

describe('RFC4180 CSV parser', () => {
  it('保留中文地址中的逗号、转义引号和换行', () => {
    const rows = parseCsvRFC4180('name,address,note\n店 A,"深圳, 南山","他说 ""好吃""\n但要早到"');
    expect(rows).toEqual([{ name: '店 A', address: '深圳, 南山', note: '他说 "好吃"\n但要早到' }]);
  });
  it('系统模板拒绝错误表头和列数不一致', () => {
    expect(() => parseCsvRFC4180('name,address\n店 A,地址', BUDGET_IMPORT_HEADERS)).toThrow('系统模板');
    expect(() => parseCsvRFC4180('name,address\n店 A,地址,多余列')).toThrow('列数');
  });
  it('中文显示表头会转换为系统内部字段，并兼容旧英文模板', () => {
    const values = [
      '深大粤海',
      '测试饭点',
      '南山区测试路 1 号',
      '113.93',
      '22.53',
      'GCJ-02',
      '街边快餐',
      'public',
      '鸡腿饭',
      '米饭',
      '18',
      '2026-09-03',
      'onsite_menu',
      '',
      '',
      '',
    ];
    const chinese = parseCsvRFC4180(
      `${BUDGET_IMPORT_DISPLAY_HEADERS.join(',')}\n${values.join(',')}`,
      BUDGET_IMPORT_HEADERS,
    );
    const english = parseCsvRFC4180(
      `${BUDGET_IMPORT_HEADERS.join(',')}\n${values.join(',')}`,
      BUDGET_IMPORT_HEADERS,
    );
    expect(chinese).toEqual(english);
    expect(chinese[0]).toMatchObject({
      zone_name: '深大粤海',
      place_name: '测试饭点',
      price_yuan: '18',
    });
  });
});
