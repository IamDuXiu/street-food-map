import { createHash } from 'node:crypto';
import type { SqliteDatabase } from './server/db';
import { recordAudit } from './server/audit';
import { normalize, newId } from './server/seed';
import {
  addMenuItem,
  PlaceRepository,
  replacePrice,
} from './server/repository';
import {
  previewCsv,
  type CsvPreviewOptions,
} from './server/services';
import {
  candidateFactsSchema,
  candidateCommitRequestSchema,
  verifiedVerificationMethods,
  type CandidateCommitRequest,
  type VerifiedVerificationMethod,
} from './server/validation';
import { BUDGET_IMPORT_HEADERS } from './csv';

/** A source clue is never a completed verification. */
export const candidateItemStatuses = [
  'new',
  'triaged',
  'verifying',
  'converted',
  'rejected',
  'duplicate',
] as const;
export type CandidateItemStatus = (typeof candidateItemStatuses)[number];

export class CandidatePoolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CandidatePoolError';
  }
}

export interface CandidateItemDto {
  id: string;
  sourceLeadId: string;
  itemName: string;
  cluePriceFen: number | null;
  status: CandidateItemStatus;
  matchedMenuItemId: string | null;
  matchedPlaceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateGroupDto {
  id: string;
  sourceLeadId: string;
  sourcePlatform: string;
  discoveryMethod: string;
  sourceUrl: string | null;
  placeName: string;
  summary: string | null;
  sourcePublishedAt: string | null;
  status: string;
  matchedPlaceId: string | null;
  itemCount: number;
  convertedItemCount: number;
  updatedAt: string;
  items: CandidateItemDto[];
}

export interface CandidateGroupFilters {
  q?: string;
  status?: string;
  itemStatus?: CandidateItemStatus;
  discoveryMethod?: string;
  sourcePlatform?: string;
  limit?: number;
  offset?: number;
}

interface LeadRow {
  id: string;
  source_platform: string;
  discovery_method: string | null;
  source_url: string | null;
  clue_place_name: string;
  clue_item_name: string | null;
  clue_price_fen: number | null;
  source_published_at: string | null;
  summary: string | null;
  status: string;
  matched_place_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  source_lead_id: string;
  clue_item_name: string;
  clue_price_fen: number | null;
  clue_metadata_json: string | null;
  status: CandidateItemStatus;
  matched_menu_item_id: string | null;
  matched_place_id: string | null;
  created_at: string;
  updated_at: string;
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapItem(row: ItemRow): CandidateItemDto {
  return {
    id: row.id,
    sourceLeadId: row.source_lead_id,
    itemName: row.clue_item_name,
    cluePriceFen: row.clue_price_fen,
    status: row.status,
    matchedMenuItemId: row.matched_menu_item_id,
    matchedPlaceId: row.matched_place_id,
    metadata: parseMetadata(row.clue_metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowsForLead(db: SqliteDatabase, leadId: string): ItemRow[] {
  return db
    .prepare(
      'SELECT id,source_lead_id,clue_item_name,clue_price_fen,clue_metadata_json,status,matched_menu_item_id,matched_place_id,created_at,updated_at FROM source_lead_items WHERE source_lead_id=? ORDER BY created_at,id',
    )
    .all(leadId) as ItemRow[];
}

function leadRow(db: SqliteDatabase, id: string): LeadRow | undefined {
  return db
    .prepare('SELECT * FROM source_leads WHERE id=?')
    .get(id) as LeadRow | undefined;
}

export class CandidatePoolRepository {
  constructor(private readonly db: SqliteDatabase) {}

  listGrouped(filters: CandidateGroupFilters = {}): CandidateGroupDto[] {
    const clauses: string[] = ['1=1'];
    const values: unknown[] = [];
    if (filters.q?.trim()) {
      clauses.push(
        "(l.clue_place_name LIKE '%'||?||'%' OR COALESCE(l.source_url,'') LIKE '%'||?||'%' OR COALESCE(l.summary,'') LIKE '%'||?||'%' OR EXISTS (SELECT 1 FROM source_lead_items sqi WHERE sqi.source_lead_id=l.id AND sqi.clue_item_name LIKE '%'||?||'%'))",
      );
      values.push(
        filters.q.trim(),
        filters.q.trim(),
        filters.q.trim(),
        filters.q.trim(),
      );
    }
    if (filters.status) {
      clauses.push('l.status=?');
      values.push(filters.status);
    }
    if (filters.itemStatus) {
      clauses.push(
        'EXISTS (SELECT 1 FROM source_lead_items fli WHERE fli.source_lead_id=l.id AND fli.status=?)',
      );
      values.push(filters.itemStatus);
    }
    if (filters.discoveryMethod) {
      clauses.push('COALESCE(l.discovery_method, \'manual\')=?');
      values.push(filters.discoveryMethod);
    }
    if (filters.sourcePlatform) {
      clauses.push('l.source_platform=?');
      values.push(filters.sourcePlatform);
    }
    const requestedLimit = Number.isFinite(filters.limit) ? filters.limit! : 100;
    const requestedOffset = Number.isFinite(filters.offset) ? filters.offset! : 0;
    const limit = Math.min(Math.max(requestedLimit, 1), 500);
    const offset = Math.max(requestedOffset, 0);
    const rows = this.db
      .prepare(
        `SELECT l.*, COUNT(li.id) item_count,
          SUM(CASE WHEN li.status='converted' THEN 1 ELSE 0 END) converted_item_count
         FROM source_leads l
         LEFT JOIN source_lead_items li ON li.source_lead_id=l.id
         WHERE ${clauses.join(' AND ')}
         GROUP BY l.id
         ORDER BY l.updated_at DESC,l.id
         LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset) as Array<
      LeadRow & { item_count: number; converted_item_count: number }
    >;
    return rows.map((row) => ({
      id: row.id,
      sourceLeadId: row.id,
      sourcePlatform: row.source_platform,
      discoveryMethod: row.discovery_method || 'manual',
      sourceUrl: row.source_url,
      placeName: row.clue_place_name,
      summary: row.summary,
      sourcePublishedAt: row.source_published_at,
      status: row.status,
      matchedPlaceId: row.matched_place_id,
      itemCount: Number(row.item_count),
      convertedItemCount: Number(row.converted_item_count),
      updatedAt: row.updated_at,
      items: rowsForLead(this.db, row.id).map(mapItem),
    }));
  }

  list(filters: CandidateGroupFilters = {}) {
    return this.listGrouped(filters);
  }

  getGrouped(id: string): CandidateGroupDto | null {
    const row = leadRow(this.db, id);
    if (!row) return null;
    const items = rowsForLead(this.db, id);
    return {
      id: row.id,
      sourceLeadId: row.id,
      sourcePlatform: row.source_platform,
      discoveryMethod: row.discovery_method || 'manual',
      sourceUrl: row.source_url,
      placeName: row.clue_place_name,
      summary: row.summary,
      sourcePublishedAt: row.source_published_at,
      status: row.status,
      matchedPlaceId: row.matched_place_id,
      itemCount: items.length,
      convertedItemCount: items.filter((item) => item.status === 'converted')
        .length,
      updatedAt: row.updated_at,
      items: items.map(mapItem),
    };
  }

  getItem(id: string): CandidateItemDto | null {
    const row = this.db
      .prepare(
        'SELECT id,source_lead_id,clue_item_name,clue_price_fen,clue_metadata_json,status,matched_menu_item_id,matched_place_id,created_at,updated_at FROM source_lead_items WHERE id=?',
      )
      .get(id) as ItemRow | undefined;
    return row ? mapItem(row) : null;
  }
}

export interface CandidateSeedRecord {
  candidate_id?: string;
  store_name?: string;
  meal_name?: string;
  displayed_price_yuan?: number | null;
  source_url?: string | null;
  source_urls?: string[];
  source_platform?: string;
  discovery_source?: string;
  source_published_or_updated_date?: string | null;
  address_or_area?: string | null;
  suggested_import_zone?: string | null;
  coordinate_system?: string | null;
  evidence_summary?: string | null;
  [key: string]: unknown;
}

function asSeedRecord(value: unknown): CandidateSeedRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CandidatePoolError('SEED_RECORD_INVALID', '候选记录格式不正确');
  const raw = value as CandidateSeedRecord & Record<string, unknown>;
  const record = {
    ...raw,
    store_name: raw.store_name ?? raw.placeName ?? raw.place_name,
    meal_name: raw.meal_name ?? raw.itemName ?? raw.menu_item_name,
    source_url:
      raw.source_url ?? raw.sourceUrl ?? raw.sourceLeadUrl ?? raw.source_lead_url,
    displayed_price_yuan:
      raw.displayed_price_yuan ??
      raw.priceYuan ??
      (typeof raw.priceFen === 'number' ? raw.priceFen / 100 : undefined),
  } as CandidateSeedRecord;
  const storeName = String(record.store_name ?? '').trim();
  const itemName = String(record.meal_name ?? '').trim();
  const sourceUrl = String(
    record.source_url ?? record.source_urls?.[0] ?? '',
  ).trim();
  if (!storeName || !itemName || !sourceUrl) {
    throw new CandidatePoolError(
      'SEED_RECORD_REQUIRED',
      '候选记录必须包含店铺、餐食和来源链接',
    );
  }
  try {
    new URL(sourceUrl);
  } catch {
    throw new CandidatePoolError('SEED_URL_INVALID', '来源链接格式不正确');
  }
  return record;
}

function seedMetadata(record: CandidateSeedRecord): Record<string, unknown> {
  const importRow =
    record.import_template_row && typeof record.import_template_row === 'object'
      ? (record.import_template_row as Record<string, unknown>)
      : {};
  const accessType = String(
    importRow.access_type ?? record.access_type ?? '',
  ).trim();
  const menuCategory = String(
    importRow.menu_category ?? record.menu_category ?? record.menuCategory ?? '',
  ).trim();
  return {
    candidateId: record.candidate_id ?? null,
    address:
      record.address_or_area ?? record.address ?? importRow.address ?? '',
    zoneName:
      record.suggested_import_zone ?? record.zoneName ?? importRow.zone_name ?? '',
    coordinateSystem:
      record.coordinate_system ??
      record.coordinateSystem ??
      importRow.coordinate_system ??
      'GCJ-02',
    lng: record.lng ?? importRow.lng ?? null,
    lat: record.lat ?? importRow.lat ?? null,
    placeCategory:
      importRow.place_category ?? record.place_category ?? record.placeCategory ?? '',
    accessType:
      accessType && !accessType.startsWith('待现场')
        ? accessType
        : String(record.accessType ?? '').trim(),
    menuCategory:
      menuCategory && !menuCategory.startsWith('待现场') &&
      !menuCategory.startsWith('待分类')
        ? menuCategory
        : '',
    observedAt:
      record.observed_date ?? record.observedAt ?? importRow.observed_date ?? '',
    verificationMethod:
      record.verification_method ??
      record.verificationMethod ??
      importRow.verification_method ??
      '',
    summary: record.evidence_summary ?? record.summary ?? '',
    evidenceFilename: '',
  };
}

function sourcePlatform(record: CandidateSeedRecord): string {
  const source = String(
    record.discovery_source ?? record.sourcePlatform ?? '',
  ).toLowerCase();
  if (source.includes('douban')) return 'douban';
  if (source.includes('user')) return 'user';
  return 'web';
}

function sourceUrl(record: CandidateSeedRecord): string {
  return String(record.source_url ?? record.source_urls?.[0] ?? '').trim();
}

/** Idempotently import discovery records; URL reuse creates one lead + many items. */
export function seedCandidateBatch(
  db: SqliteDatabase,
  rawRecords: unknown,
  actor = 'admin',
) {
  const records = Array.isArray(rawRecords)
    ? rawRecords.map(asSeedRecord)
    : rawRecords &&
        typeof rawRecords === 'object' &&
        Array.isArray((rawRecords as { records?: unknown[] }).records)
      ? (rawRecords as { records: unknown[] }).records.map(asSeedRecord)
      : (() => {
          throw new CandidatePoolError(
            'SEED_RECORDS_REQUIRED',
            '候选记录必须是数组',
          );
        })();
  return db.transaction(() => {
    const now = new Date().toISOString();
    const leadByUrl = new Map<string, string>();
    const insertedLeads: string[] = [];
    const insertedItems: string[] = [];
    const touchedLeads = new Set<string>();
    const resultByUrl = new Map<string, { leadId: string; itemIds: string[] }>();
    for (const record of records) {
      const url = sourceUrl(record);
      let leadId = leadByUrl.get(url);
      if (!leadId) {
        const existing = db
          .prepare('SELECT id FROM source_leads WHERE source_url=?')
          .get(url) as { id: string } | undefined;
        if (existing) leadId = existing.id;
        else {
          leadId = newId('lead');
          const price =
            typeof record.displayed_price_yuan === 'number'
              ? Math.round(record.displayed_price_yuan * 100)
              : null;
          db.prepare(
            'INSERT INTO source_leads(id,source_platform,source_url,clue_place_name,clue_item_name,clue_price_fen,source_published_at,summary,status,discovery_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          ).run(
            leadId,
            sourcePlatform(record),
            url,
            record.store_name,
            record.meal_name,
            price,
            record.source_published_or_updated_date || null,
            record.evidence_summary || null,
            'new',
            'external_lead',
            now,
            now,
          );
          insertedLeads.push(leadId);
          recordAudit(db, actor, 'lead', leadId, 'candidate_seed', undefined, {
            sourceUrl: url,
          });
        }
        leadByUrl.set(url, leadId);
      }
      touchedLeads.add(leadId);
      const itemName = String(record.meal_name).trim();
      const normalized = normalize(itemName);
      let item = db
        .prepare(
          'SELECT id,status FROM source_lead_items WHERE source_lead_id=? AND lower(replace(replace(clue_item_name,\' \',\'\'),\'　\',\'\'))=? ORDER BY created_at,id LIMIT 1',
        )
        .get(leadId, normalized) as
        | { id: string; status: CandidateItemStatus }
        | undefined;
      // SQLite's simple expression above does not remove all punctuation; the
      // fallback keeps the operation idempotent for common Chinese punctuation.
      if (!item) {
        const existingItems = rowsForLead(db, leadId);
        item = existingItems
          .map((candidate) => ({ id: candidate.id, status: candidate.status }))
          .find((candidate) => {
            const full = existingItems.find((row) => row.id === candidate.id);
            return full ? normalize(full.clue_item_name) === normalized : false;
          });
      }
      const metadata = JSON.stringify(seedMetadata(record));
      const price =
        typeof record.displayed_price_yuan === 'number'
          ? Math.round(record.displayed_price_yuan * 100)
          : null;
      if (item) {
        db.prepare(
          'UPDATE source_lead_items SET clue_item_name=?,clue_price_fen=?,clue_metadata_json=?,updated_at=? WHERE id=?',
        ).run(itemName, price, metadata, now, item.id);
      } else {
        const itemId = record.candidate_id
          ? `lead-item-${String(record.candidate_id)}`
          : newId('lead-item');
        db.prepare(
          'INSERT INTO source_lead_items(id,source_lead_id,clue_item_name,clue_price_fen,clue_metadata_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        ).run(itemId, leadId, itemName, price, metadata, 'new', now, now);
        insertedItems.push(itemId);
        item = { id: itemId, status: 'new' };
      }
      const result = resultByUrl.get(url) ?? { leadId, itemIds: [] };
      result.itemIds.push(item.id);
      resultByUrl.set(url, result);
    }
    for (const leadId of touchedLeads) {
      const first = db
        .prepare(
          'SELECT clue_item_name,clue_price_fen FROM source_lead_items WHERE source_lead_id=? ORDER BY created_at,id LIMIT 1',
        )
        .get(leadId) as
        | { clue_item_name: string; clue_price_fen: number | null }
        | undefined;
      if (first)
        db.prepare(
          'UPDATE source_leads SET clue_item_name=?,clue_price_fen=?,updated_at=? WHERE id=?',
        ).run(first.clue_item_name, first.clue_price_fen, now, leadId);
    }
    const groups = [...resultByUrl.values()].map((result) =>
      new CandidatePoolRepository(db).getGrouped(result.leadId),
    );
    return {
      sourceLeadIds: [...new Set([...resultByUrl.values()].map((r) => r.leadId))],
      sourceLeadItemIds: [...new Set([...resultByUrl.values()].flatMap((r) => r.itemIds))],
      insertedLeads,
      insertedItems,
      groups: groups.filter((group): group is CandidateGroupDto => Boolean(group)),
      count: records.length,
    };
  })();
}

interface DraftRow {
  id: string;
  payload_json: string;
  version: number;
  source_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateDraftDto {
  id: string;
  payload: unknown;
  version: number;
  sourceVersion: string | null;
  createdAt: string;
  updatedAt: string;
}

function decodeDraft(row: DraftRow): CandidateDraftDto {
  let payload: unknown = {};
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    payload,
    version: row.version,
    sourceVersion: row.source_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getCandidateDraft(
  db: SqliteDatabase,
  id: string,
): CandidateDraftDto | null {
  const row = db
    .prepare('SELECT * FROM lead_conversion_drafts WHERE id=?')
    .get(id) as DraftRow | undefined;
  return row ? decodeDraft(row) : null;
}

/** Return the most recently edited drafts for the admin resume menu. */
export function listCandidateDrafts(
  db: SqliteDatabase,
  limit = 8,
): CandidateDraftDto[] {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.trunc(limit) : 8, 1), 50);
  const rows = db
    .prepare('SELECT * FROM lead_conversion_drafts ORDER BY updated_at DESC LIMIT ?')
    .all(safeLimit) as DraftRow[];
  return rows.map(decodeDraft);
}

function sourceItemIdsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return [];
  const object = payload as Record<string, unknown>;
  const nested =
    object.payload && typeof object.payload === 'object'
      ? (object.payload as Record<string, unknown>)
      : object;
  const list =
    nested.items ??
    nested.selections ??
    nested.selectedItems ??
    nested.selectedItemIds ??
    nested.sourceLeadItemIds ??
    nested.itemIds ??
    nested.rows;
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (!entry || typeof entry !== 'object') return '';
      const item = entry as Record<string, unknown>;
      if (item.selected === false || item.checked === false) return '';
      return String(
        item.sourceLeadItemId ?? item.leadItemId ?? item.itemId ?? item.id ?? '',
      );
    })
    .filter(Boolean);
}

function draftPayloadObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new CandidatePoolError('DRAFT_PAYLOAD_INVALID', '草稿内容格式不正确');
  const object = payload as Record<string, unknown>;
  if (
    object.payload &&
    typeof object.payload === 'object' &&
    !Array.isArray(object.payload)
  )
    return object.payload as Record<string, unknown>;
  return object;
}

export function saveCandidateDraft(
  db: SqliteDatabase,
  input: { id?: string; payload: unknown; version?: number },
  actor = 'admin',
): CandidateDraftDto {
  const payload = draftPayloadObject(input.payload);
  const requestedId = input.id?.trim() || newId('draft');
  const now = new Date().toISOString();
  const sourceVersion = candidateSourceVersion(
    db,
    sourceItemIdsFromPayload(payload),
  );
  return db.transaction(() => {
    const existing = db
      .prepare('SELECT * FROM lead_conversion_drafts WHERE id=?')
      .get(requestedId) as DraftRow | undefined;
    if (existing) {
      if (input.version === undefined || input.version !== existing.version)
        throw new CandidatePoolError(
          'DRAFT_VERSION_CONFLICT',
          '草稿已被其他操作更新，请刷新后重试',
          409,
          { currentVersion: existing.version },
        );
      const nextVersion = existing.version + 1;
      db.prepare(
        'UPDATE lead_conversion_drafts SET payload_json=?,version=?,source_version=?,updated_at=? WHERE id=?',
      ).run(
        JSON.stringify(payload),
        nextVersion,
        sourceVersion,
        now,
        requestedId,
      );
      recordAudit(db, actor, 'candidate_draft', requestedId, 'update', {
        version: existing.version,
      }, { version: nextVersion });
    } else {
      db.prepare(
        'INSERT INTO lead_conversion_drafts(id,payload_json,version,source_version,created_at,updated_at) VALUES (?,?,?,?,?,?)',
      ).run(requestedId, JSON.stringify(payload), 1, sourceVersion, now, now);
      recordAudit(db, actor, 'candidate_draft', requestedId, 'create', undefined, {
        version: 1,
      });
    }
    const row = db
      .prepare('SELECT * FROM lead_conversion_drafts WHERE id=?')
      .get(requestedId) as DraftRow;
    return decodeDraft(row);
  })();
}

export function createCandidateDraft(
  db: SqliteDatabase,
  payload: unknown,
  actor = 'admin',
) {
  return saveCandidateDraft(db, { payload }, actor);
}

export function updateCandidateItemStatus(
  db: SqliteDatabase,
  id: string,
  next: CandidateItemStatus,
  actor = 'admin',
) {
  return db.transaction(() => {
    const before = db
      .prepare('SELECT * FROM source_lead_items WHERE id=?')
      .get(id) as ItemRow | undefined;
    if (!before) throw new CandidatePoolError('SOURCE_ITEM_NOT_FOUND', '候选餐食不存在', 404);
    const transitions: Record<CandidateItemStatus, CandidateItemStatus[]> = {
      new: ['triaged', 'verifying', 'rejected', 'duplicate'],
      triaged: ['verifying', 'rejected', 'duplicate'],
      verifying: ['rejected', 'duplicate'],
      converted: [],
      rejected: [],
      duplicate: [],
    };
    if (before.status === next) return next;
    if (!transitions[before.status]?.includes(next))
      throw new CandidatePoolError(
        'INVALID_CANDIDATE_ITEM_TRANSITION',
        '候选餐食状态流转不合法',
        422,
        { from: before.status, to: next },
      );
    const now = new Date().toISOString();
    db.prepare('UPDATE source_lead_items SET status=?,updated_at=? WHERE id=?').run(
      next,
      now,
      id,
    );
    recordAudit(db, actor, 'source_lead_item', id, 'status_change', before, {
      status: next,
    });
    return next;
  })();
}

export const transitionCandidateItem = updateCandidateItemStatus;

type SelectionEntry = Record<string, unknown> & { sourceLeadItemId: string };

function selectionEntries(payload: unknown): SelectionEntry[] {
  const object = draftPayloadObject(payload);
  const list =
    object.items ??
    object.selections ??
    object.selectedItems ??
    object.selectedItemIds ??
    object.sourceLeadItemIds ??
    object.itemIds ??
    object.rows;
  if (!Array.isArray(list))
    throw new CandidatePoolError(
      'CANDIDATE_ITEMS_REQUIRED',
      '草稿至少需要一个候选餐食',
    );
  return list
    .map((entry): SelectionEntry | null => {
      if (typeof entry === 'string')
        return { sourceLeadItemId: entry.trim() };
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const item = entry as Record<string, unknown>;
      const id = String(
        item.sourceLeadItemId ?? item.leadItemId ?? item.itemId ?? item.id ?? '',
      ).trim();
      if (!id || item.selected === false || item.checked === false) return null;
      return { ...item, sourceLeadItemId: id };
    })
    .filter((entry): entry is SelectionEntry => Boolean(entry));
}

interface LoadedSelection {
  entry: SelectionEntry;
  lead: LeadRow;
  item: ItemRow;
}

function loadSelections(
  db: SqliteDatabase,
  payload: unknown,
): LoadedSelection[] {
  const entries = selectionEntries(payload);
  const loaded: LoadedSelection[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.sourceLeadItemId))
      throw new CandidatePoolError(
        'CANDIDATE_ITEM_DUPLICATE',
        '同一餐食不能重复选择',
        422,
        { sourceLeadItemId: entry.sourceLeadItemId },
      );
    seen.add(entry.sourceLeadItemId);
    const item = db
      .prepare('SELECT * FROM source_lead_items WHERE id=?')
      .get(entry.sourceLeadItemId) as ItemRow | undefined;
    if (!item)
      throw new CandidatePoolError(
        'SOURCE_ITEM_NOT_FOUND',
        '候选餐食不存在或已被移除',
        422,
        { sourceLeadItemId: entry.sourceLeadItemId },
      );
    const lead = leadRow(db, item.source_lead_id);
    if (!lead)
      throw new CandidatePoolError(
        'SOURCE_LEAD_NOT_FOUND',
        '候选来源不存在',
        422,
        { sourceLeadItemId: entry.sourceLeadItemId },
      );
    if (item.status === 'converted')
      throw new CandidatePoolError(
        'CANDIDATE_ITEM_CONVERTED',
        '候选餐食已经导入',
        409,
        { sourceLeadItemId: item.id },
      );
    if (item.status === 'rejected' || item.status === 'duplicate')
      throw new CandidatePoolError(
        'CANDIDATE_ITEM_NOT_ACTIVE',
        '候选餐食已被标记为无效',
        422,
        { sourceLeadItemId: item.id },
      );
    loaded.push({ entry, lead, item });
  }
  if (!loaded.length)
    throw new CandidatePoolError(
      'CANDIDATE_ITEMS_REQUIRED',
      '草稿至少需要一个候选餐食',
      422,
    );
  return loaded;
}

function firstValue(
  entry: SelectionEntry,
  metadata: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (entry[key] !== undefined && entry[key] !== null) return entry[key];
  }
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null)
      return metadata[key];
  }
  return undefined;
}

function textValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function optionalNumber(value: unknown): number | string {
  if (value === undefined || value === null || value === '') return '';
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : textValue(value);
}

function candidateRows(db: SqliteDatabase, loaded: LoadedSelection[]) {
  return loaded.map(({ entry, lead, item }) => {
    const metadata = parseMetadata(item.clue_metadata_json);
    const zoneId = firstValue(entry, metadata, ['zoneId', 'zone_id']);
    const zoneName = firstValue(entry, metadata, ['zoneName', 'zone_name']);
    const resolvedZoneName =
      !textValue(zoneName) && zoneId !== undefined
        ? (
            db.prepare('SELECT name FROM pilot_zones WHERE id=?').get(zoneId) as
              | { name: string }
              | undefined
          )?.name
        : zoneName;
    const priceFenValue = firstValue(entry, metadata, [
      'priceFen',
      'price_fen',
    ]);
    const priceYuanValue = firstValue(entry, metadata, [
      'priceYuan',
      'price_yuan',
      'price',
    ]);
    const priceYuan =
      priceFenValue !== undefined
        ? optionalNumber(priceFenValue) === ''
          ? ''
          : Number(priceFenValue) / 100
        : priceYuanValue !== undefined
          ? optionalNumber(priceYuanValue)
          : item.clue_price_fen === null
            ? ''
            : item.clue_price_fen / 100;
    return {
      zone_name: textValue(resolvedZoneName),
      place_name: textValue(
        firstValue(entry, metadata, ['placeName', 'place_name']) ??
          lead.clue_place_name,
      ),
      address: textValue(
        firstValue(entry, metadata, ['address']) ?? '',
      ),
      lng: optionalNumber(firstValue(entry, metadata, ['lng'])),
      lat: optionalNumber(firstValue(entry, metadata, ['lat'])),
      coordinate_system: textValue(
        firstValue(entry, metadata, ['coordinateSystem', 'coordinate_system']) ??
          'GCJ-02',
      ),
      place_category: textValue(
        firstValue(entry, metadata, ['placeCategory', 'place_category']),
      ),
      access_type: textValue(
        firstValue(entry, metadata, ['accessType', 'access_type', 'access']),
      ),
      menu_item_name: textValue(
        firstValue(entry, metadata, ['menuItemName', 'menu_item_name']) ??
          item.clue_item_name,
      ),
      menu_category: textValue(
        firstValue(entry, metadata, ['menuCategory', 'menu_category']),
      ),
      price_yuan: priceYuan,
      observed_date: textValue(
        firstValue(entry, metadata, [
          'observedAt',
          'observedDate',
          'observed_date',
        ]),
      ),
      verification_method: textValue(
        firstValue(entry, metadata, [
          'verificationMethod',
          'verification_method',
        ]),
      ),
      evidence_filename: textValue(
        firstValue(entry, metadata, ['evidenceFilename', 'evidence_filename']),
      ),
      // Deliberately loaded from the server-side lead.  A client supplied URL
      // is ignored, including when it disagrees with this value.
      source_lead_url: lead.source_url || '',
      admin_note: textValue(
        firstValue(entry, metadata, ['adminNote', 'admin_note', 'note']) ??
          metadata.summary ??
          '',
      ),
    };
  });
}

function addError(
  errors: CandidateError[],
  index: number,
  itemId: string,
  field: string,
  message: string,
) {
  errors.push({ row: index + 2, sourceLeadItemId: itemId, field, message });
}

export interface CandidateError {
  row: number;
  sourceLeadItemId?: string;
  field?: string;
  message: string;
}

function candidateSourceVersion(db: SqliteDatabase, ids: string[]): string {
  const values = ids
    .filter(Boolean)
    .map((id) =>
      db
        .prepare(
          'SELECT li.id,li.updated_at item_updated_at,l.id lead_id,l.updated_at lead_updated_at FROM source_lead_items li JOIN source_leads l ON l.id=li.source_lead_id WHERE li.id=?',
        )
        .get(id),
    );
  return createHash('sha256')
    .update(JSON.stringify(values))
    .digest('hex');
}

function coordinateKey(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : textValue(value);
}

/** The four fields that identify a new place within a candidate commit. */
function candidatePlaceKey(row: Record<string, unknown>): string {
  return [
    normalize(textValue(row.place_name)),
    normalize(textValue(row.address)),
    coordinateKey(row.lng),
    coordinateKey(row.lat),
    normalize(textValue(row.zone_name)),
  ].join('|');
}

function candidateTargetKey(
  lead: LeadRow,
  row: Record<string, unknown>,
): string {
  return lead.matched_place_id
    ? `matched:${lead.matched_place_id}`
    : `new:${candidatePlaceKey(row)}`;
}

export interface CandidatePreviewResult {
  valid: boolean;
  draftId?: string;
  /** Draft version for persisted drafts, source digest for inline previews. */
  version?: number | string;
  sourceVersion: string;
  headers: readonly string[];
  rows: Array<Record<string, unknown>>;
  csvRows: Array<Record<string, unknown>>;
  errors: CandidateError[];
  fieldErrors: Record<string, Record<string, string>>;
  selectedCount: number;
  groupCount: number;
  /** Number of distinct planned places after matching/fingerprint deduplication. */
  placeCount: number;
}

function buildCandidatePreview(
  db: SqliteDatabase,
  payload: unknown,
  draft?: CandidateDraftDto,
): CandidatePreviewResult {
  const loaded = loadSelections(db, payload);
  const rows = candidateRows(db, loaded);
  const errors: CandidateError[] = [];
  const rowItemIds = loaded.map(({ item }) => item.id);
  const checked = previewCsv(db, rows, {
    allowExistingSourceLeadUrls: true,
    allowExistingPlaceIds: loaded
      .map(({ lead }) => lead.matched_place_id)
      .filter((id): id is string => Boolean(id)),
  } satisfies CsvPreviewOptions);
  for (const error of checked.errors) {
    const index = Math.max(error.row - 2, 0);
    addError(
      errors,
      index,
      rowItemIds[index] || '',
      error.field || '',
      error.message,
    );
  }
  const factMessages = {
    open: '请确认仍在营业且门头一致',
    regularPrice: '请确认常规正价非优惠摊薄',
    oneMeal: '请确认确实可作为一人一餐',
  } as const;
  loaded.forEach(({ entry, item }, index) => {
    const parsedFacts = candidateFactsSchema.safeParse(entry.facts);
    const facts: Record<string, unknown> = parsedFacts.success
      ? parsedFacts.data
      : entry.facts && typeof entry.facts === 'object' && !Array.isArray(entry.facts)
        ? (entry.facts as Record<string, unknown>)
        : {};
    for (const [field, message] of Object.entries(factMessages)) {
      if (facts[field] !== true)
        addError(errors, index, item.id, `facts.${field}`, message);
    }
  });
  const grouped = new Map<string, number[]>();
  loaded.forEach(({ lead }, index) => {
    const list = grouped.get(lead.id) ?? [];
    list.push(index);
    grouped.set(lead.id, list);
  });
  for (const indexes of grouped.values()) {
    const first = rows[indexes[0]];
    const firstPlaceKey = [
      first.place_name,
      first.address,
      first.zone_name,
      first.lng,
      first.lat,
      first.place_category,
      first.access_type,
    ].join('|');
    const firstMenuNames = new Map<string, number>();
    for (const index of indexes) {
      const row = rows[index];
      const key = [
        row.place_name,
        row.address,
        row.zone_name,
        row.lng,
        row.lat,
        row.place_category,
        row.access_type,
      ].join('|');
      if (key !== firstPlaceKey) {
        addError(
          errors,
          index,
          rowItemIds[index],
          'place_name',
          '同一来源的店铺信息必须一致',
        );
      }
      const menuName = normalize(String(row.menu_item_name));
      if (firstMenuNames.has(menuName)) {
        addError(
          errors,
          index,
          rowItemIds[index],
          'menu_item_name',
          `同一地点的餐食名称与第 ${firstMenuNames.get(menuName)! + 2} 行重复`,
        );
      } else firstMenuNames.set(menuName, index);
    }
  }
  const targetGroups = new Map<string, number[]>();
  loaded.forEach(({ lead }, index) => {
    const key = candidateTargetKey(lead, rows[index]);
    const indexes = targetGroups.get(key) ?? [];
    indexes.push(index);
    targetGroups.set(key, indexes);
  });
  for (const [targetKey, indexes] of targetGroups) {
    const menuNames = new Map<string, number>();
    const existingMenuNames = targetKey.startsWith('matched:')
      ? new Set(
          (
            db
              .prepare(
                'SELECT normalized_name FROM menu_items WHERE place_id=?',
              )
              .all(targetKey.slice('matched:'.length)) as Array<{
              normalized_name: string;
            }>
          ).map((row) => row.normalized_name),
        )
      : new Set<string>();
    for (const index of indexes) {
      const itemId = rowItemIds[index];
      const menuName = normalize(String(rows[index].menu_item_name));
      if (existingMenuNames.has(menuName)) {
        addError(
          errors,
          index,
          itemId,
          'menu_item_name',
          '该地点已经存在同名餐食，不能重复导入',
        );
      } else if (menuNames.has(menuName)) {
        addError(
          errors,
          index,
          itemId,
          'menu_item_name',
          `同一地点的餐食名称与第 ${menuNames.get(menuName)! + 2} 行重复`,
        );
      } else menuNames.set(menuName, index);
    }
  }
  rows.forEach((row, index) => {
    const item = loaded[index].item;
    if (row.verification_method === 'external_lead')
      addError(
        errors,
        index,
        item.id,
        'verification_method',
        'external_lead 只能作为来源发现方式，不能作为核验方式',
      );
    else if (
      row.verification_method &&
      !verifiedVerificationMethods.includes(
        row.verification_method as VerifiedVerificationMethod,
      )
    )
      addError(
        errors,
        index,
        item.id,
        'verification_method',
        '请选择正式核验方式',
      );
    const price = Number(row.price_yuan);
    if (Number.isFinite(price) && (price <= 0 || price > 25))
      addError(
        errors,
        index,
        item.id,
        'price_yuan',
        '价格必须大于 0 且不超过 25 元',
      );
    if (
      typeof row.observed_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.observed_date) &&
      row.observed_date > new Date().toISOString().slice(0, 10)
    )
      addError(
        errors,
        index,
        item.id,
        'observed_date',
        '核验日期不能晚于今天',
      );
    if (item.status === 'converted')
      addError(errors, index, item.id, 'sourceLeadItemId', '候选餐食已经导入');
  });
  const fieldErrors: Record<string, Record<string, string>> = {};
  for (const error of errors) {
    if (!error.sourceLeadItemId || !error.field) continue;
    fieldErrors[error.sourceLeadItemId] ??= {};
    fieldErrors[error.sourceLeadItemId][error.field] = error.message;
  }
  const sourceVersion = candidateSourceVersion(db, rowItemIds);
  const placeKeys = new Set<string>();
  loaded.forEach(({ lead }, index) => {
    placeKeys.add(candidateTargetKey(lead, rows[index]));
  });
  return {
    valid: errors.length === 0,
    draftId: draft?.id,
    version: draft?.version ?? sourceVersion,
    sourceVersion,
    headers: BUDGET_IMPORT_HEADERS,
    rows,
    csvRows: checked.rows,
    errors,
    fieldErrors,
    selectedCount: rows.length,
    groupCount: grouped.size,
    placeCount: placeKeys.size,
  };
}

function draftRequestParts(db: SqliteDatabase, raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { payload: raw, draft: undefined, sourceVersion: undefined };
  const object = raw as Record<string, unknown>;
  const id = typeof object.draftId === 'string' ? object.draftId : undefined;
  const draft = id ? getCandidateDraft(db, id) ?? undefined : undefined;
  if (id && !draft)
    throw new CandidatePoolError('DRAFT_NOT_FOUND', '草稿不存在', 404);
  if (
    draft &&
    object.version !== undefined &&
    Number(object.version) !== draft.version
  )
    throw new CandidatePoolError(
      'DRAFT_VERSION_CONFLICT',
      '草稿已被其他操作更新，请刷新后重试',
      409,
      { currentVersion: draft.version },
    );
  const payloadKeys = [
    'items',
    'selections',
    'selectedItems',
    'selectedItemIds',
    'sourceLeadItemIds',
    'itemIds',
    'rows',
  ];
  const hasInlinePayload =
    object.payload !== undefined || payloadKeys.some((key) => key in object);
  const inlinePayload =
    object.payload !== undefined
      ? object.payload
      : hasInlinePayload
        ? Object.fromEntries(
            Object.entries(object).filter(
              ([key]) => !['draftId', 'version', 'sourceVersion'].includes(key),
            ),
          )
        : undefined;
  return {
    payload: inlinePayload ?? (draft ? draft.payload : raw),
    draft,
    sourceVersion:
      typeof object.sourceVersion === 'string' ? object.sourceVersion : undefined,
  };
}

export function previewCandidateDraft(
  db: SqliteDatabase,
  raw: unknown,
): CandidatePreviewResult {
  const { payload, draft } = draftRequestParts(db, raw);
  const result = buildCandidatePreview(db, payload, draft);
  if (draft?.sourceVersion && draft.sourceVersion !== result.sourceVersion)
    throw new CandidatePoolError(
      'CANDIDATE_SOURCE_VERSION_CONFLICT',
      '候选来源已变化，请刷新草稿后重试',
      409,
      { currentSourceVersion: result.sourceVersion },
    );
  return result;
}

export function parseCandidateCommitRequest(
  raw: unknown,
): CandidateCommitRequest {
  const parsed = candidateCommitRequestSchema.safeParse(raw);
  if (!parsed.success)
    throw new CandidatePoolError(
      'CANDIDATE_PREVIEW_VERSION_REQUIRED',
      '候选提交必须携带预览版本 version',
      422,
      { issues: parsed.error.issues },
    );
  return parsed.data;
}

function numericCandidateVersion(value: CandidateCommitRequest['version']) {
  if (typeof value === 'number') return value;
  return /^\d+$/.test(value) ? Number(value) : undefined;
}

function commitCandidatePlan(
  db: SqliteDatabase,
  payload: unknown,
  actor: string,
) {
  const checked = buildCandidatePreview(db, payload);
  if (!checked.valid)
    throw new CandidatePoolError(
      'CANDIDATE_INVALID',
      '候选信息不完整或不符合导入规则',
      422,
      { errors: checked.errors, fieldErrors: checked.fieldErrors },
    );
  const loaded = loadSelections(db, payload);
  const rows = checked.csvRows;
  const placeRepo = new PlaceRepository(db);
  const createdPlaceIds: string[] = [];
  const createdMenuItemIds: string[] = [];
  const convertedItemIds: string[] = [];
  const now = new Date().toISOString();
  const groups = new Map<string, number[]>();
  loaded.forEach(({ lead }, index) => {
    const indexes = groups.get(lead.id) ?? [];
    indexes.push(index);
    groups.set(lead.id, indexes);
  });
  const placeIdsByCandidateKey = new Map<string, string>();
  const plans: Array<{
    leadId: string;
    lead: LeadRow;
    indexes: number[];
    first: Record<string, unknown>;
    zoneId: string;
    placeId: string;
  }> = [];
  for (const [leadId, indexes] of groups) {
    const lead = loaded[indexes[0]].lead;
    const first = rows[indexes[0]];
    const matchedPlaceCanContinue =
      Boolean(lead.matched_place_id) && lead.status === 'converted';
    if (
      !['new', 'triaged', 'verifying'].includes(lead.status) &&
      !matchedPlaceCanContinue
    )
      throw new CandidatePoolError(
        'INVALID_LEAD_TRANSITION',
        '来源线索状态不允许再次导入',
        409,
        { leadId },
      );
    const zone = db
      .prepare('SELECT id FROM pilot_zones WHERE name=? AND active=1')
      .get(first.zone_name) as { id: string } | undefined;
    if (!zone) throw new CandidatePoolError('ZONE_NOT_FOUND', '片区不存在或未启用', 422);
    let placeId: string;
    if (lead.matched_place_id) {
      const matchedPlace = db
        .prepare(
          "SELECT id FROM places WHERE id=? AND record_status='active'",
        )
        .get(lead.matched_place_id) as { id: string } | undefined;
      if (!matchedPlace)
        throw new CandidatePoolError(
          'MATCHED_PLACE_NOT_FOUND',
          '候选已关联的地点不存在或已归档',
          409,
          { leadId, matchedPlaceId: lead.matched_place_id },
        );
      placeId = matchedPlace.id;
    } else {
      const candidateKey = candidatePlaceKey(first);
      placeId = placeIdsByCandidateKey.get(candidateKey) ?? '';
      if (!placeId) {
        const duplicates = requireDuplicateCandidates(db, first);
        if (duplicates.length)
          throw new CandidatePoolError(
            'DUPLICATE_CANDIDATE',
            '发现疑似重复地点，请先处理',
            409,
            { candidates: duplicates },
          );
        placeId = placeRepo.create(
          {
            zoneId: zone.id,
            name: first.place_name,
            address: first.address,
            lng: Number(first.lng),
            lat: Number(first.lat),
            category: first.place_category,
            accessType: first.access_type,
            accessNote: undefined,
            openingHoursNote: undefined,
            tags: [],
          } as never,
          actor,
        );
        placeIdsByCandidateKey.set(candidateKey, placeId);
        createdPlaceIds.push(placeId);
      }
    }
    plans.push({ leadId, lead, indexes, first, zoneId: zone.id, placeId });
  }
  for (const { leadId, indexes, placeId } of plans) {
    for (const index of indexes) {
      const row = rows[index];
      const sourceItem = loaded[index].item;
      const menuId = addMenuItem(
        db,
        {
          placeId,
          name: String(row.menu_item_name),
          category: String(row.menu_category),
        },
        actor,
      );
      createdMenuItemIds.push(menuId);
      const priceId = replacePrice(
        db,
        {
          menuItemId: menuId,
          priceFen: Math.round(Number(row.price_yuan) * 100),
          observedAt: String(row.observed_date),
          verificationMethod: String(row.verification_method),
          note: String(row.admin_note),
          sourceLeadId: leadId,
          status: 'verified',
        },
        actor,
      );
      if (!priceId) throw new CandidatePoolError('PRICE_CREATE_FAILED', '价格写入失败');
      db.prepare(
        'UPDATE source_lead_items SET status=\'converted\',matched_menu_item_id=?,matched_place_id=?,updated_at=? WHERE id=? AND status IN (\'new\',\'triaged\',\'verifying\')',
      ).run(menuId, placeId, now, sourceItem.id);
      if (
        Number(
          (db.prepare('SELECT changes() count').get() as { count: number }).count,
        ) !== 1
      )
        throw new CandidatePoolError(
          'CANDIDATE_ITEM_STATE_CONFLICT',
          '候选餐食状态已变化，请刷新后重试',
          409,
        );
      convertedItemIds.push(sourceItem.id);
    }
    const remaining = Number(
      (
        db
          .prepare(
            "SELECT count(*) count FROM source_lead_items WHERE source_lead_id=? AND status NOT IN ('converted','rejected','duplicate')",
          )
          .get(leadId) as { count: number }
      ).count,
    );
    const nextStatus = remaining === 0 ? 'converted' : 'verifying';
    db.prepare(
      'UPDATE source_leads SET status=?,matched_place_id=?,updated_at=? WHERE id=?',
    ).run(nextStatus, placeId, now, leadId);
    recordAudit(db, actor, 'lead', leadId, 'candidate_converted', undefined, {
      placeId,
      itemIds: indexes.map((index) => loaded[index].item.id),
      remainingItemCount: remaining,
    });
  }
  return {
    createdPlaceIds,
    createdMenuItemIds,
    convertedItemIds,
    count: createdPlaceIds.length,
  };
}

function requireDuplicateCandidates(
  db: SqliteDatabase,
  row: Record<string, unknown>,
) {
  const rows = db
    .prepare(
      "SELECT id,name,address,lng,lat FROM places WHERE record_status='active'",
    )
    .all() as Array<{
    id: string;
    name: string;
    address: string;
    lng: number;
    lat: number;
  }>;
  const distance = (a: typeof rows[number], b: Record<string, unknown>) => {
    const rad = Math.PI / 180;
    const x =
      (Number(b.lng) - a.lng) *
      rad *
      Math.cos(((Number(b.lat) + a.lat) / 2) * rad);
    const y = (Number(b.lat) - a.lat) * rad;
    return Math.sqrt(x * x + y * y) * 6371000;
  };
  return rows.filter(
    (existing) =>
      (normalize(existing.name) === normalize(String(row.place_name)) &&
        distance(existing, row) < 80) ||
      existing.address.trim() === String(row.address).trim(),
  );
}

export function commitCandidateDraft(
  db: SqliteDatabase,
  raw: unknown,
  actor = 'admin',
) {
  const request = parseCandidateCommitRequest(raw);
  const { payload, draft, sourceVersion } = draftRequestParts(db, request);
  if (!draft)
    throw new CandidatePoolError(
      'CANDIDATE_DRAFT_REQUIRED',
      '候选提交必须使用已保存草稿，不能直接提交页面内容',
      422,
    );
  if (draft?.sourceVersion && sourceVersion && draft.sourceVersion !== sourceVersion)
    throw new CandidatePoolError(
      'CANDIDATE_SOURCE_VERSION_CONFLICT',
      '候选来源已变化，请刷新草稿后重试',
      409,
    );
  return db.transaction(() => {
    if (draft) {
      const requestedVersion = numericCandidateVersion(request.version);
      const current = db
        .prepare('SELECT version,source_version FROM lead_conversion_drafts WHERE id=?')
        .get(draft.id) as
        | { version: number; source_version: string | null }
        | undefined;
      if (
        !current ||
        current.version !== draft.version ||
        requestedVersion !== current.version
      )
        throw new CandidatePoolError(
          'DRAFT_VERSION_CONFLICT',
          '草稿已被其他操作更新，请刷新后重试',
          409,
          { currentVersion: current?.version },
        );
      const ids = sourceItemIdsFromPayload(payload);
      if (
        current.source_version &&
        candidateSourceVersion(db, ids) !== current.source_version
      )
        throw new CandidatePoolError(
          'CANDIDATE_SOURCE_VERSION_CONFLICT',
          '候选来源已变化，请刷新草稿后重试',
          409,
        );
    } else {
      const currentSourceVersion = candidateSourceVersion(
        db,
        sourceItemIdsFromPayload(payload),
      );
      const requestedSourceVersion =
        typeof request.version === 'string' && !/^\d+$/.test(request.version)
          ? request.version
          : sourceVersion;
      if (requestedSourceVersion !== currentSourceVersion)
        throw new CandidatePoolError(
          'CANDIDATE_PREVIEW_VERSION_CONFLICT',
          '候选来源已变化，请重新预览后提交',
          409,
          { currentVersion: currentSourceVersion },
        );
    }
    const result = commitCandidatePlan(db, payload, actor);
    if (draft)
      db.prepare('DELETE FROM lead_conversion_drafts WHERE id=?').run(draft.id);
    return { ...result, deletedDraftId: draft?.id ?? null };
  })();
}

// Friendly aliases used by API handlers and callers migrating from a service
// module.  Keeping these exports small also makes the domain boundary obvious.
export const listCandidateGroups = (
  db: SqliteDatabase,
  filters: CandidateGroupFilters = {},
) => new CandidatePoolRepository(db).listGrouped(filters);

export const seedCandidatePool = seedCandidateBatch;
export const listCandidatePoolGroups = listCandidateGroups;
export const saveLeadConversionDraft = saveCandidateDraft;
export const getLeadConversionDraft = getCandidateDraft;
