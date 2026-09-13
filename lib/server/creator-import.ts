import { z } from 'zod';
import type { SqliteDatabase } from './db';
import { newId, normalize } from './seed';
import {
  addMenuItem,
  PlaceRepository,
  replacePrice,
} from './repository';
import { recordAudit } from './audit';
import { duplicateCandidates } from './services';
import { addEntitySource } from './sources';
import { geocodeAddress, isPlaceholderAddress, type GeocodeCandidate } from './geocode';
import { distanceMeters } from '../geo';

export const PEARL_RIVER_LNG_RANGE = [111.3, 115.4] as const;
export const PEARL_RIVER_LAT_RANGE = [21.7, 24.3] as const;
const PLACE_MERGE_DISTANCE_METERS = 150;

export const creatorImportRecordSchema = z
  .object({
    storeName: z.string().trim().min(1).max(120),
    mealName: z.string().trim().min(1).max(120),
    priceYuan: z.number().positive().max(25),
    address: z.string().trim().min(1).max(240),
    city: z.string().trim().min(1).max(40),
    placeCategory: z.string().trim().min(1).max(40).default('街边快餐'),
    accessType: z.string().trim().min(1).max(40).default('public'),
    lng: z.number().finite().optional(),
    lat: z.number().finite().optional(),
    observedAt: z.string().date().optional(),
    platform: z.string().trim().min(1).max(40),
    creatorName: z.string().trim().min(1).max(120),
    contentUrl: z.string().url().optional().or(z.literal('')),
    contentTitle: z.string().max(200).optional(),
    matchedPlaceId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.lng === undefined || value.lat === undefined) return;
    if (
      value.lng < PEARL_RIVER_LNG_RANGE[0] ||
      value.lng > PEARL_RIVER_LNG_RANGE[1]
    )
      ctx.addIssue({ code: 'custom', path: ['lng'], message: '经度超出珠三角范围' });
    if (
      value.lat < PEARL_RIVER_LAT_RANGE[0] ||
      value.lat > PEARL_RIVER_LAT_RANGE[1]
    )
      ctx.addIssue({ code: 'custom', path: ['lat'], message: '纬度超出珠三角范围' });
  });

export type CreatorImportRecord = z.infer<typeof creatorImportRecordSchema>;

export interface CreatorImportPreviewRow {
  index: number;
  status: 'ready' | 'needs_coordinates' | 'invalid';
  storeName: string;
  mealName: string;
  city: string;
  lng?: number;
  lat?: number;
  geocodeCandidates?: GeocodeCandidate[];
  matchedPlaceId?: string | null;
  errors: string[];
}

export interface CreatorImportPreview {
  valid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
  rows: CreatorImportPreviewRow[];
}

type Geocoder = (address: string) => Promise<GeocodeCandidate[]>;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function findPlaceForRecord(
  db: SqliteDatabase,
  input: {
    name: string;
    lng: number;
    lat: number;
    matchedPlaceId?: string;
  },
): string | null {
  if (input.matchedPlaceId) {
    const matched = db
      .prepare("SELECT id FROM places WHERE id=? AND record_status='active'")
      .get(input.matchedPlaceId) as { id: string } | undefined;
    if (matched) return matched.id;
  }
  const candidates = db
    .prepare(
      "SELECT id,lng,lat FROM places WHERE normalized_name=? AND record_status='active'",
    )
    .all(normalize(input.name)) as Array<{ id: string; lng: number; lat: number }>;
  for (const candidate of candidates) {
    if (
      distanceMeters(
        { lng: input.lng, lat: input.lat },
        { lng: candidate.lng, lat: candidate.lat },
      ) <= PLACE_MERGE_DISTANCE_METERS
    )
      return candidate.id;
  }
  return null;
}

function ensureCreatorZone(db: SqliteDatabase, city: string): string {
  const id = `creator-${city}`;
  const existing = db
    .prepare('SELECT id FROM pilot_zones WHERE id=?')
    .get(id) as { id: string } | undefined;
  if (existing) return id;
  const region = db
    .prepare(
      "SELECT name,center_lng,center_lat FROM regions WHERE id=? AND level='city'",
    )
    .get(city) as
    | { name: string; center_lng: number; center_lat: number }
    | undefined;
  db.prepare(
    'INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES (?,?,?,?,?,1)',
  ).run(
    id,
    `${region?.name ?? city} · 创作者来源`,
    'office_worker',
    region?.center_lng ?? 113.9,
    region?.center_lat ?? 22.5,
  );
  return id;
}

function ensureMenuItem(
  db: SqliteDatabase,
  placeId: string,
  name: string,
  category: string,
  actor: string,
): string {
  const existing = db
    .prepare('SELECT id FROM menu_items WHERE place_id=? AND normalized_name=?')
    .get(placeId, normalize(name)) as { id: string } | undefined;
  if (existing) return existing.id;
  return addMenuItem(db, { placeId, name, category }, actor);
}

