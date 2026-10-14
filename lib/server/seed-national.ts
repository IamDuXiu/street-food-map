/**
 * 写入全国 5 城演示数据（`SEED_DEMO` 不为 0 时由 bootstrap / setup 调用）。
 *
 * 与 `seedDemo`（深圳样板区 + 投稿/线索，测试依赖其 id）分开：那个函数被大量单测调用，
 * 这里的数据只用于「部署后直观体验」，所以不放进 `seedDemo`。
 *
 * 幂等：片区/门店/餐食/来源用 INSERT OR IGNORE；价格用 ON CONFLICT DO UPDATE，
 * 这样重复执行会把相对日期刷新到「最近」（否则部署得越晚，演示数据越早全部过期）。
 */
import { DEMO_AREAS } from '../demo-dataset';
import { TAGS } from '../fixtures';
import type { SqliteDatabase } from './db';
import { normalize } from './seed';

/** 展示在门店卡片上的片区名前缀：既是命名空间，也让「这是演示数据」一眼可见。 */
export const DEMO_ZONE_PREFIX = '演示片区 · ';

/** 绕开片区中心的小网格偏移，保证落点仍在所属行政区 bbox 内。 */
const SLOT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-0.006, 0.004],
  [0.005, 0.004],
  [-0.004, -0.005],
  [0.006, -0.004],
  [0, 0.006],
  [0.002, 0],
  [-0.007, -0.002],
  [0.007, 0.006],
  [-0.002, -0.007],
];

export interface NationalDemoSeedResult {
  areas: number;
  places: number;
  meals: number;
  creatorSources: number;
}

export function seedNationalDemo(db: SqliteDatabase): NationalDemoSeedResult {
  const now = new Date();
  const created = now.toISOString();
  const daysAgoIso = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 86400000).toISOString().slice(0, 10);

  let meals = 0;
  let creatorSources = 0;

  const apply = db.transaction(() => {
    const tag = db.prepare('INSERT OR IGNORE INTO tags(id,name) VALUES (?,?)');
    TAGS.forEach((name) => tag.run(name, name));

    const zone = db.prepare(
      'INSERT OR IGNORE INTO pilot_zones(id,name,audience,center_lng,center_lat,city,active) VALUES (?,?,?,?,?,?,1)',
    );
    const place = db.prepare(
      'INSERT OR IGNORE INTO places(id,zone_id,city,name,normalized_name,address,lng,lat,category,access_type,access_note,business_status,record_status,opening_hours_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    const menu = db.prepare(
      'INSERT OR IGNORE INTO menu_items(id,place_id,name,normalized_name,category,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)',
    );
    const price = db.prepare(
      `INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,reviewed_at,created_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET price_fen=excluded.price_fen,observed_at=excluded.observed_at,verification_method=excluded.verification_method,status=excluded.status,reviewed_at=excluded.reviewed_at`,
    );
    const placeTag = db.prepare(
      'INSERT OR IGNORE INTO place_tags(place_id,tag_id) VALUES (?,?)',
    );
    const source = db.prepare(
      'INSERT OR IGNORE INTO entity_sources(entity_type,entity_id,platform,creator_name,content_url,observed_at,created_at) VALUES (?,?,?,?,?,?,?)',
    );

    for (const area of DEMO_AREAS) {
      zone.run(
        area.id,
        `${DEMO_ZONE_PREFIX}${area.name}`,
        area.audience,
        area.centerLng,
        area.centerLat,
        area.city,
      );

      area.places.forEach((item, index) => {
        const [dLng, dLat] = SLOT_OFFSETS[index % SLOT_OFFSETS.length];
        const placeId = `demo-place-${item.slug}`;
        const lng = Number((area.centerLng + dLng).toFixed(6));
        const lat = Number((area.centerLat + dLat).toFixed(6));
        place.run(
          placeId,
          area.id,
          area.city,
          item.name,
          normalize(item.name),
          item.address,
          lng,
          lat,
          item.category,
          item.access.includes('公开') ? 'public' : 'identity_restricted',
          item.access,
          'open',
          'active',
          item.note,
          created,
          created,
        );
        item.tags.forEach((name) => placeTag.run(placeId, name));

        item.meals.forEach((meal, mealIndex) => {
          const menuItemId = `demo-menu-${item.slug}-${mealIndex + 1}`;
          const isCreator = meal.method === 'external_lead';
          menu.run(
            menuItemId,
            placeId,
            meal.name,
            normalize(meal.name),
            meal.category,
            meal.description,
            created,
            created,
          );
          // 触发器禁止 external_lead 变成 verified；未核验价一律 pending。
          price.run(
            `demo-price-${item.slug}-${mealIndex + 1}`,
            menuItemId,
            meal.priceYuan * 100,
            daysAgoIso(meal.daysAgo),
            meal.method,
            isCreator ? 'pending' : 'verified',
            isCreator ? null : created,
            created,
          );
          if (isCreator && item.creatorSource) {
            source.run(
              'menu_item',
              menuItemId,
              item.creatorSource.platform,
              item.creatorSource.creatorName,
              item.creatorSource.contentUrl,
              daysAgoIso(meal.daysAgo),
              created,
            );
            creatorSources += 1;
          }
          meals += 1;
        });

        if (item.creatorSource) {
          source.run(
            'place',
            placeId,
            item.creatorSource.platform,
            item.creatorSource.creatorName,
            item.creatorSource.contentUrl,
            daysAgoIso(item.meals[0]?.daysAgo ?? 0),
            created,
          );
        }
      });
    }
  });

  apply();

  return {
    areas: DEMO_AREAS.length,
    places: DEMO_AREAS.reduce((total, area) => total + area.places.length, 0),
    meals,
    creatorSources,
  };
}
