import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { seedDemo } from '@/lib/server/seed';
import {
  PlaceRepository,
  replacePrice,
} from '@/lib/server/repository';
import { mergePlaces } from '@/lib/server/services';

const roots: string[] = [];
function testDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-map-price-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'test.sqlite'));
  seedDemo(db);
  return db;
}
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function mealOf(db: ReturnType<typeof openDatabase>, placeId: string, mealId: string) {
  const place = new PlaceRepository(db).get(placeId);
  return place!.meals.find((meal) => meal.id === mealId)!;
}

describe('价格变动标记', () => {
  it('首次核验不输出上一次价格或变动', () => {
    const db = testDb();
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.previousPriceFen).toBeUndefined();
    expect(meal.priceChange).toBeUndefined();
  });

  it('价格上涨输出 up 与差额', () => {
    const db = testDb();
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 2500, observedAt: '2026-09-02', verificationMethod: 'onsite_menu' });
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.priceFen).toBe(2500);
    expect(meal.previousPriceFen).toBe(2200);
    expect(meal.priceChange).toEqual({ direction: 'up', deltaFen: 300 });
  });

  it('价格下降输出 down 与差额', () => {
    const db = testDb();
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 1800, observedAt: '2026-09-02', verificationMethod: 'onsite_menu' });
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.priceFen).toBe(1800);
    expect(meal.priceChange).toEqual({ direction: 'down', deltaFen: 400 });
  });

  it('价格持平不输出变动', () => {
    const db = testDb();
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 2200, observedAt: '2026-09-02', verificationMethod: 'onsite_menu' });
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.priceChange).toBeUndefined();
    expect(meal.previousPriceFen).toBeUndefined();
  });

  it('多历史只取紧邻上一次价格', () => {
    const db = testDb();
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 2500, observedAt: '2026-09-02', verificationMethod: 'onsite_menu' });
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 2400, observedAt: '2026-09-03', verificationMethod: 'onsite_menu' });
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.priceFen).toBe(2400);
    expect(meal.previousPriceFen).toBe(2500);
    expect(meal.priceChange).toEqual({ direction: 'down', deltaFen: 100 });
  });

  it('合并地点后价格历史不串味', () => {
    const db = testDb();
    replacePrice(db, { menuItemId: 'kexing-rice', priceFen: 2500, observedAt: '2026-09-02', verificationMethod: 'onsite_menu' });
    mergePlaces(db, 'kexing-b1-foodcourt', 'tencent-community-kitchen');
    const meal = mealOf(db, 'kexing-b1-foodcourt', 'kexing-rice');
    expect(meal.priceFen).toBe(2500);
    expect(meal.previousPriceFen).toBe(2200);
    expect(meal.priceChange).toEqual({ direction: 'up', deltaFen: 300 });
  });
});
