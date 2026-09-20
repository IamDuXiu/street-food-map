import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { seedRegions } from '@/scripts/seed-regions';
import {
  commitCreatorImport,
  previewCreatorImport,
} from '@/lib/server/creator-import';
import { PlaceRepository } from '@/lib/server/repository';
import { videoToLead, type CreatorLeadRecord } from '@/scripts/creator-collect';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-collect-import-'));
  roots.push(root);
  const db = openDatabase(path.join(root, 'collect.sqlite'));
  seedRegions(db);
  return db;
}

describe('采集结果端到端导入', () => {
  it('采集记录补坐标后可通过预览/提交进入公开地图', async () => {
    const db = tempDb();
    const { record } = videoToLead({
      platform: 'bilibili',
      creatorName: '粤城旧事',
      contentUrl: 'https://www.bilibili.com/video/BV1jRYL64E3G/',
      contentTitle: '老广食广州丨宏兴茶餐厅丨番禺人均12元！',
    });
    expect(record).toBeDefined();

    // Simulate the admin coordinate picker filling the missing GCJ-02 coords.
    const withCoords: CreatorLeadRecord = {
      ...(record as CreatorLeadRecord),
      lng: 113.386903,
      lat: 23.004767,
    } as CreatorLeadRecord & { lng: number; lat: number };

    const preview = await previewCreatorImport(db, [withCoords]);
    expect(preview.valid).toBe(true);
    expect(preview.rows[0].status).toBe('ready');

    const results = commitCreatorImport(db, [withCoords]);
    expect(results).toHaveLength(1);

    const place = new PlaceRepository(db).listPublic({ now: new Date() })[0];
    expect(place).toBeDefined();
    expect(place.name).toBe('宏兴茶餐厅');
    expect(place.verification).toBe('低可信');
    expect(place.meals[0].unverified).toBe(true);
    expect(place.meals[0].source).toBe('bilibili@粤城旧事');
    db.close();
  });
});
