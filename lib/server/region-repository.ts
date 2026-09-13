import type { SqliteDatabase } from './db';
import { newId } from './seed';
import { recordAudit } from './audit';
import {
  type CoverageStatus,
  type RegionCityOption,
  type RegionLevel,
  type ShenzhenDistrict,
  type ShenzhenRegion,
  type ShenzhenRegionCatalog,
} from '../regions';

interface RegionRow {
  id: string;
  parent_id: string;
  name: string;
  level: RegionLevel;
  center_lng: number;
  center_lat: number;
  bbox_west: number;
  bbox_south: number;
  bbox_east: number;
  bbox_north: number;
  zoom: number;
  sort_order: number;
  active: number;
}

let missingSeedWarned = false;

function warnMissingSeed() {
  if (missingSeedWarned) return;
  missingSeedWarned = true;
  console.warn(
    '[regions] regions 表为空，回退到静态 lib/regions.ts 目录；请运行 `npm run seed:regions`。',
  );
}

/** Coordinates of places that are currently public (same predicate as listPublic). */
function eligiblePoints(db: SqliteDatabase): Array<{ lng: number; lat: number }> {
  return db
    .prepare(
      `SELECT p.lng lng, p.lat lat
       FROM places p JOIN pilot_zones z ON z.id=p.zone_id
       WHERE p.record_status='active' AND p.business_status IN ('open','unknown') AND z.active=1
         AND EXISTS (
           SELECT 1 FROM menu_items em JOIN price_reports ep ON ep.menu_item_id=em.id
           WHERE em.place_id=p.id AND em.active=1
             AND ((ep.status='verified' AND ep.verification_method <> 'external_lead')
                  OR ep.verification_method='external_lead')
             AND ep.price_fen<=2500 AND date(ep.observed_at)>=date('now','-180 day'))`,
    )
    .all() as Array<{ lng: number; lat: number }>;
}

function bboxHasPoint(
  row: RegionRow,
  points: Array<{ lng: number; lat: number }>,
): boolean {
  return points.some(
    (point) =>
      point.lng >= row.bbox_west &&
      point.lng <= row.bbox_east &&
      point.lat >= row.bbox_south &&
      point.lat <= row.bbox_north,
  );
}

function subtitleFor(level: RegionLevel, coverage: CoverageStatus): string {
  if (level === 'city')
    return coverage === 'live' ? '范围内已有饭签' : '已开放浏览 · 待共建';
  if (level === 'district')
    return coverage === 'live' ? '部分商圈已有饭签' : '已开放浏览 · 待共建';
  return coverage === 'live' ? '已有饭签' : '已开放浏览 · 待共建';
}

function toRegion(
  row: RegionRow,
  points: Array<{ lng: number; lat: number }>,
): ShenzhenRegion {
  const coverage: CoverageStatus = bboxHasPoint(row, points) ? 'live' : 'planned';
  return {
    id: row.id,
    label: row.name,
    level: row.level,
    subtitle: subtitleFor(row.level, coverage),
    coverage,
    centerLng: row.center_lng,
    centerLat: row.center_lat,
    bbox: [row.bbox_west, row.bbox_south, row.bbox_east, row.bbox_north],
    zoom: row.zoom,
  };
}

export function listRegionCities(db: SqliteDatabase): RegionCityOption[] {
  const rows = db
    .prepare(
      "SELECT * FROM regions WHERE level='city' AND active=1 ORDER BY sort_order, name",
    )
    .all() as RegionRow[];
  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    centerLng: row.center_lng,
    centerLat: row.center_lat,
    bbox: [row.bbox_west, row.bbox_south, row.bbox_east, row.bbox_north],
    zoom: row.zoom,
  }));
}

/**
 * Build the region catalog for one city from the `regions` table. Returns null
 * when the table is empty so the caller can fall back to the static catalog.
 * Coverage is derived from whether a bbox contains a public point.
 */
