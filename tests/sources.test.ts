import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '@/lib/server/db';
import { PlaceRepository } from '@/lib/server/repository';
import { toPublicPlace } from '@/lib/server/public';
import {
  addEntitySource,
  formatSourceLabels,
  listEntitySourceLabels,
  listEntitySources,
} from '@/lib/server/sources';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function tempDb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sources-'));
  roots.push(root);
  return openDatabase(path.join(root, 'sources.sqlite'));
}

describe('来源标签格式化', () => {
  it('空来源返回空串', () => {
    expect(formatSourceLabels([])).toBe('');
  });

  it('去重并按平台顺序、创作者名排序后以分号连接', () => {
    expect(
      formatSourceLabels([
        { platform: 'youtube', creatorName: '品城記' },
        { platform: 'bilibili', creatorName: '品城记本地版' },
        { platform: 'bilibili', creatorName: '品城记本地版' },
      ]),
    ).toBe('bilibili@品城记本地版;youtube@品城記');
  });
});

describe('entity_sources 读写', () => {
  it('同一来源重复写入保持幂等', () => {
    const db = tempDb();
    addEntitySource(db, 'place', 'p1', {
      platform: 'bilibili',
      creatorName: '某UP主',
      contentUrl: 'https://example.com/v1',
      observedAt: '2026-09-01',
    });
    addEntitySource(db, 'place', 'p1', {
      platform: 'bilibili',
      creatorName: '某UP主',
      contentUrl: 'https://example.com/v2',
    });
    const list = listEntitySources(db, 'place', 'p1');
    expect(list).toHaveLength(1);
    expect(list[0].contentUrl).toBe('https://example.com/v1');
    expect(listEntitySourceLabels(db, 'place', 'p1')).toBe('bilibili@某UP主');
    db.close();
  });
});

describe('公开读模型挂载来源', () => {
  it('地点级与菜品级来源分别挂载', () => {
    const db = tempDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('z','片区','student',113.93,22.53,1)",
    ).run();
    db.prepare(
      'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run('place-1', 'z', '某快餐店', '某快餐店', '某地址', 113.93, 22.53, '快餐', 'public', now, now);
    db.prepare(
      'INSERT INTO menu_items(id,place_id,name,normalized_name,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run('menu-1', 'place-1', '卤肉饭', '卤肉饭', '米饭', now, now);
    db.prepare(
      'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)',
    ).run('price-1', 'menu-1', 1200, '2026-09-01', 'onsite_menu', 'verified', now);

    addEntitySource(db, 'place', 'place-1', { platform: 'youtube', creatorName: '品城記' });
    addEntitySource(db, 'place', 'place-1', { platform: 'bilibili', creatorName: '品城记本地版' });
    addEntitySource(db, 'menu_item', 'menu-1', { platform: 'bilibili', creatorName: '雪鱼探店' });

    const place = new PlaceRepository(db).get('place-1');
    expect(place?.sources).toBe('bilibili@品城记本地版;youtube@品城記');
    expect(place?.meals[0]?.source).toBe('bilibili@雪鱼探店');

    const dto = toPublicPlace(place!);
    expect(dto.sources).toBe('bilibili@品城记本地版;youtube@品城記');
    expect(dto.meals[0]?.source).toBe('bilibili@雪鱼探店');
    db.close();
  });

  it('无来源时不挂载 sources 字段', () => {
    const db = tempDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('z','片区','student',113.93,22.53,1)",
    ).run();
    db.prepare(
      'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run('place-2', 'z', '无来源店', '无来源店', '地址', 113.93, 22.53, '快餐', 'public', now, now);
    const place = new PlaceRepository(db).get('place-2');
    expect(place && 'sources' in place).toBe(false);
    db.close();
  });
});