function ensureContentLead(
  db: SqliteDatabase,
  record: CreatorImportRecord,
  placeId: string,
  now: string,
): string | undefined {
  if (!record.contentUrl) return undefined;
  const existing = db
    .prepare('SELECT id FROM source_leads WHERE content_url=?')
    .get(record.contentUrl) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = newId('lead');
  db.prepare(
    `INSERT INTO source_leads(
       id, source_platform, source_url, clue_place_name, clue_item_name, clue_price_fen,
       summary, status, matched_place_id, discovery_method,
       platform, content_title, content_url, published_at, city, public_visibility,
       created_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    'other',
    null,
    record.storeName,
    record.mealName,
    Math.round(record.priceYuan * 100),
    null,
    'converted',
    placeId,
    'creator',
    record.platform,
    record.contentTitle ?? null,
    record.contentUrl,
    record.observedAt ?? null,
    record.city,
    'listed',
    now,
    now,
  );
  return id;
}

export async function previewCreatorImport(
  db: SqliteDatabase,
  records: unknown[],
  options: { geocode?: Geocoder } = {},
): Promise<CreatorImportPreview> {
  const geocode = options.geocode ?? geocodeAddress;
  const errors: CreatorImportPreview['errors'] = [];
  const rows: CreatorImportPreviewRow[] = [];
  for (const [index, raw] of records.entries()) {
    const parsed = creatorImportRecordSchema.safeParse(raw);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      parsed.error.issues.forEach((issue) =>
        errors.push({
          row: index,
          field: String(issue.path[0] ?? ''),
          message: issue.message,
        }),
      );
      rows.push({
        index,
        status: 'invalid',
        storeName: String((raw as { storeName?: string })?.storeName ?? ''),
        mealName: String((raw as { mealName?: string })?.mealName ?? ''),
        city: String((raw as { city?: string })?.city ?? ''),
        errors: messages,
      });
      continue;
    }
    const record = parsed.data;
    const rowErrors: string[] = [];
    let lng = record.lng;
    let lat = record.lat;
    let geocodeCandidates: GeocodeCandidate[] | undefined;
    if (lng === undefined || lat === undefined) {
      if (isPlaceholderAddress(record.address)) {
        rowErrors.push('地址是「待补」占位，请补充真实地址后再解析坐标');
      } else {
        geocodeCandidates = await geocode(record.address);
        const candidate = geocodeCandidates[0];
        if (candidate) {
          lng = candidate.lng;
          lat = candidate.lat;
        } else rowErrors.push('缺少坐标，且地址无法自动解析；请人工确认坐标');
      }
    }
    let matchedPlaceId: string | null = record.matchedPlaceId ?? null;
    if (lng !== undefined && lat !== undefined) {
      const duplicate = duplicateCandidates(db, {
        name: record.storeName,
        address: record.address,
        lng,
        lat,
      })[0];
      matchedPlaceId =
        matchedPlaceId ??
        findPlaceForRecord(db, {
          name: record.storeName,
          lng,
          lat,
          matchedPlaceId: record.matchedPlaceId,
        }) ??
        duplicate?.id ??
        null;
    }
    const status: CreatorImportPreviewRow['status'] =
      lng === undefined || lat === undefined
        ? 'needs_coordinates'
        : rowErrors.length
          ? 'invalid'
          : 'ready';
    const row: CreatorImportPreviewRow = {
      index,
      status,
      storeName: record.storeName,
      mealName: record.mealName,
      city: record.city,
      ...(lng !== undefined ? { lng } : {}),
      ...(lat !== undefined ? { lat } : {}),
      ...(geocodeCandidates?.length ? { geocodeCandidates } : {}),
      matchedPlaceId,
      errors: rowErrors,
    };
    rows.push(row);
    if (status !== 'ready')
      errors.push({ row: index, field: 'lng/lat', message: rowErrors.join('；') });
  }
  return {
    valid: rows.length > 0 && rows.every((row) => row.status === 'ready'),
    errors,
    rows,
  };
}

export interface CreatorImportCommitResult {
  placeId: string;
  mealId: string;
  created: boolean;
  matchedPlaceId: string | null;
}

export function commitCreatorImport(
  db: SqliteDatabase,
  records: CreatorImportRecord[],
  actor = 'admin',
): CreatorImportCommitResult[] {
  return db.transaction(() => {
    const repo = new PlaceRepository(db);
    const now = new Date().toISOString();
    const results: CreatorImportCommitResult[] = [];
    for (const record of records) {
      if (record.lng === undefined || record.lat === undefined)
        throw new Error('COORDINATES_REQUIRED');
      const zoneId = ensureCreatorZone(db, record.city);
      let placeId = findPlaceForRecord(db, {
        name: record.storeName,
        lng: record.lng,
        lat: record.lat,
        matchedPlaceId: record.matchedPlaceId,
      });
      const created = !placeId;
      if (!placeId) {
        placeId = repo.create(
          {
            zoneId,
            name: record.storeName,
            address: record.address,
            lng: record.lng,
            lat: record.lat,
            category: record.placeCategory,
            accessType: record.accessType,
            accessNote: undefined,
            openingHoursNote: undefined,
            tags: [],
          } as never,
          actor,
        );
      }
      const mealId = ensureMenuItem(
        db,
        placeId,
        record.mealName,
        record.placeCategory,
        actor,
      );
      db.prepare(
        "UPDATE price_reports SET status='superseded' WHERE menu_item_id=? AND verification_method='external_lead' AND status='pending'",
      ).run(mealId);
      replacePrice(
        db,
        {
          menuItemId: mealId,
          priceFen: Math.round(record.priceYuan * 100),
          observedAt: record.observedAt ?? todayIso(),
          verificationMethod: 'external_lead',
          status: 'pending',
        },
        actor,
      );
      const sourceInput = {
        platform: record.platform,
        creatorName: record.creatorName,
        contentUrl: record.contentUrl || null,
        observedAt: record.observedAt ?? null,
      };
      addEntitySource(db, 'place', placeId, sourceInput, now);
      addEntitySource(db, 'menu_item', mealId, sourceInput, now);
      ensureContentLead(db, record, placeId, now);
      recordAudit(db, actor, 'place', placeId, 'creator_import', undefined, {
        storeName: record.storeName,
        mealName: record.mealName,
        platform: record.platform,
        creatorName: record.creatorName,
      });
      results.push({ placeId, mealId, created, matchedPlaceId: created ? null : placeId });
    }
    return results;
  })();
}
