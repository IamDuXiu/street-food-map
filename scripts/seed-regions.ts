import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, type SqliteDatabase } from '../lib/server/db';
import { SHENZHEN_CITY, SHENZHEN_DISTRICTS, type ShenzhenRegion } from '../lib/regions';

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

const PRD_CITY_SEEDS: RegionSeedRecord[] = [
  ['guangzhou', '广州市', 113.264, 23.129, [112.95, 22.4, 113.74, 23.95], 10],
  ['foshan', '佛山市', 113.122, 23.028, [112.38, 22.63, 113.3, 23.57], 10],
  ['dongguan', '东莞市', 113.751, 23.02, [113.45, 22.65, 114.15, 23.15], 10],
  ['zhongshan', '中山市', 113.392, 22.517, [113.13, 22.2, 113.6, 22.75], 10],
  ['zhuhai', '珠海市', 113.576, 22.271, [113.05, 21.85, 114.15, 22.55], 10],
  ['huizhou', '惠州市', 114.416, 23.111, [113.85, 22.55, 115.35, 23.95], 9],
  ['jiangmen', '江门市', 113.081, 22.579, [111.95, 21.7, 113.65, 23.1], 9],
  ['zhaoqing', '肇庆市', 112.465, 23.047, [111.35, 22.75, 112.85, 24.25], 9],
].map(([id, name, centerLng, centerLat, bbox, zoom], index) => ({
  id: id as string,
  parentId: '',
  name: name as string,
  level: 'city' as const,
  centerLng: centerLng as number,
  centerLat: centerLat as number,
  bbox: bbox as [number, number, number, number],
  zoom: zoom as number,
  sortOrder: index + 1,
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
  const records: RegionSeedRecord[] = [toRecord(SHENZHEN_CITY, '', 0)];
  SHENZHEN_DISTRICTS.forEach((district, districtIndex) => {
    records.push(toRecord(district, SHENZHEN_CITY.id, districtIndex));
    district.businessAreas.forEach((area, areaIndex) => {
      records.push(toRecord(area, district.id, areaIndex));
    });
  });
  return records.concat(PRD_CITY_SEEDS);
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
