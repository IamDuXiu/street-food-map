import { createHash, randomBytes } from 'node:crypto';
import type { SqliteDatabase } from './db';
import { recordAudit } from './audit';
import { normalize, newId } from './seed';
import { PlaceRepository, addMenuItem, replacePrice } from './repository';
import {
  submissionSchema,
  type SubmissionPayload,
  csvRowSchema,
  type CsvRow,
  verifiedVerificationMethods,
} from './validation';

export function freshness(
  observedAt: string,
  now = new Date(),
): 'recent' | 'valid' | 'stale' | 'expired' {
  const days = Math.floor(
    (now.getTime() - new Date(observedAt).getTime()) / 86400000,
  );
  if (days <= 30) return 'recent';
  if (days <= 90) return 'valid';
  if (days <= 180) return 'stale';
  return 'expired';
}
export function isPublicPrice(
  priceFen: number,
  observedAt: string,
  now = new Date(),
  verificationMethod?: string,
) {
  return (
    priceFen <= 2500 &&
    freshness(observedAt, now) !== 'expired' &&
    verificationMethod !== 'external_lead'
  );
}
function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}
export function duplicateCandidates(
  db: SqliteDatabase,
  input: { name: string; address: string; lng: number; lat: number },
  excludeId?: string,
) {
  const rows = db
    .prepare(
      "SELECT id,name,address,lng,lat FROM places WHERE record_status='active' AND id != COALESCE(?, '')",
    )
    .all(excludeId ?? null) as Array<{
    id: string;
    name: string;
    address: string;
    lng: number;
    lat: number;
  }>;
  return rows.filter(
    (row) =>
      (normalize(row.name) === normalize(input.name) &&
        distanceMeters(input.lat, input.lng, row.lat, row.lng) < 80) ||
      row.address.trim() === input.address.trim(),
  );
}

