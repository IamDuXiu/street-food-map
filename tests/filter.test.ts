import { describe, expect, it } from 'vitest';
import { PLACES } from '@/lib/fixtures';
import { eligibleMeals, filterPlaces, formatPrice, lowestMeal, lowestPrice, prepareNearbyPlaces } from '@/lib/filter';

describe('饭签筛选工具', () => {
  it('以人民币分转换展示价格并取最低有效餐食', () => {
    expect(formatPrice(1500)).toBe('¥15');
    expect(formatPrice(1250)).toBe('¥12.5');
    expect(formatPrice(1205)).toBe('¥12.05');
    expect(lowestPrice(PLACES[0])).toBe(1200);
  });

  it('列表和地图只从同一组有效餐食取标价', () => {
    const place = PLACES[0];
    expect(eligibleMeals(place, 1500).every((meal) => meal.priceFen <= 1500)).toBe(true);
    expect(lowestMeal(place, 1500)?.priceFen).toBe(1200);
    expect(lowestMeal(place, 1000)).toBeUndefined();
  });

  it('附近筛选只在用户选择附近排序时改为距离顺序', () => {
    const origin = { lng: PLACES[0].lng, lat: PLACES[0].lat };
    const input = [PLACES[1], PLACES[0]];
    expect(prepareNearbyPlaces(input, origin, 'price').map((place) => place.id)).toEqual(input.map((place) => place.id));
    expect(prepareNearbyPlaces(input, origin, 'freshness').map((place) => place.id)).toEqual(input.map((place) => place.id));
    expect(prepareNearbyPlaces(input, origin, 'distance')[0].id).toBe(PLACES[0].id);
  });

  it('按价格、样板区和标签组合过滤地点', () => {
    expect(filterPlaces(PLACES, { maxPrice: 15, zoneId: 'sz university', tag: 'all', query: '' }).map((p) => p.id)).toEqual(['shenda-yuehai-canteen']);
    expect(filterPlaces(PLACES, { maxPrice: 30, zoneId: 'science park', tag: '早餐', query: '' })).toHaveLength(2);
    expect(filterPlaces(PLACES, { maxPrice: 30, zoneId: 'all', tag: 'all', query: '牛肉' })).toHaveLength(1);
  });
});