export function buildRegionCatalog(
  db: SqliteDatabase,
  cityId = 'shenzhen',
): ShenzhenRegionCatalog | null {
  const rows = db
    .prepare('SELECT * FROM regions WHERE active=1 ORDER BY sort_order, name')
    .all() as RegionRow[];
  const cityRows = rows.filter((row) => row.level === 'city');
  if (!cityRows.length) {
    warnMissingSeed();
    return null;
  }
  const points = eligiblePoints(db);
  const cityRow = cityRows.find((row) => row.id === cityId) ?? cityRows[0];
  const districts: ShenzhenDistrict[] = rows
    .filter((row) => row.level === 'district' && row.parent_id === cityRow.id)
    .map((districtRow) => {
      const businessAreas = rows
        .filter(
          (row) =>
            row.level === 'business_area' && row.parent_id === districtRow.id,
        )
        .map((row) => ({
          ...toRegion(row, points),
          level: 'business_area' as const,
          districtId: districtRow.id,
        }));
      return {
        ...toRegion(districtRow, points),
        level: 'district' as const,
        businessAreas,
      };
    });
  return {
    city: toRegion(cityRow, points),
    districts,
    cities: cityRows.map((row) => ({
      id: row.id,
      label: row.name,
      centerLng: row.center_lng,
      centerLat: row.center_lat,
      bbox: [row.bbox_west, row.bbox_south, row.bbox_east, row.bbox_north],
      zoom: row.zoom,
    })),
  };
}

// --- Administrative writes (PLAN-REGIONS) -----------------------------------

export class RegionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RegionError';
  }
}

export interface RegionWriteInput {
  id?: string;
  parentId: string;
  name: string;
  level: RegionLevel;
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
  sortOrder: number;
}

export interface RegionPatchInput {
  name?: string;
  centerLng?: number;
  centerLat?: number;
  bbox?: [number, number, number, number];
  zoom?: number;
  sortOrder?: number;
  active?: boolean;
}

export interface AdminRegionRow {
  id: string;
  parentId: string;
  name: string;
  level: RegionLevel;
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
  sortOrder: number;
  active: boolean;
}

const PEARL_RIVER_BOUNDS = {
  west: 111.3,
  south: 21.7,
  east: 115.4,
  north: 24.3,
};

function rowById(db: SqliteDatabase, id: string): RegionRow | undefined {
  return db.prepare('SELECT * FROM regions WHERE id=?').get(id) as
    | RegionRow
    | undefined;
}

function cityAncestorOf(db: SqliteDatabase, parentId: string): RegionRow | undefined {
  let current = parentId ? rowById(db, parentId) : undefined;
  while (current && current.level !== 'city') {
    current = current.parent_id ? rowById(db, current.parent_id) : undefined;
  }
  return current;
}

function assertBbox(input: {
  bbox: [number, number, number, number];
  centerLng: number;
  centerLat: number;
  city?: RegionRow;
  level: RegionLevel;
}) {
  const [west, south, east, north] = input.bbox;
  if (!(west < east && south < north))
    throw new RegionError('REGION_BBOX_INVALID', 'bbox 需满足西<东、南<北');
  if (
    input.centerLng < west ||
    input.centerLng > east ||
    input.centerLat < south ||
    input.centerLat > north
  )
    throw new RegionError('REGION_CENTER_OUTSIDE', '中心点必须落在 bbox 内');
  if (input.level === 'city') {
    if (
      west < PEARL_RIVER_BOUNDS.west ||
      east > PEARL_RIVER_BOUNDS.east ||
      south < PEARL_RIVER_BOUNDS.south ||
      north > PEARL_RIVER_BOUNDS.north
    )
      throw new RegionError('REGION_OUT_OF_RANGE', '城市范围超出珠三角');
    return;
  }
  const city = input.city;
  if (!city) throw new RegionError('REGION_CITY_MISSING', '找不到所属城市');
  const intersects =
    west < city.bbox_east &&
    east > city.bbox_west &&
    south < city.bbox_north &&
    north > city.bbox_south;
  if (!intersects)
    throw new RegionError('REGION_OUT_OF_CITY', '区域必须落在所属城市范围内');
}

function parentForLevel(
  db: SqliteDatabase,
  input: { parentId: string; level: RegionLevel },
): RegionRow | undefined {
  if (input.level === 'city') {
    if (input.parentId)
      throw new RegionError('REGION_PARENT_INVALID', '城市不能有父级');
    return undefined;
  }
  const parent = input.parentId ? rowById(db, input.parentId) : undefined;
  if (!parent) throw new RegionError('REGION_PARENT_MISSING', '父级区域不存在');
  const expected = input.level === 'district' ? 'city' : 'district';
  if (parent.level !== expected)
    throw new RegionError(
      'REGION_PARENT_LEVEL_INVALID',
      input.level === 'district' ? '行政区必须挂在城市下' : '商圈必须挂在行政区下',
    );
  return parent;
}

