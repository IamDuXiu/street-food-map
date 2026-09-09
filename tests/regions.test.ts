import { describe, expect, it } from 'vitest';
import {
  findShenzhenRegion,
  SHENZHEN_CITY,
  SHENZHEN_DISTRICTS,
  SHENZHEN_REGIONS,
} from '@/lib/regions';

describe('深圳区域目录', () => {
  it('包含 9 个行政区和大鹏新区，并保持唯一编号', () => {
    expect(SHENZHEN_DISTRICTS.map((item) => item.label)).toEqual([
      '福田区',
      '罗湖区',
      '南山区',
      '盐田区',
      '宝安区',
      '龙岗区',
      '龙华区',
      '坪山区',
      '光明区',
      '大鹏新区',
    ]);
    expect(new Set(SHENZHEN_REGIONS.map((item) => item.id)).size).toBe(
      SHENZHEN_REGIONS.length,
    );
  });

  it('每个区域中心都落在自身边界内，商圈都指向有效行政区', () => {
    const districtIds = new Set(SHENZHEN_DISTRICTS.map((item) => item.id));
    for (const region of SHENZHEN_REGIONS) {
      expect(region.bbox).toBeDefined();
      const [west, south, east, north] = region.bbox!;
      expect(region.centerLng).toBeGreaterThanOrEqual(west);
      expect(region.centerLng).toBeLessThanOrEqual(east);
      expect(region.centerLat).toBeGreaterThanOrEqual(south);
      expect(region.centerLat).toBeLessThanOrEqual(north);
      if (region.level === 'business_area') {
        expect(districtIds.has(region.districtId!)).toBe(true);
      }
    }
  });

  it('明确区分地图开放范围和真实数据覆盖', () => {
    expect(SHENZHEN_CITY.coverage).toBe('live');
    expect(findShenzhenRegion('science-park')?.coverage).toBe('live');
    expect(findShenzhenRegion('huaqiangbei')?.coverage).toBe('planned');
  });
});