export function mergePlaces(
  db: SqliteDatabase,
  keepId: string,
  duplicateId: string,
  actor = 'admin',
) {
  if (keepId === duplicateId) throw new Error('MERGE_SAME_PLACE');
  return db.transaction(() => {
    const keep = db
      .prepare("SELECT * FROM places WHERE id=? AND record_status='active'")
      .get(keepId) as Record<string, unknown> | undefined;
    const duplicate = db
      .prepare("SELECT * FROM places WHERE id=? AND record_status='active'")
      .get(duplicateId) as Record<string, unknown> | undefined;
    if (!keep || !duplicate) throw new Error('PLACE_NOT_FOUND');
    const duplicateMeals = db
      .prepare('SELECT * FROM menu_items WHERE place_id=?')
      .all(duplicateId) as Array<Record<string, unknown>>;
    for (const meal of duplicateMeals) {
      const same = db
        .prepare(
          'SELECT * FROM menu_items WHERE place_id=? AND normalized_name=? AND active=1',
        )
        .get(keepId, meal.normalized_name) as
        | Record<string, unknown>
        | undefined;
      if (same) {
        db.prepare(
          'UPDATE price_reports SET menu_item_id=? WHERE menu_item_id=?',
        ).run(same.id, meal.id);
        const newest = db
          .prepare(
            "SELECT id FROM price_reports WHERE menu_item_id=? AND status='verified' ORDER BY observed_at DESC, created_at DESC LIMIT 1",
          )
          .get(same.id) as { id: string } | undefined;
        if (newest)
          db.prepare(
            "UPDATE price_reports SET status='superseded' WHERE menu_item_id=? AND status='verified' AND id<>?",
          ).run(same.id, newest.id);
        db.prepare(
          'UPDATE menu_items SET active=0, updated_at=? WHERE id=?',
        ).run(new Date().toISOString(), meal.id);
      } else
        db.prepare(
          'UPDATE menu_items SET place_id=?, updated_at=? WHERE id=?',
        ).run(keepId, new Date().toISOString(), meal.id);
    }
    db.prepare(
      'INSERT OR IGNORE INTO place_tags(place_id,tag_id) SELECT ?,tag_id FROM place_tags WHERE place_id=?',
    ).run(keepId, duplicateId);
    db.prepare(
      'UPDATE source_leads SET matched_place_id=? WHERE matched_place_id=?',
    ).run(keepId, duplicateId);
    db.prepare(
      'UPDATE submissions SET target_place_id=? WHERE target_place_id=?',
    ).run(keepId, duplicateId);
    db.prepare(
      "UPDATE places SET record_status='merged', merged_into_place_id=?, updated_at=? WHERE id=?",
    ).run(keepId, new Date().toISOString(), duplicateId);
    recordAudit(
      db,
      actor,
      'place',
      duplicateId,
      'merge',
      { keepId, duplicateId },
      { mergedInto: keepId },
    );
    return keepId;
  })();
}
export function previewMerge(
  db: SqliteDatabase,
  keepId: string,
  duplicateId: string,
) {
  const keep = db
    .prepare(
      "SELECT id,name,address,updated_at FROM places WHERE id=? AND record_status='active'",
    )
    .get(keepId) as
    | { id: string; name: string; address: string; updated_at: string }
    | undefined;
  const duplicate = db
    .prepare(
      "SELECT id,name,address,updated_at FROM places WHERE id=? AND record_status='active'",
    )
    .get(duplicateId) as
    | { id: string; name: string; address: string; updated_at: string }
    | undefined;
  if (!keep || !duplicate || keepId === duplicateId)
    throw new Error('PLACE_NOT_FOUND');
  const duplicateMeals = db
    .prepare(
      'SELECT id,name,normalized_name FROM menu_items WHERE place_id=? AND active=1',
    )
    .all(duplicateId) as Array<{
    id: string;
    name: string;
    normalized_name: string;
  }>;
  const conflicts = duplicateMeals.filter((meal) =>
    db
      .prepare(
        'SELECT 1 FROM menu_items WHERE place_id=? AND normalized_name=? AND active=1',
      )
      .get(keepId, meal.normalized_name),
  );
  const count = (sql: string, id: string) =>
    Number((db.prepare(sql).get(id) as { count: number }).count);
  const snapshot = {
    places: [keep, duplicate],
    meals: db
      .prepare(
        'SELECT id,place_id,normalized_name,active,updated_at FROM menu_items WHERE place_id IN (?,?) ORDER BY id',
      )
      .all(keepId, duplicateId),
    prices: db
      .prepare(
        'SELECT pr.id,pr.menu_item_id,pr.status,pr.observed_at,pr.reviewed_at,pr.created_at FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE mi.place_id IN (?,?) ORDER BY pr.id',
      )
      .all(keepId, duplicateId),
    tags: db
      .prepare(
        'SELECT place_id,tag_id FROM place_tags WHERE place_id IN (?,?) ORDER BY place_id,tag_id',
      )
      .all(keepId, duplicateId),
    leads: db
      .prepare(
        'SELECT id,matched_place_id,updated_at FROM source_leads WHERE matched_place_id IN (?,?) ORDER BY id',
      )
      .all(keepId, duplicateId),
    submissions: db
      .prepare(
        'SELECT id,target_place_id,status,reviewed_at FROM submissions WHERE target_place_id IN (?,?) ORDER BY id',
      )
      .all(keepId, duplicateId),
  };
  const version = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');
  return {
    keep: { id: keep.id, name: keep.name, address: keep.address },
    duplicate: {
      id: duplicate.id,
      name: duplicate.name,
      address: duplicate.address,
    },
    version,
    meals: {
      move: duplicateMeals.length - conflicts.length,
      conflicts: conflicts.map((meal) => meal.name),
    },
    prices: count(
      'SELECT count(*) count FROM price_reports pr JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE mi.place_id=?',
      duplicateId,
    ),
    evidence: count(
      'SELECT count(*) count FROM evidence_media em JOIN price_reports pr ON pr.id=em.price_report_id JOIN menu_items mi ON mi.id=pr.menu_item_id WHERE mi.place_id=?',
      duplicateId,
    ),
    tags: count(
      'SELECT count(*) count FROM place_tags WHERE place_id=?',
      duplicateId,
    ),
    leads: count(
      'SELECT count(*) count FROM source_leads WHERE matched_place_id=?',
      duplicateId,
    ),
    submissions: count(
      'SELECT count(*) count FROM submissions WHERE target_place_id=?',
      duplicateId,
    ),
  };
}

