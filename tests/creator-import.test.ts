import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { openDatabase } from '@/lib/server/db';
import { hashPassword, issueSession } from '@/lib/server/auth';
import { seedRegions } from '@/scripts/seed-regions';
import {
  commitCreatorImport,
  creatorImportRecordSchema,
  previewCreatorImport,
} from '@/lib/server/creator-import';
import { listEntitySources } from '@/lib/server/sources';
import { PlaceRepository } from '@/lib/server/repository';
import { POST as geocodePost } from '@/app/api/v1/admin/geocode/route';
import { POST as previewPost } from '@/app/api/v1/admin/creator-import/preview/route';
import { POST as commitPost } from '@/app/api/v1/admin/creator-import/commit/route';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-import-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'creator.sqlite'));
  seedRegions(db);
  return db;
}

const base = {
  storeName: '桥底卤肉饭',
  mealName: '卤肉饭',
  priceYuan: 12,
  address: '广州市天河区珠江新城某路 1 号',
  city: 'guangzhou',
  platform: 'bilibili',
  creatorName: '济州土著susu수수',
  contentUrl: 'https://www.bilibili.com/video/BVtest/',
};

describe('创作者内容导入预览', () => {
  it('带坐标的记录直接就绪', async () => {
    const db = tempDb();
    const result = await previewCreatorImport(db, [
      { ...base, lng: 113.32, lat: 23.12 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.rows[0].status).toBe('ready');
    expect(result.rows[0].lng).toBe(113.32);
    db.close();
  });

  it('缺坐标时调用地理编码，命中则就绪并回传候选', async () => {
    const db = tempDb();
    const geocode = vi.fn(async () => [
      { lng: 113.321, lat: 23.121, title: '某快餐店' },
    ]);
    const result = await previewCreatorImport(db, [base], { geocode });
    expect(geocode).toHaveBeenCalledWith(base.address);
    expect(result.valid).toBe(true);
    expect(result.rows[0].geocodeCandidates?.[0]?.lng).toBe(113.321);
    db.close();
  });

  it('无法解析地址时标记为待确认坐标', async () => {
    const db = tempDb();
    const result = await previewCreatorImport(db, [base], {
      geocode: async () => [],
    });
    expect(result.valid).toBe(false);
    expect(result.rows[0].status).toBe('needs_coordinates');
    db.close();
  });

  it('「待补」占位地址不调用地理编码，标记为待确认坐标', async () => {
    const db = tempDb();
    const geocode = vi.fn(async () => [
      { lng: 113.264499, lat: 23.130061, title: '广州市' },
    ]);
    const result = await previewCreatorImport(
      db,
      [{ ...base, address: '广州市（待补地址）' }],
      { geocode },
    );
    expect(geocode).not.toHaveBeenCalled();
    expect(result.valid).toBe(false);
    expect(result.rows[0].status).toBe('needs_coordinates');
    expect(result.rows[0].errors.join('')).toContain('待补');
    db.close();
  });

  it('超过 sanity 上限或坐标越界被拒绝', async () => {
    const db = tempDb();
    const result = await previewCreatorImport(db, [
      { ...base, priceYuan: 201, lng: 113.32, lat: 23.12 },
      { ...base, lng: 120, lat: 30 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.rows.every((row) => row.status === 'invalid')).toBe(true);
    db.close();
  });
});

describe('创作者内容导入提交', () => {
  it('同店同菜多来源合并，只保留最新来源价并聚合来源', () => {
    const db = tempDb();
    const first = creatorImportRecordSchema.parse({
      ...base,
      lng: 113.32,
      lat: 23.12,
      priceYuan: 12,
    });
    const second = creatorImportRecordSchema.parse({
      ...base,
      lng: 113.3205,
      lat: 23.1205,
      priceYuan: 13,
      platform: 'youtube',
      creatorName: '品城記',
      contentUrl: 'https://www.youtube.com/watch?v=test',
    });
    const results = commitCreatorImport(db, [first, second]);
    expect(results).toHaveLength(2);
    expect(results[0].created).toBe(true);
    expect(results[1].created).toBe(false);
    expect(results[0].placeId).toBe(results[1].placeId);

    const places = db
      .prepare('SELECT id FROM places')
      .all() as Array<{ id: string }>;
    expect(places).toHaveLength(1);
    const menus = db
      .prepare('SELECT id FROM menu_items WHERE place_id=?')
      .all(results[0].placeId) as Array<{ id: string }>;
    expect(menus).toHaveLength(1);

    const pending = db
      .prepare(
        "SELECT count(*) c FROM price_reports WHERE menu_item_id=? AND verification_method='external_lead' AND status='pending'",
      )
      .get(menus[0].id) as { c: number };
    expect(pending.c).toBe(1);
    const superseded = db
      .prepare(
        "SELECT count(*) c FROM price_reports WHERE menu_item_id=? AND status='superseded'",
      )
      .get(menus[0].id) as { c: number };
    expect(superseded.c).toBe(1);

    const sources = listEntitySources(db, 'place', results[0].placeId);
    expect(sources.map((s) => `${s.platform}@${s.creatorName}`)).toEqual([
      'bilibili@济州土著susu수수',
      'youtube@品城記',
    ]);
    db.close();
  });

  it('提交后的门店出现在公开地图且为未核验低可信', () => {
    const db = tempDb();
    commitCreatorImport(db, [
      creatorImportRecordSchema.parse({ ...base, lng: 113.32, lat: 23.12 }),
    ]);
    const place = new PlaceRepository(db).listPublic({ now: new Date() })[0];
    expect(place).toBeDefined();
    expect(place.verification).toBe('低可信');
    expect(place.meals[0].unverified).toBe(true);
    expect(place.meals[0].source).toBe('bilibili@济州土著susu수수');
    db.close();
  });

  it('网页评价写入来源线索但不进入公开 DTO', () => {
    const db = tempDb();
    commitCreatorImport(db, [
      creatorImportRecordSchema.parse({
        ...base,
        platform: 'web',
        creatorName: '某站点',
        contentUrl: 'https://example.com/article',
        reviewNotes: '分量足，排队久',
        lng: 113.32,
        lat: 23.12,
      }),
    ]);
    const lead = db
      .prepare(
        "SELECT review_notes notes FROM source_leads WHERE content_url='https://example.com/article'",
      )
      .get() as { notes: string | null };
    expect(lead.notes).toBe('分量足，排队久');
    const dto = new PlaceRepository(db).listPublic({ now: new Date() })[0];
    expect(JSON.stringify(dto)).not.toContain('分量足');
    db.close();
  });

  it('缺少坐标时提交抛错（数据库不写入）', () => {
    const db = tempDb();
    const record = creatorImportRecordSchema.parse(base);
    expect(() => commitCreatorImport(db, [record])).toThrow('COORDINATES_REQUIRED');
    expect(
      (db.prepare('SELECT count(*) c FROM places').get() as { c: number }).c,
    ).toBe(0);
    db.close();
  });
});

describe('创作者导入与地理编码接口', () => {
  function request(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}) {
    return new NextRequest(`http://localhost${url}`, init);
  }
  function authorize(db: ReturnType<typeof openDatabase>) {
    process.env.SESSION_SECRET = 'creator-import-secret-012345678901234567890';
    db.prepare('DELETE FROM admin_settings').run();
    db.prepare(
      'INSERT INTO admin_settings(id,password_hash,password_version,updated_at) VALUES (1,?,?,?)',
    ).run(hashPassword('x'), 1, new Date().toISOString());
    return issueSession(1);
  }

  it('未登录导入接口返回 401', async () => {
    const db = openDatabase();
    seedRegions(db);
    const response = await previewPost(
      request('/api/v1/admin/creator-import/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records: [] }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('登录后预览返回就绪记录，提交写入地图', async () => {
    const db = openDatabase();
    seedRegions(db);
    const session = authorize(db);
    const record = { ...base, lng: 113.32, lat: 23.12 };
    const preview = await previewPost(
      request('/api/v1/admin/creator-import/preview', {
        method: 'POST',
        headers: {
          cookie: `budget_admin_session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ records: [record] }),
      }),
    );
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as { data: { valid: boolean } };
    expect(previewBody.data.valid).toBe(true);

    const csrf = 'creator-csrf-012345678901234567890123';
    const missingCsrf = await commitPost(
      request('/api/v1/admin/creator-import/commit', {
        method: 'POST',
        headers: {
          cookie: `budget_admin_session=${session}`,
          origin: 'http://localhost',
          host: 'localhost',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ records: [record] }),
      }),
    );
    expect(missingCsrf.status).toBe(403);

    const commit = await commitPost(
      request('/api/v1/admin/creator-import/commit', {
        method: 'POST',
        headers: {
          cookie: `budget_admin_session=${session}; budget_csrf=${csrf}`,
          origin: 'http://localhost',
          host: 'localhost',
          'content-type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify({ records: [record] }),
      }),
    );
    expect(commit.status).toBe(200);
    const commitBody = (await commit.json()) as { data: { imported: number } };
    expect(commitBody.data.imported).toBe(1);
    expect(
      (db.prepare('SELECT count(*) c FROM places').get() as { c: number }).c,
    ).toBe(1);
  });

  it('地理编码接口按 Key 返回候选', async () => {
    const db = openDatabase();
    const session = authorize(db);
    const previous = process.env.TENCENT_MAP_WEB_SERVICE_KEY;
    process.env.TENCENT_MAP_WEB_SERVICE_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          status: 0,
          result: { location: { lng: 113.321, lat: 23.121 } },
        }),
      })),
    );
    const response = await geocodePost(
      request('/api/v1/admin/geocode', {
        method: 'POST',
        headers: {
          cookie: `budget_admin_session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ address: '广州市天河区某路 1 号' }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { candidates: Array<{ lng: number; lat: number }>; hasKey: boolean };
    };
    expect(body.data.hasKey).toBe(true);
    expect(body.data.candidates[0]).toEqual({
      lng: 113.321,
      lat: 23.121,
      title: undefined,
      reliability: undefined,
    });
    vi.unstubAllGlobals();
    if (previous === undefined) delete process.env.TENCENT_MAP_WEB_SERVICE_KEY;
    else process.env.TENCENT_MAP_WEB_SERVICE_KEY = previous;
  });
});
