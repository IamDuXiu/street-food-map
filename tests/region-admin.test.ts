import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { hashPassword, issueSession } from '@/lib/server/auth';
import { seedRegions } from '@/scripts/seed-regions';
import {
  buildRegionCatalog,
  createRegion,
  listAdminRegions,
  patchRegion,
  RegionError,
} from '@/lib/server/region-repository';
import { GET as regionsGet, POST as regionsPost } from '@/app/api/v1/admin/regions/route';
import { PATCH as regionPatch } from '@/app/api/v1/admin/regions/[id]/route';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'region-admin-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'regions.sqlite'));
  seedRegions(db);
  return db;
}

const area = {
  parentId: 'nanshan',
  name: '测试商圈',
  level: 'business_area' as const,
  centerLng: 113.92,
  centerLat: 22.52,
  bbox: [113.9, 22.5, 113.94, 22.54] as [number, number, number, number],
  zoom: 14,
  sortOrder: 1,
};

describe('区域目录管理写入', () => {
  it('新增商圈并出现在目录，可改名与停用', () => {
    const db = tempDb();
    const id = createRegion(db, area);
    let catalog = buildRegionCatalog(db, 'shenzhen')!;
    let nanshan = catalog.districts.find((d) => d.id === 'nanshan')!;
    expect(nanshan.businessAreas.some((item) => item.id === id)).toBe(true);

    patchRegion(db, id, { name: '测试商圈·改名' });
    const renamed = listAdminRegions(db).find((region) => region.id === id)!;
    expect(renamed.name).toBe('测试商圈·改名');

    patchRegion(db, id, { active: false });
    const disabled = listAdminRegions(db).find((region) => region.id === id)!;
    expect(disabled.active).toBe(false);
    catalog = buildRegionCatalog(db, 'shenzhen')!;
    nanshan = catalog.districts.find((d) => d.id === 'nanshan')!;
    expect(nanshan.businessAreas.some((item) => item.id === id)).toBe(false);
    expect(
      (db.prepare("SELECT count(*) c FROM moderation_actions WHERE object_type='region'").get() as { c: number }).c,
    ).toBeGreaterThanOrEqual(3);
    db.close();
  });

  it('拒绝非法 bbox、越界区域、错误父级与重复名称', () => {
    const db = tempDb();
    expect(() =>
      createRegion(db, { ...area, bbox: [113.94, 22.5, 113.9, 22.54] }),
    ).toThrow(RegionError);
    expect(() =>
      createRegion(db, { ...area, bbox: [100, 20, 101, 21], centerLng: 100.5, centerLat: 20.5 }),
    ).toThrowError(/城市/);
    expect(() => createRegion(db, { ...area, parentId: 'shenzhen' })).toThrowError(
      /行政区/,
    );
    createRegion(db, area);
    expect(() => createRegion(db, area)).toThrowError(/重复/);
    db.close();
  });

  it('城市与行政区不可停用', () => {
    const db = tempDb();
    expect(() => patchRegion(db, 'shenzhen', { active: false })).toThrowError(
      /仅商圈/,
    );
    expect(() => patchRegion(db, 'nanshan', { active: false })).toThrowError(
      /仅商圈/,
    );
    db.close();
  });
});

describe('区域目录管理接口', () => {
  function request(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
    return new NextRequest(`http://localhost${url}`, init);
  }
  function authorize(db: ReturnType<typeof openDatabase>) {
    process.env.SESSION_SECRET = 'region-admin-secret-0123456789012345678901';
    db.prepare('DELETE FROM admin_settings').run();
    db.prepare(
      'INSERT INTO admin_settings(id,password_hash,password_version,updated_at) VALUES (1,?,?,?)',
    ).run(hashPassword('x'), 1, new Date().toISOString());
    return issueSession(1);
  }

  it('未登录返回 401', async () => {
    const db = openDatabase();
    seedRegions(db);
    expect((await regionsGet(request('/api/v1/admin/regions'))).status).toBe(401);
  });

  it('登录后可列出、新增与修改商圈', async () => {
    const db = openDatabase();
    seedRegions(db);
    const session = authorize(db);
    const csrf = 'region-csrf-012345678901234567890123';
    const headers = {
      cookie: `budget_admin_session=${session}; budget_csrf=${csrf}`,
      origin: 'http://localhost',
      host: 'localhost',
      'content-type': 'application/json',
      'x-csrf-token': csrf,
    };
    const listed = await regionsGet(
      request('/api/v1/admin/regions', {
        headers: { cookie: `budget_admin_session=${session}` },
      }),
    );
    expect(listed.status).toBe(200);
    const before = ((await listed.json()) as { data: unknown[] }).data.length;

    const created = await regionsPost(
      request('/api/v1/admin/regions', {
        method: 'POST',
        headers,
        body: JSON.stringify(area),
      }),
    );
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };

    const patched = await regionPatch(
      request(`/api/v1/admin/regions/${data.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: data.id }) },
    );
    expect(patched.status).toBe(200);
    expect(
      (db.prepare('SELECT count(*) c FROM regions').get() as { c: number }).c,
    ).toBe(before + 1);
  });
});