function consumeRateLimit(
  db: SqliteDatabase,
  sourceHash: string,
  kind: 'submit' | 'status',
  limit: number,
) {
  const windowStart = new Date(
    Math.floor(Date.now() / 3600000) * 3600000,
  ).toISOString();
  const key = `${kind}:${sourceHash}:${windowStart.slice(0, 13)}`;
  const row = db
    .prepare('SELECT count FROM rate_limit_buckets WHERE bucket_key=?')
    .get(key) as { count: number } | undefined;
  if ((row?.count ?? 0) >= limit) throw new Error('RATE_LIMITED');
  db.prepare(
    'INSERT INTO rate_limit_buckets(bucket_key,window_start,count) VALUES (?,?,1) ON CONFLICT(bucket_key) DO UPDATE SET count=count+1',
  ).run(key, windowStart);
}

export function createSubmission(
  db: SqliteDatabase,
  raw: unknown,
  options: { sourceHash?: string; rightsConfirmed?: boolean } = {},
) {
  const payload = submissionSchema.parse(raw);
  const id = newId('submission');
  const lookupCode = randomBytes(16).toString('base64url');
  const lookupHash = createHash('sha256').update(lookupCode).digest('hex');
  const uploadToken = randomBytes(32).toString('base64url');
  const uploadHash = createHash('sha256').update(uploadToken).digest('hex');
  const createdAt = new Date();
  const sourceHash = options.sourceHash ?? 'internal';
  db.transaction(() => {
    consumeRateLimit(db, sourceHash, 'submit', 5);
    db.prepare(
      'INSERT INTO submissions(id,type,target_place_id,payload_json,status,lookup_code_hash,upload_token_hash,upload_token_expires_at,source_hash,rights_confirmed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      payload.type,
      'placeId' in payload ? payload.placeId : null,
      JSON.stringify(payload),
      'pending',
      lookupHash,
      uploadHash,
      new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(),
      sourceHash,
      options.rightsConfirmed ? createdAt.toISOString() : null,
      createdAt.toISOString(),
    );
  })();
  return {
    id,
    lookupCode,
    uploadToken,
    uploadTokenExpiresAt: new Date(
      createdAt.getTime() + 30 * 60 * 1000,
    ).toISOString(),
  };
}

