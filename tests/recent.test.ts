import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { seedDemo } from '@/lib/server/seed';
import { PlaceRepository } from '@/lib/server/repository';
import { GET as recentGet } from '@/app/api/v1/recent/route';
import { NextRequest } from 'next/server';

const roots: string[] = [];
function testDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-map-recent-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'test.sqlite'));
  seedDemo(db);
  return db;
}
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe('最近核验入口', () => {
  it('默认 7 天窗口按最新核验倒序', () => {
    const db = testDb();
    const now = new Date('2026-09-05T00:00:00Z');
    const rows = new PlaceRepository(db).listRecentlyVerified({ now });
    expect(rows.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < rows.length; i++)
      expect(
        rows[i - 1].freshestObservedAt.localeCompare(rows[i].freshestObservedAt),
      ).toBeGreaterThanOrEqual(0);
  });

  it('窗口边界与 limit 上限', () => {
    const db = testDb();
    const now = new Date('2026-09-05T00:00:00Z');
    const days7 = new PlaceRepository(db).listRecentlyVerified({ days: 7, now });
    expect(days7.every((place) => place.freshestObservedAt >= '2026-08-29')).toBe(
      true,
    );
    const clamped = new PlaceRepository(db).listRecentlyVerified({
      days: 100,
      limit: 999,
      now,
    });
    expect(clamped.length).toBeLessThanOrEqual(20);
  });

  it('排除超过 180 天与停业地点', () => {
    const db = testDb();
    db.prepare(
      "UPDATE price_reports SET observed_at='2025-01-01' WHERE menu_item_id IN ('shenda-lunch','shenda-noodle')",
    ).run();
    db.prepare(
      "UPDATE places SET business_status='closed' WHERE id='shenda-west-noodle'",
    ).run();

    const rows = new PlaceRepository(db).listRecentlyVerified({
      days: 30,
      now: new Date('2026-09-05T00:00:00Z'),
    });
    expect(rows.some((place) => place.id === 'shenda-yuehai-canteen')).toBe(false);
    expect(rows.some((place) => place.id === 'shenda-west-noodle')).toBe(false);
  });

  it('参数越界统一返回 400', async () => {
    for (const query of ['days=0', 'days=31', 'days=abc', 'limit=0', 'limit=21']) {
      const response = await recentGet(
        new NextRequest(`http://localhost/api/v1/recent?${query}`),
      );
      expect(response.status).toBe(400);
    }
  });
});
