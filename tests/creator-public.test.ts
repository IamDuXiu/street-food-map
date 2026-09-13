import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { publicPlaceIsEligible, toPublicPlace } from '@/lib/server/public';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-public-'));
  roots.push(root);
  return openDatabase(path.join(root, 'creator.sqlite'));
}

function seedPlace(db: ReturnType<typeof tempDb>, placeId: string, menuId: string) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('z','片区','student',113.93,22.53,1)",
  ).run();
  db.prepare(
    'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,business_status,record_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(placeId, 'z', '创作者来源店', '创作者来源店', '地址', 113.93, 22.53, '快餐', 'public', 'open', 'active', now, now);
  db.prepare(
    'INSERT INTO menu_items(id,place_id,name,normalized_name,category,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run(menuId, placeId, '卤肉饭', '卤肉饭', '米饭', 1, now, now);
  return now;
}

function addPrice(
  db: ReturnType<typeof tempDb>,
  id: string,
  menuId: string,
  priceFen: number,
  method: string,
  status: string,
  observedAt: string,
) {
  db.prepare(
    'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)',
  ).run(id, menuId, priceFen, observedAt, method, status, new Date().toISOString());
}

describe('创作者来源公开口径', () => {
  it('只有创作者价的地点可公开，餐食标记未核验且可信度为低可信', () => {
    const db = tempDb();
    const today = new Date().toISOString().slice(0, 10);
    seedPlace(db, 'p1', 'm1');
    addPrice(db, 'cr1', 'm1', 1200, 'external_lead', 'pending', today);

    const repo = new PlaceRepository(db);
    const place = repo.get('p1')!;
    expect(place.meals).toHaveLength(1);
    expect(place.meals[0].method).toBe('external_lead');
    expect(place.meals[0].unverified).toBe(true);
    expect(place.verification).toBe('低可信');
    expect(publicPlaceIsEligible(place)).toBe(true);

    const dto = toPublicPlace(place);
    expect(dto.meals).toHaveLength(1);
    expect(dto.meals[0].unverified).toBe(true);

    const listed = repo.listPublic({ now: new Date() });
    const row = listed.find((item) => item.id === 'p1');
    expect(row).toBeDefined();
    expect(row!.minimumPriceFen).toBe(1200);
    db.close();
  });

  it('同一菜品同时有已核验价时，优先展示已核验价且不标未核验', () => {
    const db = tempDb();
    const today = new Date().toISOString().slice(0, 10);
    seedPlace(db, 'p2', 'm2');
    addPrice(db, 'v2', 'm2', 1500, 'onsite_menu', 'verified', today);
    addPrice(db, 'cr2', 'm2', 1000, 'external_lead', 'pending', today);

    const place = new PlaceRepository(db).get('p2')!;
    expect(place.meals).toHaveLength(1);
    expect(place.meals[0].priceFen).toBe(1500);
    expect(place.meals[0].method).toBe('onsite_menu');
    expect(place.meals[0].unverified).toBeUndefined();
    expect(place.verification).toBe('高可信');
    db.close();
  });

  it('创作者价超 25 元或超 180 天不进入公开', () => {
    const db = tempDb();
    const today = new Date().toISOString().slice(0, 10);
    seedPlace(db, 'p3', 'm3');
    addPrice(db, 'cr3', 'm3', 3000, 'external_lead', 'pending', today);
    const repo = new PlaceRepository(db);
    expect(repo.listPublic({ now: new Date() }).some((p) => p.id === 'p3')).toBe(false);

    db.prepare('UPDATE price_reports SET price_fen=1200, observed_at=?, id=? WHERE id=?').run('2020-01-01', 'cr4', 'cr3');
    const expired = repo.get('p3')!;
    expect(publicPlaceIsEligible(expired)).toBe(false);
    db.close();
  });
});
