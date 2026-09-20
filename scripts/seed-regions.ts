import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, type SqliteDatabase } from '../lib/server/db';
import { CITIES, publicCityRank } from '../lib/cities';
import { SHENZHEN_CITY, SHENZHEN_DISTRICTS, type ShenzhenRegion } from '../lib/regions';
import {
  NATIONAL_CITY_DISTRICTS,
  PEARL_RIVER_DISTRICTS,
} from '../lib/region-districts';

export type RegionSeedLevel = 'city' | 'district' | 'business_area';

export interface RegionSeedRecord {
  id: string;
  parentId: string;
  name: string;
  level: RegionSeedLevel;
  centerLng: number;
  centerLat: number;
  bbox: [number, number, number, number];
  zoom: number;
  sortOrder: number;
}

function citySortOrder(id: string): number {
  const rank = publicCityRank(id);
  if (Number.isFinite(rank)) return rank;
  const index = CITIES.findIndex((city) => city.id === id);
  return 20 + (index < 0 ? 0 : index);
}

const CITY_SEEDS: RegionSeedRecord[] = CITIES.filter(
  (city) => city.id !== 'shenzhen',
).map((city) => ({
  id: city.id,
  parentId: '',
  name: city.full,
  level: 'city' as const,
  centerLng: city.centerLng,
  centerLat: city.centerLat,
  bbox: city.bbox,
  zoom: city.zoom,
  sortOrder: citySortOrder(city.id),
}));

function toRecord(
  region: ShenzhenRegion,
  parentId: string,
  sortOrder: number,
): RegionSeedRecord {
  if (!region.bbox || region.zoom === undefined)
    throw new Error(`REGION_VIEWPORT_REQUIRED: ${region.id}`);
  return {
    id: region.id,
    parentId,
    name: region.label,
    level: region.level,
    centerLng: region.centerLng,
    centerLat: region.centerLat,
    bbox: region.bbox,
    zoom: region.zoom,
    sortOrder,
  };
}

export function regionSeedRecords(): RegionSeedRecord[] {
  const shenzhen = toRecord(SHENZHEN_CITY, '', citySortOrder('shenzhen'));
  const records: RegionSeedRecord[] = [shenzhen];
  SHENZHEN_DISTRICTS.forEach((district, districtIndex) => {
    records.push(toRecord(district, SHENZHEN_CITY.id, districtIndex));
    district.businessAreas.forEach((area, areaIndex) => {
      records.push(toRecord(area, district.id, areaIndex));
    });
  });
  const cityDistricts: RegionSeedRecord[] = [
    ...PEARL_RIVER_DISTRICTS,
    ...NATIONAL_CITY_DISTRICTS,
  ].map((district) => ({
    id: district.id,
    parentId: district.cityId,
    name: district.name,
    level: 'district' as const,
    centerLng: district.centerLng,
    centerLat: district.centerLat,
    bbox: district.bbox,
    zoom: district.zoom,
    sortOrder: district.sortOrder,
  }));
  return records.concat(CITY_SEEDS, cityDistricts);
}

export function seedRegions(db: SqliteDatabase): number {
  const records = regionSeedRecords();
  const ids = new Set(records.map((record) => record.id));
  if (ids.size !== records.length) throw new Error('REGION_ID_DUPLICATE');
  for (const record of records) {
    const [west, south, east, north] = record.bbox;
    if (!(west < east && south < north))
      throw new Error(`REGION_BBOX_INVALID: ${record.id}`);
    if (record.level !== 'city' && !ids.has(record.parentId))
      throw new Error(`REGION_PARENT_MISSING: ${record.id}`);
  }
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO regions(
       id, parent_id, name, level, center_lng, center_lat,
       bbox_west, bbox_south, bbox_east, bbox_north, zoom, sort_order,
       active, created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
     ON CONFLICT(id) DO UPDATE SET
       parent_id=excluded.parent_id, name=excluded.name, level=excluded.level,
       center_lng=excluded.center_lng, center_lat=excluded.center_lat,
       bbox_west=excluded.bbox_west, bbox_south=excluded.bbox_south,
       bbox_east=excluded.bbox_east, bbox_north=excluded.bbox_north,
       zoom=excluded.zoom, sort_order=excluded.sort_order,
       active=1, updated_at=excluded.updated_at`,
  );
  const apply = db.transaction(() => {
    for (const record of records) {
      upsert.run(
        record.id,
        record.parentId,
        record.name,
        record.level,
        record.centerLng,
        record.centerLat,
        record.bbox[0],
        record.bbox[1],
        record.bbox[2],
        record.bbox[3],
        record.zoom,
        record.sortOrder,
        now,
        now,
      );
    }
  });
  apply();
  return records.length;
}

export function seedRegionsInDefaultDatabase() {
  return seedRegions(openDatabase());
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const count = seedRegionsInDefaultDatabase();
  console.log(`Regions seeded: ${count}`);
}
