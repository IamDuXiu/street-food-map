import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase } from '@/lib/server/db';
import { seedDemo } from '@/lib/server/seed';
import {
  CandidatePoolError,
  CandidatePoolRepository,
  commitCandidateDraft,
  createCandidateDraft,
  previewCandidateDraft,
  seedCandidateBatch,
} from '@/lib/candidate-pool';
import { PlaceRepository } from '@/lib/server/repository';
import { commitCsv } from '@/lib/server/services';
import { toPublicPlace } from '@/lib/server/public';

const files: string[] = [];
function testDb() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-pool-'));
  const file = path.join(directory, 'test.sqlite');
  files.push(file);
  const db = openDatabase(file);
  seedDemo(db);
  return db;
}
function records() {
  return JSON.parse(
    fs.readFileSync('tmp/nanshan-leads/consolidated.json', 'utf8'),
  ) as { records: Array<Record<string, unknown>> };
}
function candidateEntry(
  sourceLeadItemId: string,
  menuItemName: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    sourceLeadItemId,
    zoneName: '深大粤海',
    placeName: '候选增量地点',
    address: '候选增量地址',
    lng: 113.93,
    lat: 22.53,
    placeCategory: '餐饮店',
    accessType: 'public',
    menuItemName,
    menuCategory: '快餐',
    priceFen: 1800,
    observedAt: '2026-09-01',
    verificationMethod: 'onsite_menu',
    facts: { open: true, regularPrice: true, oneMeal: true },
    ...overrides,
  };
}
afterEach(() => {
  for (const file of files.splice(0)) fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

describe('candidate pool', () => {
  it('preserves 43 item clues in 32 URL groups and is idempotent', () => {
    const db = testDb();
    const first = seedCandidateBatch(db, records().records);
    const second = seedCandidateBatch(db, records().records);
    expect(first.count).toBe(43);
    expect(new CandidatePoolRepository(db).listGrouped({ discoveryMethod: 'external_lead' })).toHaveLength(32);
    expect((db.prepare("SELECT count(*) c FROM source_lead_items i JOIN source_leads l ON l.id=i.source_lead_id WHERE l.discovery_method='external_lead' AND i.status='new'").get() as { c: number }).c).toBe(43);
    expect(second.insertedLeads).toHaveLength(0);
    expect(second.insertedItems).toHaveLength(0);
  });

  it('loads source URL from the item/lead and previews only selected items', () => {
    const db = testDb();
    seedCandidateBatch(db, records().records);
    const item = db.prepare('SELECT id FROM source_lead_items ORDER BY id LIMIT 1').get() as { id: string };
    const preview = previewCandidateDraft(db, {
      items: [
        {
          sourceLeadItemId: item.id,
          source_lead_url: 'https://evil.example/not-used',
          zoneName: '深大粤海',
          address: '候选测试地址',
          lng: 113.93,
          lat: 22.53,
          placeCategory: '餐饮店',
          accessType: 'public',
          menuCategory: '快餐',
          priceFen: 1800,
          observedAt: '2026-09-01',
          verificationMethod: 'onsite_menu',
          facts: { open: true, regularPrice: true, oneMeal: true },
        },
      ],
    });
    expect(preview.valid).toBe(true);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].source_lead_url).not.toBe('https://evil.example/not-used');
  });

  it('requires a real verification method and rejects external_lead', () => {
    const db = testDb();
    seedCandidateBatch(db, records().records);
    const item = db.prepare('SELECT id FROM source_lead_items ORDER BY id LIMIT 1').get() as { id: string };
    const result = previewCandidateDraft(db, {
      items: [{ sourceLeadItemId: item.id, zoneName: '深大粤海', address: '地址', lng: 113.93, lat: 22.53, placeCategory: '餐饮店', accessType: 'public', menuCategory: '快餐', priceFen: 1800, observedAt: '2026-09-01', verificationMethod: 'external_lead', facts: { open: true, regularPrice: true, oneMeal: true } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'verification_method')).toBe(true);
  });

  it('persists drafts, returns 409 for stale versions, and converts one group to one place', () => {
    const db = testDb();
    seedCandidateBatch(db, records().records);
    const items = db.prepare('SELECT id FROM source_lead_items WHERE source_lead_id=(SELECT source_lead_id FROM source_lead_items ORDER BY id LIMIT 1) ORDER BY id').all() as Array<{ id: string }>;
    const payload = {
      items: items.map((item) => ({ sourceLeadItemId: item.id, zoneName: '深大粤海', address: '候选测试地址', lng: 113.93, lat: 22.53, placeCategory: '餐饮店', accessType: 'public', menuCategory: '快餐', priceFen: 1800, observedAt: '2026-09-01', verificationMethod: 'onsite_menu', facts: { open: true, regularPrice: true, oneMeal: true } })),
    };
    const draft = createCandidateDraft(db, payload);
    expect(() => commitCandidateDraft(db, { draftId: draft.id })).toThrowError(
      expect.objectContaining({
        code: 'CANDIDATE_PREVIEW_VERSION_REQUIRED',
        status: 422,
      }),
    );
    expect(() => commitCandidateDraft(db, { draftId: draft.id, version: draft.version + 1 })).toThrowError(
      expect.objectContaining({
        code: 'DRAFT_VERSION_CONFLICT',
        status: 409,
      }),
    );
    const draftCount = () =>
      (db.prepare('SELECT count(*) c FROM lead_conversion_drafts WHERE id=?').get(draft.id) as { c: number }).c;
    expect(draftCount()).toBe(1);
    const result = commitCandidateDraft(db, { draftId: draft.id, version: draft.version });
    expect(result.createdPlaceIds).toHaveLength(1);
    expect(result.deletedDraftId).toBe(draft.id);
    expect(draftCount()).toBe(0);
    expect(result.createdMenuItemIds).toHaveLength(items.length);
    expect((db.prepare('SELECT count(*) c FROM source_lead_items WHERE source_lead_id=? AND status=\'converted\'').get(items[0] && (db.prepare('SELECT source_lead_id FROM source_lead_items WHERE id=?').get(items[0].id) as { source_lead_id: string }).source_lead_id) as { c: number }).c).toBe(items.length);
  });

  it('requires all three reviewer facts before preview and commit', () => {
    const db = testDb();
    const seeded = seedCandidateBatch(db, [{
      store_name: '事实门槛店',
      meal_name: '事实门槛餐',
      displayed_price_yuan: 18,
      source_url: 'https://example.com/facts-gate',
    }]);
    const payload = {
      items: [candidateEntry(seeded.sourceLeadItemIds[0], '事实门槛餐', {
        facts: { open: true, regularPrice: false, oneMeal: true },
      })],
    };
    const preview = previewCandidateDraft(db, payload);
    expect(preview.valid).toBe(false);
    expect(preview.fieldErrors[seeded.sourceLeadItemIds[0]]['facts.regularPrice']).toContain('常规正价');
    const draft = createCandidateDraft(db, payload);
    expect(() => commitCandidateDraft(db, { draftId: draft.id, version: draft.version })).toThrowError(
      expect.objectContaining({ code: 'CANDIDATE_INVALID', status: 422 }),
    );
  });

  it('rejects inline commit payloads even when a saved draft exists', () => {
    const db = testDb();
    const seeded = seedCandidateBatch(db, [{
      store_name: '只读草稿店',
      meal_name: '只读草稿餐',
      displayed_price_yuan: 18,
      source_url: 'https://example.com/draft-only',
    }]);
    const draft = createCandidateDraft(db, {
      items: [candidateEntry(seeded.sourceLeadItemIds[0], '只读草稿餐')],
    });
    expect(() => commitCandidateDraft(db, {
      draftId: draft.id,
      version: draft.version,
      payload: { items: [candidateEntry(seeded.sourceLeadItemIds[0], '伪造餐食')] },
    })).toThrowError(expect.objectContaining({ code: 'CANDIDATE_PREVIEW_VERSION_REQUIRED', status: 422 }));
  });

  it('keeps unselected items active and appends later items to the matched place', () => {
    const db = testDb();
    seedCandidateBatch(db, records().records);
    const lead = db
      .prepare(
        'SELECT source_lead_id FROM source_lead_items GROUP BY source_lead_id HAVING count(*) = 2 ORDER BY source_lead_id LIMIT 1',
      )
      .get() as { source_lead_id: string };
    const items = db
      .prepare(
        'SELECT id FROM source_lead_items WHERE source_lead_id=? ORDER BY created_at,id LIMIT 2',
      )
      .all(lead.source_lead_id) as Array<{ id: string }>;
    const firstDraft = createCandidateDraft(db, {
      items: [candidateEntry(items[0].id, '候选餐食一')],
    });
    const first = commitCandidateDraft(db, {
      draftId: firstDraft.id,
      version: firstDraft.version,
    });
    expect(first.createdPlaceIds).toHaveLength(1);
    const afterFirst = db
      .prepare('SELECT status,matched_place_id FROM source_leads WHERE id=?')
      .get(lead.source_lead_id) as {
      status: string;
      matched_place_id: string;
    };
    expect(afterFirst.status).toBe('verifying');
    expect(afterFirst.matched_place_id).toBe(first.createdPlaceIds[0]);
    expect(
      (
        db
          .prepare('SELECT status FROM source_lead_items WHERE id=?')
          .get(items[1].id) as { status: string }
      ).status,
    ).toBe('new');

    const secondDraft = createCandidateDraft(db, {
      items: [candidateEntry(items[1].id, '候选餐食二')],
    });
    const second = commitCandidateDraft(db, {
      draftId: secondDraft.id,
      version: secondDraft.version,
    });
    expect(second.createdPlaceIds).toHaveLength(0);
    expect(second.createdMenuItemIds).toHaveLength(1);
    expect(
      (
        db
          .prepare('SELECT status FROM source_leads WHERE id=?')
          .get(lead.source_lead_id) as { status: string }
      ).status,
    ).toBe('converted');
    expect(
      (
        db
          .prepare('SELECT status,matched_place_id FROM source_lead_items WHERE id=?')
          .get(items[1].id) as { status: string; matched_place_id: string }
      ).matched_place_id,
    ).toBe(first.createdPlaceIds[0]);
  });

  it('merges equivalent new places across different source leads in one draft', () => {
    const db = testDb();
    const seeded = seedCandidateBatch(db, [
      {
        candidate_id: 'same-place-a',
        store_name: '同草稿归并店',
        meal_name: '归并餐食一',
        displayed_price_yuan: 18,
        source_url: 'https://example.com/candidate-merge-a',
      },
      {
        candidate_id: 'same-place-b',
        store_name: '同草稿归并店',
        meal_name: '归并餐食二',
        displayed_price_yuan: 19,
        source_url: 'https://example.com/candidate-merge-b',
      },
    ]);
    const payload = {
      items: seeded.sourceLeadItemIds.map((id, index) =>
        candidateEntry(id, `归并餐食${index + 1}`, { placeName: '同草稿归并店', address: '同草稿归并地址' }),
      ),
    };
    const preview = previewCandidateDraft(db, payload);
    expect(preview.placeCount).toBe(1);
    const draft = createCandidateDraft(db, payload);
    const result = commitCandidateDraft(db, {
      draftId: draft.id,
      version: draft.version,
    });
    expect(result.createdPlaceIds).toHaveLength(1);
    expect(result.createdMenuItemIds).toHaveLength(2);
    const matches = db
      .prepare(
        'SELECT matched_place_id FROM source_leads WHERE id IN (?,?) ORDER BY id',
      )
      .all(...seeded.sourceLeadIds) as Array<{ matched_place_id: string }>;
    expect(matches).toHaveLength(2);
    expect(matches[0].matched_place_id).toBe(result.createdPlaceIds[0]);
    expect(matches[1].matched_place_id).toBe(result.createdPlaceIds[0]);
    expect(
      (
        db
          .prepare('SELECT count(*) count FROM menu_items WHERE place_id=?')
          .get(result.createdPlaceIds[0]) as { count: number }
      ).count,
    ).toBe(2);
  });

  it('creates one source item for every distinct meal in a legacy CSV URL group', () => {
    const db = testDb();
    const rows = [
      {
        zone_name: '深大粤海',
        place_name: 'CSV 多餐食来源店',
        address: 'CSV 来源地址',
        lng: 113.91,
        lat: 22.55,
        coordinate_system: 'GCJ-02' as const,
        place_category: '餐馆',
        access_type: 'public',
        menu_item_name: 'CSV 餐食一',
        menu_category: '米饭',
        price_yuan: 18,
        observed_date: '2026-09-01',
        verification_method: 'external_lead' as const,
        evidence_filename: '',
        source_lead_url: 'https://example.com/csv-multi-meal',
        admin_note: '',
      },
      {
        zone_name: '深大粤海',
        place_name: 'CSV 多餐食来源店',
        address: 'CSV 来源地址',
        lng: 113.91,
        lat: 22.55,
        coordinate_system: 'GCJ-02' as const,
        place_category: '餐馆',
        access_type: 'public',
        menu_item_name: 'CSV 餐食二',
        menu_category: '粉面',
        price_yuan: 19,
        observed_date: '2026-09-01',
        verification_method: 'external_lead' as const,
        evidence_filename: '',
        source_lead_url: 'https://example.com/csv-multi-meal',
        admin_note: '',
      },
    ];
    commitCsv(db, rows);
    const lead = db
      .prepare('SELECT id FROM source_leads WHERE source_url=?')
      .get(rows[0].source_lead_url) as { id: string };
    expect(
      (
        db
          .prepare('SELECT count(*) count FROM source_lead_items WHERE source_lead_id=?')
          .get(lead.id) as { count: number }
      ).count,
    ).toBe(2);
    expect(
      (
        db
          .prepare('SELECT count(*) count FROM price_reports WHERE source_lead_id=?')
          .get(lead.id) as { count: number }
      ).count,
    ).toBe(2);
  });

  it('blocks new external_lead verified prices and keeps public DTO clean', () => {
    const db = testDb();
    const place = new PlaceRepository(db).get('kexing-b1-foodcourt')!;
    const menu = db.prepare('SELECT id FROM menu_items WHERE place_id=? LIMIT 1').get(place.id) as { id: string };
    expect(() => db.prepare('INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)').run('dirty-external', menu.id, 1000, '2026-09-01', 'external_lead', 'verified', new Date().toISOString())).toThrow();
    const dto = toPublicPlace(new PlaceRepository(db).get(place.id)!);
    expect(dto.meals.every((meal) => meal.method !== 'external_lead')).toBe(true);
  });

  it('cleans historical external verified prices while applying the candidate migration', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-migration-'));
    const file = path.join(directory, 'legacy.sqlite');
    files.push(file);
    const legacy = new Database(file);
    legacy.pragma('foreign_keys = ON');
    for (const migration of [
      '001_initial.sql',
      '002_price_source_lead.sql',
      '003_admin_action_indexes.sql',
      '004_price_source_lead_integrity.sql',
      '005_submission_tokens_limits.sql',
    ]) {
      legacy.exec(fs.readFileSync(path.join('db/migrations', migration), 'utf8'));
      legacy
        .prepare('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)')
        .run(Number(migration.slice(0, 3)), new Date().toISOString());
    }
    legacy
      .prepare(
        'INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES (?,?,?,?,?,1)',
      )
      .run('legacy-zone', '旧片区', 'student', 113.9, 22.5);
    legacy
      .prepare(
        'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        'legacy-place',
        'legacy-zone',
        '旧地点',
        '旧地点',
        '旧地址',
        113.9,
        22.5,
        '餐馆',
        'public',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    legacy
      .prepare(
        'INSERT INTO menu_items(id,place_id,name,normalized_name,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        'legacy-menu',
        'legacy-place',
        '旧餐食',
        '旧餐食',
        '米饭',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    legacy
      .prepare(
        'INSERT INTO source_leads(id,source_platform,source_url,clue_place_name,clue_item_name,clue_price_fen,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        'legacy-lead',
        'web',
        'https://example.com/legacy-external',
        '旧地点',
        '旧餐食',
        1800,
        'new',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    legacy
      .prepare(
        'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,source_lead_id,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      )
      .run(
        'legacy-external-price',
        'legacy-menu',
        1800,
        '2026-09-01',
        'external_lead',
        'verified',
        'legacy-lead',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    legacy.close();

    const db = openDatabase(file);
    expect(
      db
        .prepare('SELECT status,reviewed_at FROM price_reports WHERE id=?')
        .get('legacy-external-price'),
    ).toEqual({ status: 'pending', reviewed_at: null });
  });
});