export function getSubmissionStatus(
  db: SqliteDatabase,
  lookupCode: string,
  sourceHash: string,
) {
  if (!lookupCode || lookupCode.length < 16 || lookupCode.length > 100)
    throw new Error('NOT_FOUND');
  consumeRateLimit(db, sourceHash, 'status', 10);
  const hash = createHash('sha256').update(lookupCode).digest('hex');
  const row = db
    .prepare(
      'SELECT id,type,status,created_at,reviewed_at FROM submissions WHERE lookup_code_hash=?',
    )
    .get(hash) as
    | {
        id: string;
        type: string;
        status: string;
        created_at: string;
        reviewed_at: string | null;
      }
    | undefined;
  if (!row) throw new Error('NOT_FOUND');
  const messages: Record<string, string> = {
    pending: '已收到，正在排队核验。',
    needs_verification: '还需要补充核验，暂未公开。',
    approved: '核验通过，符合条件的内容会逐步出现在地图上。',
    rejected: '这条投稿未通过公开审核。',
    duplicate: '这条投稿与已有记录重复。',
  };
  return {
    idSuffix: row.id.slice(-6),
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    message: messages[row.status] ?? '状态处理中。',
  };
}
export interface ApprovalReview {
  verificationMethod: (typeof verifiedVerificationMethods)[number];
  observedAt: string;
  independentVerification: boolean;
  note?: string;
  publicMediaIds?: string[];
}
export function approveSubmission(
  db: SqliteDatabase,
  id: string,
  decision: 'approved' | 'needs_verification' | 'rejected' | 'duplicate',
  actor = 'admin',
  note?: string,
  review?: ApprovalReview,
) {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(id) as
      | { payload_json: string; status: string }
      | undefined;
    if (!row) throw new Error('SUBMISSION_NOT_FOUND');
    if (
      decision === 'approved' &&
      !['pending', 'needs_verification'].includes(row.status)
    )
      throw new Error('SUBMISSION_NOT_PENDING');
    const payload = JSON.parse(row.payload_json) as SubmissionPayload;
    if (decision === 'approved') {
      if (
        !review?.independentVerification ||
        !review.verificationMethod ||
        !verifiedVerificationMethods.includes(review.verificationMethod) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(review.observedAt)
      )
        throw new Error('INDEPENDENT_REVIEW_REQUIRED');
      const now = new Date().toISOString();
      let priceReportId: string | undefined;
      if (payload.type === 'new_place') {
        if (payload.priceFen > 2500) throw new Error('PUBLIC_PRICE_LIMIT');
        const zone = db
          .prepare('SELECT id FROM pilot_zones WHERE id=? AND active=1')
          .get(payload.zoneId);
        if (!zone) throw new Error('ZONE_NOT_FOUND');
        if (
          duplicateCandidates(db, {
            name: payload.placeName,
            address: payload.address,
            lng: payload.lng,
            lat: payload.lat,
          }).length
        )
          throw new Error('DUPLICATE_CANDIDATE');
        const placeId = new PlaceRepository(db).create(
          {
            zoneId: payload.zoneId,
            name: payload.placeName,
            address: payload.address,
            lng: payload.lng,
            lat: payload.lat,
            category: payload.placeCategory,
            accessType: payload.accessType ?? 'public',
            accessNote: payload.accessNote,
            openingHoursNote: undefined,
            tags: [],
          } as never,
          actor,
        );
        const menuId = addMenuItem(
          db,
          {
            placeId,
            name: payload.menuItemName,
            category: payload.menuCategory ?? '待分类',
            description: '',
          },
          actor,
        );
        priceReportId = replacePrice(
          db,
          {
            menuItemId: menuId,
            priceFen: payload.priceFen,
            observedAt: review.observedAt,
            verificationMethod: review.verificationMethod,
            note: review.note,
          },
          actor,
        );
        db.prepare('UPDATE submissions SET target_place_id=? WHERE id=?').run(
          placeId,
          id,
        );
      } else if (payload.type === 'new_price') {
        const place = db
          .prepare(
            "SELECT id FROM places WHERE id=? AND record_status='active' AND business_status IN ('open','unknown')",
          )
          .get(payload.placeId);
        if (!place) throw new Error('PLACE_NOT_FOUND');
        let menuId = payload.menuItemId;
        if (menuId) {
          const exists = db
            .prepare(
              'SELECT 1 FROM menu_items WHERE id=? AND place_id=? AND active=1',
            )
            .get(menuId, payload.placeId);
          if (!exists) throw new Error('MENU_NOT_FOUND');
        }
        if (!menuId && payload.newMenuItemName)
          menuId = addMenuItem(
            db,
            {
              placeId: payload.placeId,
              name: payload.newMenuItemName,
              category: '待分类',
            },
            actor,
          );
        if (!menuId) throw new Error('MENU_REQUIRED');
        priceReportId = replacePrice(
          db,
          {
            menuItemId: menuId,
            priceFen: payload.priceFen,
            observedAt: review.observedAt,
            verificationMethod: review.verificationMethod,
            note: review.note,
          },
          actor,
        );
      } else if (payload.type === 'correction') {
        const place = db
          .prepare(
            "SELECT id FROM places WHERE id=? AND record_status='active'",
          )
          .get(payload.placeId);
        if (!place) throw new Error('PLACE_NOT_FOUND');
        const map: Record<string, string> = {
          place_name: 'name',
          address: 'address',
          access_type: 'access_type',
          access_note: 'access_note',
          opening_hours_note: 'opening_hours_note',
        };
        if (payload.field === 'menu_item_name') {
          if (!payload.menuItemId) throw new Error('MENU_REQUIRED');
          const meal = db
            .prepare('SELECT 1 FROM menu_items WHERE id=? AND place_id=?')
            .get(payload.menuItemId, payload.placeId);
          if (!meal) throw new Error('MENU_NOT_FOUND');
          db.prepare(
            'UPDATE menu_items SET name=?,normalized_name=?,updated_at=? WHERE id=?',
          ).run(
            payload.proposedValue,
            normalize(payload.proposedValue),
            now,
            payload.menuItemId,
          );
        } else {
          const column = map[payload.field];
          if (!column) throw new Error('CORRECTION_FIELD_FORBIDDEN');
          db.prepare(
            `UPDATE places SET ${column}=?,${payload.field === 'place_name' ? 'normalized_name=?,' : ''}updated_at=? WHERE id=?`,
          ).run(
            ...(payload.field === 'place_name'
              ? [
                  payload.proposedValue,
                  normalize(payload.proposedValue),
                  now,
                  payload.placeId,
                ]
              : [payload.proposedValue, now, payload.placeId]),
          );
        }
      } else if (payload.type === 'closure') {
        const target = db
          .prepare(
            "SELECT id FROM places WHERE id=? AND record_status='active'",
          )
          .get(payload.placeId);
        if (!target) throw new Error('PLACE_NOT_FOUND');
        const changed = db
          .prepare(
            "UPDATE places SET business_status=?,updated_at=? WHERE id=? AND record_status='active'",
          )
          .run(
            payload.closureType === 'closed' ? 'closed' : 'temporarily_closed',
            now,
            payload.placeId,
          );
        if (changed.changes !== 1) throw new Error('PLACE_NOT_FOUND');
      }
      if (review.publicMediaIds?.length) {
        if (!priceReportId) throw new Error('MEDIA_PUBLIC_REVIEW_REQUIRED');
        for (const mediaId of review.publicMediaIds) {
          const media = db
            .prepare(
              "SELECT id FROM evidence_media WHERE id=? AND submission_id=? AND rights_confirmed_at IS NOT NULL AND redaction_status IN ('completed','not_needed')",
            )
            .get(mediaId, id);
          if (!media) throw new Error('MEDIA_PUBLIC_REVIEW_REQUIRED');
          if (priceReportId)
            db.prepare(
              "UPDATE evidence_media SET visibility='public',price_report_id=? WHERE id=?",
            ).run(priceReportId, mediaId);
        }
      }
    }
    db.prepare(
      'UPDATE submissions SET status=?,review_note=?,reviewed_at=? WHERE id=?',
    ).run(decision, note || review?.note || null, new Date().toISOString(), id);
    recordAudit(db, actor, 'submission', id, decision, undefined, {
      note,
      review: review
        ? {
            verificationMethod: review.verificationMethod,
            observedAt: review.observedAt,
            independentVerification: review.independentVerification,
          }
        : undefined,
    });
    return decision;
  })();
}

