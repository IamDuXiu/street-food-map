import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { regionSeedRecords, seedRegions } from '@/scripts/seed-regions';
import { SHENZHEN_DISTRICTS } from '@/lib/regions';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-regions-'));
  roots.push(root);
  return openDatabase(path.join(root, 'regions.sqlite'));
}

describe('区域目录回填', () => {
  it('回填珠三角 9 市并保持幂等', () => {
    const db = tempDb();
    const expected = regionSeedRecords().length;
    expect(seedRegions(db)).toBe(expected);
    expect(seedRegions(db)).toBe(expected);
    const count = (
      db.prepare('SELECT count(*) c FROM regions').get() as { c: number }
    ).c;
    expect(count).toBe(expected);
    db.close();
  });

  it('包含 9 个城市，且深圳行政区/商圈完整', () => {
    const db = tempDb();
    seedRegions(db);
    const cities = (
      db
        .prepare("SELECT name FROM regions WHERE level='city' ORDER BY sort_order")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(cities).toEqual([
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
    const districtCount = (
      db
        .prepare(
          "SELECT count(*) c FROM regions WHERE level='district' AND parent_id='shenzhen'",
        )
        .get() as { c: number }
    ).c;
    expect(districtCount).toBe(SHENZHEN_DISTRICTS.length);
    const areaCount = (
      db
        .prepare(
          "SELECT count(*) c FROM regions WHERE level='business_area'",
        )
        .get() as { c: number }
    ).c;
    expect(areaCount).toBe(
      SHENZHEN_DISTRICTS.flatMap((district) => district.businessAreas).length,
    );
    db.close();
  });

  it('每个非城市区域的父级都存在，bbox 顺序合法', () => {
    const db = tempDb();
    seedRegions(db);
    const orphans = (
      db
        .prepare(
          `SELECT r.id FROM regions r
           WHERE r.level <> 'city'
             AND NOT EXISTS (SELECT 1 FROM regions p WHERE p.id = r.parent_id)`,
        )
        .all() as Array<{ id: string }>
    ).map((row) => row.id);
    expect(orphans).toEqual([]);
    const invalidBoxes = (
      db
        .prepare('SELECT id FROM regions WHERE NOT (bbox_west < bbox_east AND bbox_south < bbox_north)')
        .all() as Array<{ id: string }>
    ).map((row) => row.id);
    expect(invalidBoxes).toEqual([]);
    db.close();
  });
});
