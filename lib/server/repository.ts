import type { SqliteDatabase } from './db';
import { normalize, newId } from './seed';
import { recordAudit } from './audit';
import type { Place } from '../types';
import { distanceMeters } from '../geo';
import { ageInDays, freshness, freshnessLabel } from '../freshness';
import { placeTrust } from '../trust';
import { loadPlaceSourceView } from './sources';
import {
  clampDisplayPriceFen,
  DISPLAY_PRICE_CAP_FEN,
  PUBLIC_CITY_IDS,
  SHOP_GATE_PRICE_FEN,
} from '../cities';

export interface DbPlace extends Place {
  zoneName: string;
  accessType: string;
  accessNote?: string;
  openingHoursNote?: string;
  recordStatus: string;
  businessStatus: string;
  evidence: Array<{ id: string; width: number | null; height: number | null }>;
}
export interface PublicMapFilters {
  q?: string;
  zoneId?: string;
  city?: string;
  maxPriceFen?: number;
  bbox?: [number, number, number, number];
  tags?: string[];
  sort?: 'distance' | 'price' | 'freshness';
  origin?: { lng: number; lat: number };
  now?: Date;
  limit?: number;
}
export class PlaceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(
    filters: { q?: string; zoneId?: string; maxPriceFen?: number } = {},
  ): DbPlace[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, z.name zone_name, (SELECT MIN(pr.price_fen) FROM menu_items mi JOIN price_reports pr ON pr.menu_item_id=mi.id WHERE mi.place_id=p.id AND mi.active=1 AND ((pr.status='verified' AND pr.verification_method <> 'external_lead') OR pr.verification_method='external_lead') AND date(pr.observed_at) >= date('now','-180 day')) minimum_price FROM places p JOIN pilot_zones z ON z.id=p.zone_id WHERE p.record_status='active' AND p.business_status IN ('open','unknown') AND (? IS NULL OR p.zone_id=?) AND (? IS NULL OR p.name LIKE '%'||?||'%' OR EXISTS (SELECT 1 FROM menu_items mi WHERE mi.place_id=p.id AND mi.name LIKE '%'||?||'%')) AND (? IS NULL OR minimum_price <= ?) ORDER BY p.name`,
      )
      .all(
        filters.zoneId ?? null,
        filters.zoneId ?? null,
        filters.q ?? null,
        filters.q ?? null,
        filters.q ?? null,
        filters.maxPriceFen ?? null,
        filters.maxPriceFen ?? null,
      ) as Array<Record<string, unknown>>;
    return rows.map((row) => this.toPlace(row));
  }

  /** Public read model query. Eligibility is enforced in SQL before rows leave SQLite. */
  listPublic(filters: PublicMapFilters = {}): Array<
    DbPlace & {
      distanceMeters?: number;
      minimumPriceFen: number;
      freshestObservedAt: string;
    }
  > {
    const now = filters.now ?? new Date();
    const cutoff = new Date(now.getTime() - 180 * 86400000)
      .toISOString()
      .slice(0, 10);
    const maxPrice = clampDisplayPriceFen(filters.maxPriceFen);
    const clauses = [
      "p.record_status='active'",
      "p.business_status IN ('open','unknown')",
      'z.active=1',
      `EXISTS (SELECT 1 FROM menu_items em JOIN price_reports ep ON ep.menu_item_id=em.id WHERE em.place_id=p.id AND em.active=1 AND ((ep.status='verified' AND ep.verification_method <> 'external_lead') OR ep.verification_method='external_lead') AND ep.price_fen<=${SHOP_GATE_PRICE_FEN} AND date(ep.observed_at)>=date(?))`,
      `EXISTS (SELECT 1 FROM menu_items fm JOIN price_reports fp ON fp.menu_item_id=fm.id WHERE fm.place_id=p.id AND fm.active=1 AND ((fp.status='verified' AND fp.verification_method <> 'external_lead') OR fp.verification_method='external_lead') AND fp.price_fen<=? AND fp.price_fen<=${DISPLAY_PRICE_CAP_FEN} AND date(fp.observed_at)>=date(?))`,
    ];
    const values: unknown[] = [cutoff, maxPrice, cutoff];
    // The 5-city public whitelist is enforced here so a bbox / "nearby"
    // query can never surface a place from a retired city (data stays in the
    // DB but is not publicly browsable). Legacy rows without a city remain
    // visible for backward compatibility.
    clauses.push(
      `(p.city IS NULL OR p.city IN (${PUBLIC_CITY_IDS.map(() => '?').join(',')}))`,
    );
    values.push(...PUBLIC_CITY_IDS);
    if (filters.zoneId) {
      clauses.push('p.zone_id=?');
      values.push(filters.zoneId);
    }
    if (filters.city) {
      // Legacy rows without an explicit city stay visible (backward
      // compatible); rows attributed to another city are excluded so an
      // overlapping neighbouring-city bbox cannot leak them into this view.
      clauses.push('(p.city IS NULL OR p.city=?)');
      values.push(filters.city);
    }
    if (filters.q?.trim()) {
      clauses.push(
        "(p.name LIKE '%'||?||'%' OR EXISTS (SELECT 1 FROM menu_items qm WHERE qm.place_id=p.id AND qm.active=1 AND qm.name LIKE '%'||?||'%'))",
      );
      values.push(filters.q.trim(), filters.q.trim());
    }
    if (filters.bbox) {
      clauses.push('p.lng BETWEEN ? AND ?', 'p.lat BETWEEN ? AND ?');
      values.push(
        filters.bbox[0],
        filters.bbox[2],
        filters.bbox[1],
        filters.bbox[3],
      );
    }
    for (const tag of filters.tags ?? []) {
      clauses.push(
        'EXISTS (SELECT 1 FROM place_tags fpt JOIN tags ft ON ft.id=fpt.tag_id WHERE fpt.place_id=p.id AND ft.name=?)',
      );
      values.push(tag);
    }
    const rows = this.db
      .prepare(
        `SELECT p.*, z.name zone_name,
      (SELECT MIN(pr.price_fen) FROM menu_items mi JOIN price_reports pr ON pr.menu_item_id=mi.id WHERE mi.place_id=p.id AND mi.active=1 AND ((pr.status='verified' AND pr.verification_method <> 'external_lead') OR pr.verification_method='external_lead') AND pr.price_fen<=? AND pr.price_fen<=${DISPLAY_PRICE_CAP_FEN} AND date(pr.observed_at)>=date(?)) minimum_price_fen,
      COALESCE((SELECT MAX(pr.observed_at) FROM menu_items mi JOIN price_reports pr ON pr.menu_item_id=mi.id WHERE mi.place_id=p.id AND mi.active=1 AND pr.status='verified' AND pr.verification_method <> 'external_lead' AND date(pr.observed_at)>=date(?)), '') freshest_observed_at
      FROM places p JOIN pilot_zones z ON z.id=p.zone_id WHERE ${clauses.join(' AND ')} ORDER BY p.id`,
      )
      .all(maxPrice, cutoff, cutoff, ...values) as Array<
      Record<string, unknown>
    >;
    const origin = filters.origin;
    const result = rows.map((row) => {
      const place = this.toPlace(row);
      return {
        ...place,
        minimumPriceFen: Number(row.minimum_price_fen),
        freshestObservedAt: String(row.freshest_observed_at),
        ...(origin ? { distanceMeters: distanceMeters(origin, place) } : {}),
      };
    });
    const sort = filters.sort ?? (origin ? 'distance' : 'price');
    result.sort((a, b) => {
      const primary =
        sort === 'distance'
          ? (a.distanceMeters ?? Number.POSITIVE_INFINITY) -
            (b.distanceMeters ?? Number.POSITIVE_INFINITY)
          : sort === 'freshness'
            ? b.freshestObservedAt.localeCompare(a.freshestObservedAt)
            : a.minimumPriceFen - b.minimumPriceFen;
      return (
        primary ||
        b.freshestObservedAt.localeCompare(a.freshestObservedAt) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
      );
    });
    return result.slice(0, Math.min(filters.limit ?? 500, 500));
  }

  /** Most recently verified eligible places within a rolling day window. */
  listRecentlyVerified(
    options: { days?: number; limit?: number; now?: Date } = {},
  ): Array<
    DbPlace & {
      minimumPriceFen: number;
      freshestObservedAt: string;
    }
  > {
    const days = Math.min(Math.max(Math.trunc(options.days ?? 7), 1), 30);
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 5), 1), 20);
    const now = options.now ?? new Date();
    const places = this.listPublic({ sort: 'freshness', now, limit: 500 });
    return places
      .filter((place) => ageInDays(place.freshestObservedAt, now) <= days)
      .slice(0, limit);
  }

  listAdmin(filters: { q?: string; zoneId?: string } = {}): DbPlace[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, z.name zone_name FROM places p JOIN pilot_zones z ON z.id=p.zone_id WHERE (? IS NULL OR p.zone_id=?) AND (? IS NULL OR p.name LIKE '%'||?||'%') ORDER BY p.name`,
      )
      .all(
        filters.zoneId ?? null,
        filters.zoneId ?? null,
        filters.q ?? null,
        filters.q ?? null,
      ) as Array<Record<string, unknown>>;
    return rows.map((row) => this.toPlace(row));
  }

  get(id: string): DbPlace | null {
    const row = this.db
      .prepare(
        `SELECT p.*, z.name zone_name FROM places p JOIN pilot_zones z ON z.id=p.zone_id WHERE p.id=? AND p.record_status='active'`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.toPlace(row) : null;
  }
  getAdmin(id: string): DbPlace | null {
    const row = this.db
      .prepare(
        'SELECT p.*, z.name zone_name FROM places p JOIN pilot_zones z ON z.id=p.zone_id WHERE p.id=?',
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.toPlace(row) : null;
  }
  create(
    input: Omit<
      DbPlace,
      | 'id'
      | 'meals'
      | 'verification'
      | 'zoneName'
      | 'accessType'
      | 'recordStatus'
      | 'businessStatus'
      | 'evidence'
    > & {
      zoneId: string;
      accessType: string;
      accessNote?: string;
      businessStatus?: string;
      tags?: string[];
    },
    actor = 'admin',
  ): string {
    const id = newId('place');
    const now = new Date().toISOString();
    const city = input.city ?? this.zoneCity(input.zoneId);
    const run = this.db.prepare(
      'INSERT INTO places(id,zone_id,city,name,normalized_name,address,lng,lat,category,access_type,access_note,business_status,record_status,opening_hours_note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    );
    run.run(
      id,
      input.zoneId,
      city,
      input.name,
      normalize(input.name),
      input.address,
      input.lng,
      input.lat,
      input.category,
      input.accessType,
      input.accessNote ?? null,
      input.businessStatus ?? 'unknown',
      'active',
      input.openingHoursNote ?? null,
      now,
      now,
    );
    this.setTags(id, input.tags ?? []);
    recordAudit(this.db, actor, 'place', id, 'create', undefined, {
      name: input.name,
    });
    return id;
  }
  update(
    id: string,
    patch: Partial<
      Pick<
        DbPlace,
        'name' | 'address' | 'category' | 'accessNote' | 'openingHoursNote'
      >
    > & { businessStatus?: string; recordStatus?: string; accessType?: string },
    actor = 'admin',
  ) {
    const before = this.getAdmin(id);
    if (!before) throw new Error('PLACE_NOT_FOUND');
    const fields = Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(
        ([key]) =>
          `${key === 'accessNote' ? 'access_note' : key === 'openingHoursNote' ? 'opening_hours_note' : key === 'businessStatus' ? 'business_status' : key === 'recordStatus' ? 'record_status' : key === 'accessType' ? 'access_type' : key} = ?`,
      );
    const values = Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([, value]) => value);
    if (!fields.length) return;
    if (patch.name) {
      fields.push('normalized_name = ?');
      values.push(normalize(patch.name));
    }
    values.push(new Date().toISOString(), id);
    this.db
      .prepare(
        `UPDATE places SET ${fields.join(', ')}, updated_at=? WHERE id=?`,
      )
      .run(...values);
    recordAudit(
      this.db,
      actor,
      'place',
      id,
      'update',
      before,
      this.getAdmin(id),
    );
  }
  setTags(placeId: string, tags: string[]) {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO tags(id,name) VALUES (?,?)',
    );
    const join = this.db.prepare(
      'INSERT OR IGNORE INTO place_tags(place_id,tag_id) VALUES (?,?)',
    );
    tags.forEach((tag) => {
      insert.run(tag, tag);
      join.run(placeId, tag);
    });
  }
  private zoneCity(zoneId: string): string | null {
    const row = this.db
      .prepare('SELECT city FROM pilot_zones WHERE id=?')
      .get(zoneId) as { city: string | null } | undefined;
    return row?.city ?? null;
  }

  private toPlace(row: Record<string, unknown>): DbPlace {
    const meals = this.db
      .prepare(
        `SELECT mi.*, pr.price_fen, pr.observed_at, pr.verification_method, pr.status price_status,
        (SELECT pp.price_fen FROM price_reports pp WHERE pp.menu_item_id=mi.id AND pp.status IN ('verified','superseded') AND pp.id<>pr.id AND pp.verification_method <> 'external_lead' ORDER BY pp.observed_at DESC, pp.created_at DESC LIMIT 1) prev_price_fen
        FROM menu_items mi LEFT JOIN price_reports pr ON pr.menu_item_id=mi.id AND pr.status='verified' AND pr.verification_method <> 'external_lead' WHERE mi.place_id=? AND mi.active=1 ORDER BY pr.price_fen`,
      )
      .all(row.id) as Array<Record<string, unknown>>;
    const tags = this.db
      .prepare(
        'SELECT t.name FROM tags t JOIN place_tags pt ON pt.tag_id=t.id WHERE pt.place_id=?',
      )
      .all(row.id) as Array<{ name: string }>;
    const evidence = this.db
      .prepare(
        `SELECT DISTINCT em.id,em.width,em.height FROM evidence_media em JOIN price_reports pr ON pr.id=em.price_report_id JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE mi.place_id=? AND pr.status='verified' AND pr.verification_method <> 'external_lead' AND pr.price_fen<=${DISPLAY_PRICE_CAP_FEN} AND date(pr.observed_at)>=date('now','-180 day') AND em.visibility='public' AND em.rights_confirmed_at IS NOT NULL AND em.redaction_status IN ('completed','not_needed') ORDER BY em.created_at`,
      )
      .all(row.id) as Array<{
      id: string;
      width: number | null;
      height: number | null;
    }>;
    const sourceView = loadPlaceSourceView(this.db, String(row.id));
    const creatorPrices = this.db
      .prepare(
        `SELECT pr.menu_item_id, pr.price_fen, pr.observed_at
         FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id
         WHERE mi.place_id=? AND mi.active=1
            AND pr.verification_method='external_lead' AND pr.price_fen<=${DISPLAY_PRICE_CAP_FEN}
         ORDER BY pr.observed_at DESC, pr.created_at DESC`,
      )
      .all(row.id) as Array<{
      menu_item_id: string;
      price_fen: number;
      observed_at: string;
    }>;
    const creatorPriceByMenu = new Map<
      string,
      { priceFen: number; observedAt: string }
    >();
    for (const price of creatorPrices) {
      if (!creatorPriceByMenu.has(price.menu_item_id))
        creatorPriceByMenu.set(price.menu_item_id, {
          priceFen: Number(price.price_fen),
          observedAt: String(price.observed_at),
        });
    }
    const mappedMeals = meals
      .map((meal) => {
        const menuItemId = String(meal.id);
        const verified = meal.price_fen !== null && meal.price_fen !== undefined;
        const creator = creatorPriceByMenu.get(menuItemId);
        if (!verified && !creator) return null;
        const observedAt = verified
          ? String(meal.observed_at)
          : creator!.observedAt;
        const priceFen = verified ? Number(meal.price_fen) : creator!.priceFen;
        const previous =
          verified &&
          meal.prev_price_fen !== null &&
          meal.prev_price_fen !== undefined
            ? Number(meal.prev_price_fen)
            : undefined;
        const delta = previous !== undefined ? priceFen - previous : 0;
        const mealSource = sourceView.byMenuItem[menuItemId];
        return {
          id: menuItemId,
          name: String(meal.name),
          priceFen,
          category: String(meal.category),
          description: String(meal.description ?? ''),
          observedAt,
          method: verified ? String(meal.verification_method) : 'external_lead',
          freshness: freshnessLabel(freshness(observedAt)),
          ageDays: ageInDays(observedAt),
          ...(verified ? {} : { unverified: true as const }),
          ...(mealSource ? { source: mealSource } : {}),
          ...(previous !== undefined && delta !== 0
            ? {
                previousPriceFen: previous,
                priceChange: {
                  direction: delta > 0 ? 'up' : 'down',
                  deltaFen: Math.abs(delta),
                } as const,
              }
            : {}),
        };
      })
      .filter((meal) => meal !== null);
    return {
      id: String(row.id),
      zoneId: String(row.zone_id) as Place['zoneId'],
      zoneName: String(row.zone_name),
      ...(row.city ? { city: String(row.city) } : {}),
      name: String(row.name),
      address: String(row.address),
      lng: Number(row.lng),
      lat: Number(row.lat),
      category: String(row.category),
      access: String(row.access_note ?? row.access_type),
      accessType: String(row.access_type),
      accessNote: row.access_note ? String(row.access_note) : undefined,
      openingHoursNote: row.opening_hours_note
        ? String(row.opening_hours_note)
        : undefined,
      tags: tags.map((tag) => tag.name as Place['tags'][number]),
      note: String(row.opening_hours_note ?? ''),
      recordStatus: String(row.record_status),
      businessStatus: String(row.business_status),
      verification: placeTrust(mappedMeals).level,
      evidence,
      ...(sourceView.placeLabels ? { sources: sourceView.placeLabels } : {}),
      meals: mappedMeals,
    };
  }
}

