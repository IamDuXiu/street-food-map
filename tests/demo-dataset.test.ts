import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_AREAS } from '@/lib/demo-dataset';
import { openDatabase, type SqliteDatabase } from '@/lib/server/db';
import { hasDemoData } from '@/lib/server/demo-status';
import { seedRegions } from '@/scripts/seed-regions';
import { seedNationalDemo } from '@/lib/server/seed-national';
import { PlaceRepository } from '@/lib/server/repository';
import { toPublicPlace, publicPlaceIsEligible } from '@/lib/server/public';

const files: string[] = [];
let db: SqliteDatabase;

beforeEach(() => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-dataset-'));
  const file = path.join(directory, 'test.sqlite');
  files.push(file);
  db = openDatabase(file);
  seedRegions(db);
  seedNationalDemo(db);
});

afterEach(() => {
  db.close();
  for (const file of files.splice(0))
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

function demoPlaceId(slug: string) {
  return `demo-place-${slug}`;
}

function regionBbox(id: string) {
  const row = db
    .prepare('SELECT bbox_west west, bbox_south south, bbox_east east, bbox_north north FROM regions WHERE id=?')
    .get(id) as { west: number; south: number; east: number; north: number } | undefined;
  return row;
}

/** 公开读模型（含门店可见性与 DTO 形态）。 */
function publicPlaces() {
  return new PlaceRepository(db)
    .listPublic({ maxPriceFen: 20000 })
    .map((place) => toPublicPlace(place));
}

describe('national demo dataset', () => {
  it('覆盖 5 个公开城市，规模足以让人一眼看懂产品', () => {
    expect(DEMO_AREAS.length).toBeGreaterThanOrEqual(15);
    const cities = new Set(DEMO_AREAS.map((area) => area.city));
    expect([...cities].sort()).toEqual([
      'beijing',
      'guangzhou',
      'hangzhou',
      'shanghai',
      'shenzhen',
    ]);
    const placeCount = DEMO_AREAS.reduce((n, area) => n + area.places.length, 0);
    expect(placeCount).toBeGreaterThanOrEqual(40);
    // 每个片区 3 家，保证每个城市「6 正常 + 1 创作者 + 2 不收录」的构成
    for (const area of DEMO_AREAS) expect(area.places).toHaveLength(3);
  });

  it('把每家门店落在其所属行政区内，覆盖状态才会亮', () => {
    for (const area of DEMO_AREAS) {
      const bbox = regionBbox(area.districtId);
      expect(bbox, `缺少行政区 ${area.districtId}`).toBeDefined();
      for (const item of area.places) {
        const row = db
          .prepare('SELECT lng, lat FROM places WHERE id=?')
          .get(demoPlaceId(item.slug)) as { lng: number; lat: number };
        expect(row.lng).toBeGreaterThanOrEqual(bbox!.west);
        expect(row.lng).toBeLessThanOrEqual(bbox!.east);
        expect(row.lat).toBeGreaterThanOrEqual(bbox!.south);
        expect(row.lat).toBeLessThanOrEqual(bbox!.north);
      }
    }
  });

  it('每条餐食都有价格、核验方式与相对写入时刻的核验日期', () => {
    const rows = db
      .prepare(
        `SELECT pr.price_fen, pr.verification_method, pr.status, pr.observed_at
         FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id
         WHERE mi.place_id LIKE 'demo-place-%'`,
      )
      .all() as Array<{
      price_fen: number;
      verification_method: string;
      status: string;
      observed_at: string;
    }>;
    const expected = DEMO_AREAS.reduce(
      (n, area) => n + area.places.reduce((m, p) => m + p.meals.length, 0),
      0,
    );
    expect(rows).toHaveLength(expected);
    // 日期是相对「写入时刻」算的：不得出现未来日期，也不得比数据里声明的最旧值更旧
    const maxDaysAgo = Math.max(
      ...DEMO_AREAS.flatMap((area) => area.places.flatMap((p) => p.meals.map((m) => m.daysAgo))),
    );
    const today = new Date().toISOString().slice(0, 10);
    const oldest = new Date(Date.now() - (maxDaysAgo + 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const row of rows) {
      expect(row.price_fen).toBeGreaterThan(0);
      expect(row.observed_at <= today).toBe(true);
      expect(row.observed_at >= oldest).toBe(true);
      // 未核验的创作者来源价绝不可能是 verified（数据库触发器也禁止）
      if (row.verification_method === 'external_lead') expect(row.status).not.toBe('verified');
      else expect(row.status).toBe('verified');
    }
  });

  it('常规门店公开可见，且都满足店级 ≤¥15 门槛', () => {
    const visible = publicPlaces();
    const ids = new Set(visible.map((place) => place.id));
    for (const area of DEMO_AREAS) {
      for (const item of area.places) {
        // 只有 >¥15 或只有 180 天前价格的两家，按设计不公开
        const isRejectedSample = ['bj-zhongguancun-xiaochao', 'sh-xuhui-bistro', 'gz-huifu-stew', 'sz-baoan-changfen', 'hz-wulin-curry', 'bj-hujialou-roast', 'sh-lujiazui-tangbao', 'gz-haizhu-cha', 'sz-xixiang-cha', 'hz-qianjiang-curry'].includes(item.slug);
        const id = demoPlaceId(item.slug);
        if (isRejectedSample) {
          expect(ids.has(id), `${item.slug} 不应公开`).toBe(false);
        } else {
          expect(ids.has(id), `${item.slug} 应公开`).toBe(true);
          const dto = visible.find((place) => place.id === id)!;
          expect(dto.meals.some((meal) => meal.priceFen <= 1500)).toBe(true);
        }
      }
    }
  });

  it('创作者来源门店以「未核验」出现，并带上来源标签', () => {
    const visible = publicPlaces();
    const creatorPlaces = visible.filter((place) =>
      place.meals.some((meal) => meal.unverified),
    );
    expect(creatorPlaces.length).toBe(5); // 每城 1 家
    for (const place of creatorPlaces) {
      expect(place.sources).toContain('示例创作者');
      const unverified = place.meals.find((meal) => meal.unverified)!;
      expect(unverified.method).toBe('external_lead');
      expect(unverified.priceFen).toBeLessThanOrEqual(1500);
    }
  });

  it('过期价格在公开读模型里被隐藏，但仍留在库里（后台可见）', () => {
    const stale = publicPlaces().find(
      (place) => place.id === demoPlaceId('gz-haizhu-cha'),
    );
    expect(stale).toBeUndefined();
    const stored = db
      .prepare('SELECT count(*) c FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE mi.place_id=?')
      .get(demoPlaceId('gz-haizhu-cha')) as { c: number };
    expect(stored.c).toBe(1);
  });

  it('每个公开城市都有可见门店，用户切城市不会是空地图', () => {
    const visible = publicPlaces();
    for (const city of ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hangzhou']) {
      const inCity = visible.filter((place) => place.city === city);
      expect(inCity.length, city).toBeGreaterThanOrEqual(5);
    }
  });

  it('重复执行幂等：不新增行，只刷新核验日期', () => {
    const before = db
      .prepare("SELECT count(*) c FROM places WHERE id LIKE 'demo-place-%'")
      .get() as { c: number };
    const pricesBefore = db
      .prepare("SELECT count(*) c FROM price_reports WHERE id LIKE 'demo-price-%'")
      .get() as { c: number };
    seedNationalDemo(db);
    seedNationalDemo(db);
    expect(
      (db.prepare("SELECT count(*) c FROM places WHERE id LIKE 'demo-place-%'").get() as { c: number }).c,
    ).toBe(before.c);
    expect(
      (db.prepare("SELECT count(*) c FROM price_reports WHERE id LIKE 'demo-price-%'").get() as { c: number }).c,
    ).toBe(pricesBefore.c);
    expect(
      (db.prepare("SELECT count(*) c FROM entity_sources").get() as { c: number }).c,
    ).toBe(10);
  });

  it('演示提示的判定只看库里的演示行', () => {
    expect(hasDemoData(db)).toBe(true);
    const clean = openDatabase(
      path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clean-')), 'clean.sqlite'),
    );
    expect(hasDemoData(clean)).toBe(false);
    clean.close();
  });

  it('演示数据本身不进入公开白名单之外的城市', () => {
    for (const area of DEMO_AREAS) {
      expect(['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hangzhou']).toContain(area.city);
    }
    for (const place of publicPlaces()) {
      expect(['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hangzhou']).toContain(place.city);
      expect(publicPlaceIsEligible(new PlaceRepository(db).get(place.id)!)).toBe(true);
    }
  });
});
