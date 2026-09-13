import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { seedRegions } from '@/scripts/seed-regions';
import {
  buildRegionCatalog,
  listRegionCities,
} from '@/lib/server/region-repository';
import { GET as configGet } from '@/app/api/v1/config/route';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'region-repo-'));
  roots.push(root);
  return openDatabase(path.join(root, 'regions.sqlite'));
}

function addPublicPlace(
  db: ReturnType<typeof tempDb>,
  placeId: string,
  lng: number,
  lat: number,
) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('z','片区','student',113.9,22.5,1)",
  ).run();
  db.prepare(
    'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,business_status,record_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(placeId, 'z', `店-${placeId}`, `店-${placeId}`, '地址', lng, lat, '快餐', 'public', 'open', 'active', now, now);
  db.prepare(
    'INSERT INTO menu_items(id,place_id,name,normalized_name,category,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(`${placeId}-meal`, placeId, '套餐', '套餐', '米饭', 1, now, now);
  db.prepare(
    'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)',
  ).run(`${placeId}-price`, `${placeId}-meal`, 1500, now.slice(0, 10), 'onsite_menu', 'verified', now);
}

describe('区域目录 DB 仓储', () => {
  it('从 DB 构建深圳目录并列出珠三角 9 市', () => {
    const db = tempDb();
    seedRegions(db);
    const catalog = buildRegionCatalog(db, 'shenzhen')!;
    expect(catalog.city.label).toBe('深圳市');
    expect(catalog.districts).toHaveLength(10);
    expect(listRegionCities(db).map((city) => city.label)).toEqual([
      '深圳市',
      '广州市',
      '佛山市',
      '东莞市',
      '中山市',
      '珠海市',
      '惠州市',
      '江门市',
      '肇庆市',
    ]);
    expect(catalog.districts.every((d) => d.coverage === 'planned')).toBe(true);
    db.close();
  });

  it('覆盖状态由公开点位派生（bbox 内有点即 live）', () => {
    const db = tempDb();
    seedRegions(db);
    addPublicPlace(db, 'sp-1', 113.948, 22.538);
    const catalog = buildRegionCatalog(db, 'shenzhen')!;
    const nanshan = catalog.districts.find((d) => d.id === 'nanshan')!;
    expect(catalog.city.coverage).toBe('live');
    expect(nanshan.coverage).toBe('live');
    expect(
      nanshan.businessAreas.find((a) => a.id === 'science-park')!.coverage,
    ).toBe('live');
    expect(
      nanshan.businessAreas.find((a) => a.id === 'shekou')!.coverage,
    ).toBe('planned');
    db.close();
  });

  it('尚未整理下级目录的城市返回空行政区', () => {
    const db = tempDb();
    seedRegions(db);
    const catalog = buildRegionCatalog(db, 'guangzhou')!;
    expect(catalog.city.label).toBe('广州市');
    expect(catalog.districts).toEqual([]);
    expect(catalog.cities).toHaveLength(9);
    db.close();
  });

  it('表为空时返回 null 以便回退静态目录', () => {
    const db = tempDb();
    expect(buildRegionCatalog(db, 'shenzhen')).toBeNull();
    db.close();
  });

  it('config 接口按城市返回 DB 目录', async () => {
    const db = openDatabase();
    seedRegions(db);
    const response = await configGet(
      new Request('http://localhost/api/v1/config?city=guangzhou'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { regions: { city: { label: string }; cities: unknown[] } };
    };
    expect(body.data.regions.city.label).toBe('广州市');
    expect(body.data.regions.cities).toHaveLength(9);
  });
});