export class LeadRepository {
  constructor(private readonly db: SqliteDatabase) {}
  list() {
    return this.db
      .prepare('SELECT * FROM source_leads ORDER BY created_at DESC')
      .all();
  }
  create(input: Record<string, unknown>, actor = 'admin') {
    const id = newId('lead');
    const now = new Date().toISOString();
    const discoveryMethod =
      typeof input.discoveryMethod === 'string'
        ? input.discoveryMethod
        : input.sourcePlatform === 'douban'
          ? 'community'
          : input.sourcePlatform === 'user'
            ? 'user_submission'
            : input.sourcePlatform === 'web'
              ? 'web'
              : 'manual';
    this.db
      .prepare(
        'INSERT INTO source_leads(id,source_platform,source_url,clue_place_name,clue_item_name,clue_price_fen,source_published_at,summary,status,matched_place_id,discovery_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        input.sourcePlatform,
        input.sourceUrl || null,
        input.cluePlaceName,
        input.clueItemName || null,
        input.cluePriceFen || null,
        input.sourcePublishedAt || null,
        input.summary || null,
        input.status || 'new',
        input.matchedPlaceId || null,
        discoveryMethod,
        now,
        now,
      );
    if (input.clueItemName) {
      this.db
        .prepare(
          'INSERT INTO source_lead_items(id,source_lead_id,clue_item_name,clue_price_fen,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run(
          newId('lead-item'),
          id,
          input.clueItemName,
          input.cluePriceFen || null,
          input.status || 'new',
          now,
          now,
        );
    }
    recordAudit(this.db, actor, 'lead', id, 'create', undefined, {
      cluePlaceName: input.cluePlaceName,
    });
    return id;
  }
  update(id: string, patch: Record<string, unknown>, actor = 'admin') {
    const allowed: Record<string, string> = {
      sourcePlatform: 'source_platform',
      sourceUrl: 'source_url',
      cluePlaceName: 'clue_place_name',
      clueItemName: 'clue_item_name',
      cluePriceFen: 'clue_price_fen',
      sourcePublishedAt: 'source_published_at',
      summary: 'summary',
      status: 'status',
      matchedPlaceId: 'matched_place_id',
      discoveryMethod: 'discovery_method',
    };
    const before = this.db
      .prepare('SELECT * FROM source_leads WHERE id=?')
      .get(id) as { status: string; matched_place_id: string | null } | undefined;
    if (!before) throw new Error('LEAD_NOT_FOUND');
    if (patch.status === 'converted' && !before.matched_place_id)
      throw new Error('INVALID_LEAD_TRANSITION');
    if (patch.status !== undefined && patch.status !== before.status) {
      const transitions: Record<string, string[]> = {
        new: ['triaged', 'verifying', 'rejected', 'duplicate'],
        triaged: ['verifying', 'rejected', 'duplicate'],
        verifying: ['converted', 'rejected', 'duplicate'],
        converted: [],
        rejected: [],
        duplicate: [],
      };
      if (!transitions[before.status]?.includes(String(patch.status)))
        throw new Error('INVALID_LEAD_TRANSITION');
    }
    const entries = Object.entries(patch).filter(
      ([key, value]) => allowed[key] && value !== undefined,
    );
    if (!entries.length) return;
    const values = entries.map(([, value]) => value || null);
    const fields = entries.map(([key]) => `${allowed[key]}=?`);
    values.push(new Date().toISOString(), id);
    this.db
      .prepare(
        `UPDATE source_leads SET ${fields.join(',')},updated_at=? WHERE id=?`,
      )
      .run(...values);
    if (patch.clueItemName !== undefined || patch.cluePriceFen !== undefined) {
      const item = this.db
        .prepare(
          'SELECT id,status FROM source_lead_items WHERE source_lead_id=? ORDER BY created_at,id LIMIT 1',
        )
        .get(id) as { id: string; status: string } | undefined;
      if (item) {
        const itemFields: string[] = [];
        const itemValues: unknown[] = [];
        if (patch.clueItemName !== undefined) {
          itemFields.push('clue_item_name=?');
          itemValues.push(patch.clueItemName);
        }
        if (patch.cluePriceFen !== undefined) {
          itemFields.push('clue_price_fen=?');
          itemValues.push(patch.cluePriceFen || null);
        }
        itemValues.push(new Date().toISOString(), item.id);
        this.db
          .prepare(
            `UPDATE source_lead_items SET ${itemFields.join(',')},updated_at=? WHERE id=?`,
          )
          .run(...itemValues);
      } else if (patch.clueItemName) {
        this.db
          .prepare(
            'INSERT INTO source_lead_items(id,source_lead_id,clue_item_name,clue_price_fen,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
          )
          .run(
            newId('lead-item'),
            id,
            patch.clueItemName,
            patch.cluePriceFen || null,
            patch.status || before.status,
            new Date().toISOString(),
            new Date().toISOString(),
          );
      }
    }
    recordAudit(
      this.db,
      actor,
      'lead',
      id,
      'update',
      before,
      this.db.prepare('SELECT * FROM source_leads WHERE id=?').get(id),
    );
  }
}