function placeKey(row: CsvRow) {
  return `${normalize(row.zone_name)}|${normalize(row.place_name)}|${normalize(row.address)}`;
}
export interface CsvPreviewOptions {
  /** Candidate conversion reuses a source URL already stored in source_leads. */
  allowExistingSourceLeadUrls?: boolean;
  /** Candidate conversion may append a meal to its already matched place. */
  allowExistingPlaceIds?: string[];
}
export function previewCsv(
  db: SqliteDatabase,
  rows: Array<Record<string, unknown>>,
  options: CsvPreviewOptions = {},
) {
  const errors: Array<{ row: number; field?: string; message: string }> = [];
  const parsed: CsvRow[] = [];
  const seenLinks = new Map<string, string>();
  const placeCoordinates = new Map<
    string,
    { lng: number; lat: number; row: number }
  >();

  rows.forEach((raw, index) => {
    const result = csvRowSchema.safeParse(raw);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        errors.push({
          row: index + 2,
          field: String(issue.path[0] ?? ''),
          message: issue.message,
        }),
      );
      return;
    }

    const row = result.data;
    const key = placeKey(row);
    if (
      db
        .prepare('SELECT 1 FROM pilot_zones WHERE name=? AND active=1')
        .get(row.zone_name) === undefined
    )
      errors.push({
        row: index + 2,
        field: 'zone_name',
        message: '片区不存在或未启用',
      });
    if (row.lng < 113.6 || row.lng > 114.7 || row.lat < 22.4 || row.lat > 22.9)
      errors.push({
        row: index + 2,
        field: 'lng/lat',
        message: '坐标超出深圳可配置范围',
      });

    const coordinates = placeCoordinates.get(key);
    if (
      coordinates &&
      (coordinates.lng !== row.lng || coordinates.lat !== row.lat)
    ) {
      errors.push({
        row: index + 2,
        field: 'lng/lat',
        message: `同一地点与第 ${coordinates.row} 行坐标不一致`,
      });
    } else if (!coordinates) {
      placeCoordinates.set(key, { lng: row.lng, lat: row.lat, row: index + 2 });
    }

    if (row.source_lead_url) {
      const seenForPlace = seenLinks.get(row.source_lead_url);
      const existingSourceLead = db
        .prepare('SELECT 1 FROM source_leads WHERE source_url=?')
        .get(row.source_lead_url);
      if (
        (seenForPlace && seenForPlace !== key) ||
        (existingSourceLead && !options.allowExistingSourceLeadUrls)
      ) {
        errors.push({
          row: index + 2,
          field: 'source_lead_url',
          message: '来源链接已被其他地点使用',
        });
      } else {
        seenLinks.set(row.source_lead_url, key);
      }
    }
    if (row.evidence_filename)
      errors.push({
        row: index + 2,
        field: 'evidence_filename',
        message: '阶段 1 不接收证据文件；请先移除文件名（图片导入属于阶段 3）',
      });
    const duplicatePlaces = duplicateCandidates(db, {
      name: row.place_name,
      address: row.address,
      lng: row.lng,
      lat: row.lat,
    }).filter(
      (candidate) => !options.allowExistingPlaceIds?.includes(candidate.id),
    );
    if (duplicatePlaces.length)
      errors.push({
        row: index + 2,
        field: 'place_name',
        message: '发现疑似重复地点，请先处理',
      });
    parsed.push(row);
  });
  return { valid: errors.length === 0, errors, rows: parsed };
}
function commitCsvTransaction(
  db: SqliteDatabase,
  rows: CsvRow[],
  actor: string,
) {
  return db.transaction(() => {
    const repo = new PlaceRepository(db);
    const created: string[] = [];
    const placeIds = new Map<string, string>();
    const sourceLeadIds = new Map<string, string>();
    const sourceLeadPlaceIds = new Map<string, string>();
    const sourceItemIds = new Map<string, Map<string, string>>();
    for (const row of rows) {
      const existingZone = db
        .prepare('SELECT id FROM pilot_zones WHERE name=? AND active=1')
        .get(row.zone_name) as { id: string } | undefined;
      if (!existingZone) throw new Error(`ZONE_NOT_FOUND:${row.zone_name}`);
      const key = placeKey(row);
      let placeId = placeIds.get(key);
      if (!placeId) {
        placeId = repo.create(
          {
            zoneId: existingZone.id,
            name: row.place_name,
            address: row.address,
            lng: row.lng,
            lat: row.lat,
            category: row.place_category,
            accessType: row.access_type,
            accessNote: undefined,
            openingHoursNote: undefined,
            tags: [],
          } as never,
          actor,
        );
        placeIds.set(key, placeId);
        created.push(placeId);
      }
      const mealId = addMenuItem(
        db,
        { placeId, name: row.menu_item_name, category: row.menu_category },
        actor,
      );
      let sourceItemId: string | undefined;
      let sourceLeadId = row.source_lead_url
        ? sourceLeadIds.get(row.source_lead_url)
        : undefined;
      if (row.source_lead_url && !sourceLeadId) {
        sourceLeadId = newId('lead');
        db.prepare(
          'INSERT INTO source_leads(id,source_platform,source_url,clue_place_name,clue_item_name,clue_price_fen,summary,status,matched_place_id,discovery_method,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        ).run(
          sourceLeadId,
          'web',
          row.source_lead_url,
          row.place_name,
          row.menu_item_name,
          Math.round(row.price_yuan * 100),
          row.admin_note,
          row.verification_method === 'external_lead' ? 'new' : 'converted',
          placeId,
          row.verification_method === 'external_lead' ? 'external_lead' : 'web',
          new Date().toISOString(),
          new Date().toISOString(),
        );
        sourceLeadIds.set(row.source_lead_url, sourceLeadId);
      }
      if (sourceLeadId && row.source_lead_url) {
        sourceLeadPlaceIds.set(row.source_lead_url, placeId);
        let itemsForLead = sourceItemIds.get(sourceLeadId);
        if (!itemsForLead) {
          itemsForLead = new Map<string, string>();
          sourceItemIds.set(sourceLeadId, itemsForLead);
        }
        const itemKey = normalize(row.menu_item_name);
        sourceItemId = itemsForLead.get(itemKey);
        if (!sourceItemId) {
          const existingItems = db
            .prepare(
              'SELECT id,clue_item_name FROM source_lead_items WHERE source_lead_id=? ORDER BY created_at,id',
            )
            .all(sourceLeadId) as Array<{ id: string; clue_item_name: string }>;
          sourceItemId = existingItems.find(
            (item) => normalize(item.clue_item_name) === itemKey,
          )?.id;
        }
        if (!sourceItemId) {
          sourceItemId = newId('lead-item');
          db.prepare(
            'INSERT INTO source_lead_items(id,source_lead_id,clue_item_name,clue_price_fen,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
          ).run(
            sourceItemId,
            sourceLeadId,
            row.menu_item_name,
            Math.round(row.price_yuan * 100),
            row.verification_method === 'external_lead' ? 'new' : 'converted',
            new Date().toISOString(),
            new Date().toISOString(),
          );
        }
        itemsForLead.set(itemKey, sourceItemId);
      }
      replacePrice(
        db,
        {
          menuItemId: mealId,
          priceFen: Math.round(row.price_yuan * 100),
          observedAt: row.observed_date,
          verificationMethod: row.verification_method,
          status: row.verification_method === 'external_lead' ? 'pending' : 'verified',
          note: row.admin_note,
          sourceLeadId,
        },
        actor,
      );
      if (sourceItemId && row.verification_method !== 'external_lead')
        db.prepare(
          "UPDATE source_lead_items SET status='converted',matched_menu_item_id=?,matched_place_id=?,updated_at=? WHERE id=?",
        ).run(mealId, placeId, new Date().toISOString(), sourceItemId);
    }
    for (const [sourceUrl, sourceLeadId] of sourceLeadIds) {
      const remaining = Number(
        (
          db
            .prepare(
              "SELECT count(*) count FROM source_lead_items WHERE source_lead_id=? AND status NOT IN ('converted','rejected','duplicate')",
            )
            .get(sourceLeadId) as { count: number }
        ).count,
      );
      const converted = Number(
        (
          db
            .prepare(
              "SELECT count(*) count FROM source_lead_items WHERE source_lead_id=? AND status='converted'",
            )
            .get(sourceLeadId) as { count: number }
        ).count,
      );
      db.prepare(
        'UPDATE source_leads SET status=?,matched_place_id=?,updated_at=? WHERE id=?',
      ).run(
        remaining === 0 ? 'converted' : converted > 0 ? 'verifying' : 'new',
        sourceLeadPlaceIds.get(sourceUrl) ?? null,
        new Date().toISOString(),
        sourceLeadId,
      );
    }
    return created;
  })();
}
export function commitCsv(db: SqliteDatabase, rows: CsvRow[], actor = 'admin') {
  const checked = previewCsv(db, rows);
  if (!checked.valid) throw new Error('IMPORT_INVALID');
  return commitCsvTransaction(db, checked.rows, actor);
}
