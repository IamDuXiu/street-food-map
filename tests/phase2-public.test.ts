import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { seedDemo } from '@/lib/server/seed';
import { PlaceRepository } from '@/lib/server/repository';
import { wgs84ToGcj02 } from '@/lib/geo';
import { GET as mapGet } from '@/app/api/v1/map/route';
import { NextRequest } from 'next/server';

const roots: string[] = [];
function database() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-map-phase2-')); roots.push(root); const db = openDatabase(path.join(root, 'test.sqlite')); seedDemo(db); return db; }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('阶段 2 公开查询与坐标', () => {
  it('将浏览器 WGS-84 定位集中转换为 GCJ-02，境外坐标保持不变', () => {
    const converted = wgs84ToGcj02({ lng: 113.933073, lat: 22.526639 });
    expect(converted.lng).toBeGreaterThan(113.933073);
    expect(Math.abs(converted.lat - 22.526639)).toBeGreaterThan(0.0001);
    expect(wgs84ToGcj02({ lng: 0, lat: 0 })).toEqual({ lng: 0, lat: 0 });
  });

  it('公开查询只返回合资格地点、按标签/视野筛选并稳定限制 500 点', () => {
    const db = database();
    const now = new Date().toISOString().slice(0, 10);
    const add = db.transaction(() => {
      for (let i = 0; i < 520; i++) {
        const placeId = `phase2-place-${i}`; const mealId = `phase2-meal-${i}`;
        db.prepare('INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,business_status,record_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(placeId, 'sz university', `阶段2测试点${i}`, `阶段2测试点${i}`, '测试地址', 113.90 + i * 0.00001, 22.52 + i * 0.00001, '街边快餐', 'public', 'open', 'active', now, now);
        db.prepare('INSERT INTO menu_items(id,place_id,name,normalized_name,category,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(mealId, placeId, '测试套餐', `测试套餐${i}`, '套餐', 1, now, now);
        db.prepare('INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)').run(`phase2-price-${i}`, mealId, 1800, now, 'onsite_menu', 'verified', now);
      }
    });
    add();
    const repo = new PlaceRepository(db);
    const all = repo.listPublic({ zoneId: 'sz university', maxPriceFen: 3000, now: new Date(`${now}T00:00:00Z`) });
    expect(all).toHaveLength(500);
    expect(all.every((place) => place.minimumPriceFen <= 2500)).toBe(true);
    const tagged = repo.listPublic({ zoneId: 'sz university', tags: ['学校食堂'], maxPriceFen: 2500, now: new Date(`${now}T00:00:00Z`) });
    expect(tagged.every((place) => place.tags.includes('学校食堂'))).toBe(true);
    const boxed = repo.listPublic({ bbox: [113.933, 22.526, 113.934, 22.528], now: new Date(`${now}T00:00:00Z`) });
    expect(boxed.every((place) => place.lng >= 113.933 && place.lng <= 113.934 && place.lat >= 22.526 && place.lat <= 22.528)).toBe(true);
    const timings: number[] = [];
    for (let i = 0; i < 30; i++) { const start = performance.now(); const result = repo.listPublic({ zoneId: 'sz university', maxPriceFen: 2500, now: new Date(`${now}T00:00:00Z`) }); timings.push(performance.now() - start); expect(result.length).toBeLessThanOrEqual(500); expect(result.every((place) => place.minimumPriceFen <= 2500)).toBe(true); }
    timings.sort((a, b) => a - b);
    expect(timings[Math.ceil(timings.length * 0.95) - 1]).toBeLessThan(300);
    expect(JSON.stringify(all)).not.toMatch(/sourceUrl|adminNote|payload_json|audit/);
  });

  it('公开查询排除停业/过期地点，非法 bbox、片区和标签统一返回 400', async () => {
    const db = database();
    db.prepare("UPDATE places SET business_status='closed' WHERE id='shenda-west-noodle'").run();
    db.prepare("UPDATE price_reports SET observed_at='2020-01-01' WHERE menu_item_id IN ('shenda-lunch','shenda-noodle')").run();
    const visible = new PlaceRepository(db).listPublic({ zoneId: 'sz university', now: new Date('2026-09-02T00:00:00Z') });
    expect(visible.map((place) => place.id)).not.toContain('shenda-west-noodle');
    expect(visible.map((place) => place.id)).not.toContain('shenda-yuehai-canteen');
    for (const query of ['bbox=1,2,3', 'zoneId=unknown-zone', 'tag=not-a-tag', 'maxPriceFen=3000', 'origin=113.93,22.52']) {
      const response = await mapGet(new NextRequest(`http://localhost/api/v1/map?${query}`));
      expect(response.status).toBe(400);
    }
  });
});