export type AdminSubmissionRow = {
  id: string;
  type: string;
  target_place_id: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  payload_json?: string;
};
export function listSubmissions(
  db: SqliteDatabase,
  limit?: number,
): AdminSubmissionRow[] {
  const rows = db
    .prepare(
      `SELECT id,type,target_place_id,status,review_note,created_at,reviewed_at,payload_json FROM submissions ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`,
    )
    .all(...(limit ? [limit] : [])) as AdminSubmissionRow[];
  return rows;
}
export function listSubmissionMedia(db: SqliteDatabase, submissionId: string) {
  return db
    .prepare(
      'SELECT id,mime_type,width,height,visibility,redaction_status,rights_confirmed_at FROM evidence_media WHERE submission_id=? ORDER BY created_at',
    )
    .all(submissionId) as Array<{
    id: string;
    mime_type: string;
    width: number | null;
    height: number | null;
    visibility: string;
    redaction_status: string;
    rights_confirmed_at: string | null;
  }>;
}
export function dashboardSummary(db: SqliteDatabase) {
  const count = (sql: string) =>
    Number((db.prepare(sql).get() as { count: number }).count);
  return {
    publicPlaces: count(
      "SELECT count(*) count FROM places WHERE record_status='active' AND business_status IN ('open','unknown')",
    ),
    validMeals: count(
      `SELECT count(*) count FROM menu_items mi JOIN price_reports pr ON pr.menu_item_id=mi.id WHERE mi.active=1 AND pr.status='verified' AND pr.verification_method <> 'external_lead' AND pr.price_fen<=${SHOP_GATE_PRICE_FEN} AND date(pr.observed_at)>=date('now','-180 day')`,
    ),
    pendingSubmissions: count(
      "SELECT count(*) count FROM submissions WHERE status IN ('pending','needs_verification')",
    ),
    activeLeads: count(
      "SELECT count(*) count FROM source_leads WHERE status IN ('new','triaged','verifying')",
    ),
    expiredPrices: count(
      "SELECT count(*) count FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE pr.status='verified' AND pr.verification_method <> 'external_lead' AND date(pr.observed_at)<date('now','-180 day')",
    ),
    auditEntries: count('SELECT count(*) count FROM moderation_actions'),
  };
}
export function listAuditEntries(db: SqliteDatabase, limit = 30) {
  return db
    .prepare(
      'SELECT id,actor,object_type,object_id,action,created_at FROM moderation_actions ORDER BY created_at DESC LIMIT ?',
    )
    .all(limit) as Array<{
    id: string;
    actor: string;
    object_type: string;
    object_id: string;
    action: string;
    created_at: string;
  }>;
}
export function listPriceReports(db: SqliteDatabase, limit = 50) {
  return db
    .prepare(
      'SELECT pr.id,pr.menu_item_id,mi.name menu_item_name,p.name place_name,pr.price_fen,pr.observed_at,pr.status,pr.verification_method FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id JOIN places p ON p.id=mi.place_id ORDER BY pr.observed_at DESC LIMIT ?',
    )
    .all(limit);
}