export function listAdminRegions(db: SqliteDatabase): AdminRegionRow[] {
  const rows = db
    .prepare('SELECT * FROM regions ORDER BY level, sort_order, name')
    .all() as Array<RegionRow & { active: number }>;
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    level: row.level,
    centerLng: row.center_lng,
    centerLat: row.center_lat,
    bbox: [row.bbox_west, row.bbox_south, row.bbox_east, row.bbox_north],
    zoom: row.zoom,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
  }));
}

export function createRegion(
  db: SqliteDatabase,
  input: RegionWriteInput,
  actor = 'admin',
): string {
  parentForLevel(db, { parentId: input.parentId, level: input.level });
  const city =
    input.level === 'city' ? undefined : cityAncestorOf(db, input.parentId);
  assertBbox({
    bbox: input.bbox,
    centerLng: input.centerLng,
    centerLat: input.centerLat,
    city,
    level: input.level,
  });
  const id = input.id?.trim() || newId('region');
  if (rowById(db, id)) throw new RegionError('REGION_ID_TAKEN', '区域 ID 已存在');
  const duplicate = db
    .prepare('SELECT 1 FROM regions WHERE parent_id=? AND name=?')
    .get(input.parentId, input.name);
  if (duplicate)
    throw new RegionError('REGION_NAME_DUPLICATE', '同一父级下名称重复');
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO regions(
         id, parent_id, name, level, center_lng, center_lat,
         bbox_west, bbox_south, bbox_east, bbox_north, zoom, sort_order,
         active, created_at, updated_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
    ).run(
      id,
      input.parentId,
      input.name,
      input.level,
      input.centerLng,
      input.centerLat,
      input.bbox[0],
      input.bbox[1],
      input.bbox[2],
      input.bbox[3],
      input.zoom,
      input.sortOrder,
      now,
      now,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE'))
      throw new RegionError('REGION_NAME_DUPLICATE', '同一父级下名称重复');
    throw error;
  }
  recordAudit(db, actor, 'region', id, 'create', undefined, input);
  return id;
}

export function patchRegion(
  db: SqliteDatabase,
  id: string,
  patch: RegionPatchInput,
  actor = 'admin',
): void {
  const before = rowById(db, id);
  if (!before) throw new RegionError('REGION_NOT_FOUND', '区域不存在');
  if (patch.active !== undefined && before.level !== 'business_area')
    throw new RegionError(
      'REGION_NOT_DISABLEABLE',
      '仅商圈支持停用；城市与行政区不可停用',
    );
  const bbox: [number, number, number, number] = patch.bbox ?? [
    before.bbox_west,
    before.bbox_south,
    before.bbox_east,
    before.bbox_north,
  ];
  const centerLng = patch.centerLng ?? before.center_lng;
  const centerLat = patch.centerLat ?? before.center_lat;
  const city =
    before.level === 'city' ? undefined : cityAncestorOf(db, before.parent_id);
  assertBbox({ bbox, centerLng, centerLat, city, level: before.level });
  const name = patch.name ?? before.name;
  const duplicate = db
    .prepare('SELECT 1 FROM regions WHERE parent_id=? AND name=? AND id<>?')
    .get(before.parent_id, name, id);
  if (duplicate)
    throw new RegionError('REGION_NAME_DUPLICATE', '同一父级下名称重复');
  db.prepare(
    `UPDATE regions SET name=?, center_lng=?, center_lat=?,
       bbox_west=?, bbox_south=?, bbox_east=?, bbox_north=?,
       zoom=?, sort_order=?, active=?, updated_at=? WHERE id=?`,
  ).run(
    name,
    centerLng,
    centerLat,
    bbox[0],
    bbox[1],
    bbox[2],
    bbox[3],
    patch.zoom ?? before.zoom,
    patch.sortOrder ?? before.sort_order,
    patch.active === undefined ? before.active : patch.active ? 1 : 0,
    new Date().toISOString(),
    id,
  );
  recordAudit(db, actor, 'region', id, 'patch', before, patch);
}
