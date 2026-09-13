import type { SqliteDatabase } from './db';

export const CREATOR_PLATFORMS = [
  'bilibili',
  'youtube',
  'xiaohongshu',
  'douyin',
  'dianping',
] as const;

export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];

export type EntitySourceType = 'place' | 'menu_item';

export interface SourceInput {
  platform: string;
  creatorName: string;
  contentUrl?: string | null;
  observedAt?: string | null;
}

export interface EntitySource {
  entityType: EntitySourceType;
  entityId: string;
  platform: string;
  creatorName: string;
  contentUrl: string | null;
  observedAt: string | null;
}

const PLATFORM_RANK = new Map(
  CREATOR_PLATFORMS.map((platform, index) => [platform, index]),
);

function platformRank(platform: string) {
  return PLATFORM_RANK.get(platform as CreatorPlatform) ?? CREATOR_PLATFORMS.length;
}

/** Stable source token: `platform@creator` (internal platform token, as stored). */
export function sourceToken(source: Pick<SourceInput, 'platform' | 'creatorName'>) {
  return `${source.platform}@${source.creatorName}`;
}

/**
 * Dedupe, order by platform then creator, and join with `;`.
 * Example: `bilibili@品城记本地版;youtube@品城記`.
 */
export function formatSourceLabels(
  sources: Array<Pick<SourceInput, 'platform' | 'creatorName'>>,
): string {
  const seen = new Set<string>();
  const entries: Array<{ token: string; platform: string; creatorName: string }> = [];
  for (const source of sources) {
    const token = sourceToken(source);
    if (seen.has(token)) continue;
    seen.add(token);
    entries.push({ token, platform: source.platform, creatorName: source.creatorName });
  }
  entries.sort(
    (a, b) =>
      platformRank(a.platform) - platformRank(b.platform) ||
      a.creatorName.localeCompare(b.creatorName, 'zh-Hans-CN'),
  );
  return entries.map((entry) => entry.token).join(';');
}

export function addEntitySource(
  db: SqliteDatabase,
  entityType: EntitySourceType,
  entityId: string,
  source: SourceInput,
  now = new Date().toISOString(),
) {
  db.prepare(
    `INSERT OR IGNORE INTO entity_sources(
       entity_type, entity_id, platform, creator_name, content_url, observed_at, created_at
     ) VALUES (?,?,?,?,?,?,?)`,
  ).run(
    entityType,
    entityId,
    source.platform,
    source.creatorName,
    source.contentUrl ?? null,
    source.observedAt ?? null,
    now,
  );
}

function mapRow(row: Record<string, unknown>): EntitySource {
  return {
    entityType: String(row.entity_type) as EntitySourceType,
    entityId: String(row.entity_id),
    platform: String(row.platform),
    creatorName: String(row.creator_name),
    contentUrl: row.content_url ? String(row.content_url) : null,
    observedAt: row.observed_at ? String(row.observed_at) : null,
  };
}

export function listEntitySources(
  db: SqliteDatabase,
  entityType: EntitySourceType,
  entityId: string,
): EntitySource[] {
  const rows = db
    .prepare(
      `SELECT entity_type, entity_id, platform, creator_name, content_url, observed_at
       FROM entity_sources WHERE entity_type=? AND entity_id=?
       ORDER BY platform, creator_name`,
    )
    .all(entityType, entityId) as Array<Record<string, unknown>>;
  return rows.map(mapRow);
}

export function listEntitySourceLabels(
  db: SqliteDatabase,
  entityType: EntitySourceType,
  entityId: string,
): string {
  return formatSourceLabels(listEntitySources(db, entityType, entityId));
}

export interface PlaceSourceView {
  placeLabels: string;
  byMenuItem: Record<string, string>;
}

/** One query for all sources of a place and its menu items. */
export function loadPlaceSourceView(
  db: SqliteDatabase,
  placeId: string,
): PlaceSourceView {
  const rows = db
    .prepare(
      `SELECT entity_type, entity_id, platform, creator_name FROM entity_sources
       WHERE (entity_type='place' AND entity_id=?)
          OR (entity_type='menu_item'
              AND entity_id IN (SELECT id FROM menu_items WHERE place_id=?))`,
    )
    .all(placeId, placeId) as Array<Record<string, unknown>>;
  const placeSources: Array<{ platform: string; creatorName: string }> = [];
  const grouped = new Map<string, Array<{ platform: string; creatorName: string }>>();
  for (const row of rows) {
    const item = {
      platform: String(row.platform),
      creatorName: String(row.creator_name),
    };
    if (String(row.entity_type) === 'place') placeSources.push(item);
    else {
      const key = String(row.entity_id);
      const list = grouped.get(key) ?? [];
      list.push(item);
      grouped.set(key, list);
    }
  }
  const byMenuItem: Record<string, string> = {};
  for (const [id, list] of grouped) byMenuItem[id] = formatSourceLabels(list);
  return { placeLabels: formatSourceLabels(placeSources), byMenuItem };
}