export function addMenuItem(
  db: SqliteDatabase,
  input: {
    placeId: string;
    name: string;
    category: string;
    description?: string;
    active?: boolean;
  },
  actor = 'admin',
) {
  const id = newId('meal');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO menu_items(id,place_id,name,normalized_name,category,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?)',
  ).run(
    id,
    input.placeId,
    input.name,
    normalize(input.name),
    input.category,
    input.description || null,
    input.active === false ? 0 : 1,
    now,
    now,
  );
  recordAudit(db, actor, 'menu_item', id, 'create', undefined, input);
  return id;
}
export function updateMenuItem(
  db: SqliteDatabase,
  id: string,
  patch: {
    name?: string;
    category?: string;
    description?: string;
    active?: boolean;
  },
  actor = 'admin',
) {
  const before = db.prepare('SELECT * FROM menu_items WHERE id=?').get(id);
  if (!before) throw new Error('MENU_NOT_FOUND');
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push('name=?', 'normalized_name=?');
    values.push(patch.name, normalize(patch.name));
  }
  for (const [key, column] of [
    ['category', 'category'],
    ['description', 'description'],
  ] as const)
    if (patch[key] !== undefined) {
      fields.push(`${column}=?`);
      values.push(patch[key]);
    }
  if (patch.active !== undefined) {
    fields.push('active=?');
    values.push(patch.active ? 1 : 0);
  }
  if (!fields.length) return;
  values.push(new Date().toISOString(), id);
  db.prepare(
    `UPDATE menu_items SET ${fields.join(',')},updated_at=? WHERE id=?`,
  ).run(...values);
  recordAudit(
    db,
    actor,
    'menu_item',
    id,
    'update',
    before,
    db.prepare('SELECT * FROM menu_items WHERE id=?').get(id),
  );
}
export function updatePriceStatus(
  db: SqliteDatabase,
  id: string,
  next: 'pending' | 'verified' | 'disputed' | 'superseded' | 'archived',
  actor = 'admin',
) {
  return db.transaction(() => {
    const before = db
      .prepare('SELECT * FROM price_reports WHERE id=?')
      .get(id) as {
      status: string;
      menu_item_id: string;
      verification_method: string;
    } | undefined;
    if (!before) throw new Error('PRICE_NOT_FOUND');
    const transitions: Record<string, string[]> = {
      pending: ['verified', 'archived'],
      verified: ['disputed', 'superseded', 'archived'],
      disputed: ['verified', 'superseded', 'archived'],
      superseded: [],
      archived: [],
    };
    if (!transitions[before.status]?.includes(next))
      throw new Error('INVALID_PRICE_TRANSITION');
    if (next === 'verified' && before.verification_method === 'external_lead')
      throw new Error('EXTERNAL_LEAD_NOT_VERIFIED');
    if (next === 'verified')
      db.prepare(
        "UPDATE price_reports SET status='superseded',reviewed_at=? WHERE menu_item_id=? AND status='verified' AND id<>?",
      ).run(new Date().toISOString(), before.menu_item_id, id);
    db.prepare(
      'UPDATE price_reports SET status=?,reviewed_at=? WHERE id=?',
    ).run(next, new Date().toISOString(), id);
    recordAudit(
      db,
      actor,
      'price_report',
      id,
      'status_change',
      before,
      db.prepare('SELECT * FROM price_reports WHERE id=?').get(id),
    );
    return next;
  })();
}

export function replacePrice(
  db: SqliteDatabase,
  input: {
    menuItemId: string;
    priceFen: number;
    observedAt: string;
    verificationMethod: string;
    status?: string;
    note?: string;
    sourceLeadId?: string;
  },
  actor = 'admin',
) {
  const status = input.status || 'verified';
  if (!['pending', 'verified', 'disputed'].includes(status))
    throw new Error('INVALID_PRICE_TRANSITION');
  if (status === 'verified' && input.verificationMethod === 'external_lead')
    throw new Error('EXTERNAL_LEAD_NOT_VERIFIED');
  return db.transaction(() => {
    const old = db
      .prepare(
        "SELECT * FROM price_reports WHERE menu_item_id=? AND status='verified'",
      )
      .all(input.menuItemId);
    if (status === 'verified')
      db.prepare(
        "UPDATE price_reports SET status='superseded' WHERE menu_item_id=? AND status='verified'",
      ).run(input.menuItemId);
    const id = newId('price');
    db.prepare(
      'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,source_lead_id,note,reviewed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      input.menuItemId,
      input.priceFen,
      input.observedAt,
      input.verificationMethod,
      status,
      input.sourceLeadId || null,
      input.note || null,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    recordAudit(db, actor, 'price_report', id, 'replace', old, input);
    return id;
  })();
}
