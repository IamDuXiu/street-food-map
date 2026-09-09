import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import type { SqliteDatabase } from './db';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
function uploadsRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? 'uploads',
  );
}
function signature(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
function safeStoragePath(id: string) {
  const relative = path.posix.join('submissions', id, `${randomUUID()}.webp`);
  const absolute = path.resolve(uploadsRoot(), relative);
  if (!absolute.startsWith(`${uploadsRoot()}${path.sep}`))
    throw new Error('PATH_TRAVERSAL');
  return { relative, absolute };
}

async function processImage(file: File) {
  if (file.size > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  const original = Buffer.from(await file.arrayBuffer());
  if (original.length > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  const actualType = signature(original);
  if (
    !actualType ||
    actualType !== file.type ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
  )
    throw new Error('MIME_MISMATCH');
  const safeBuffer = await sharp(original, { failOn: 'error' })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer();
  const metadata = await sharp(safeBuffer).metadata();
  return {
    safeBuffer,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export async function saveSubmissionMedia(
  db: SqliteDatabase,
  submissionId: string,
  token: string,
  file: File,
  rightsConfirmed: boolean,
) {
  if (!token || token.length < 32) throw new Error('UPLOAD_TOKEN_INVALID');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const row = db
    .prepare(
      "SELECT upload_token_hash,upload_token_expires_at,rights_confirmed_at FROM submissions WHERE id=? AND status IN ('pending','needs_verification')",
    )
    .get(submissionId) as
    | {
        upload_token_hash: string | null;
        upload_token_expires_at: string | null;
        rights_confirmed_at: string | null;
      }
    | undefined;
  if (
    !row ||
    !row.upload_token_hash ||
    row.upload_token_hash !== tokenHash ||
    !row.upload_token_expires_at ||
    new Date(row.upload_token_expires_at).getTime() <= Date.now()
  )
    throw new Error('UPLOAD_TOKEN_INVALID');
  if (!rightsConfirmed && !row.rights_confirmed_at)
    throw new Error('RIGHTS_CONFIRMATION_REQUIRED');
  const count = Number(
    (
      db
        .prepare(
          'SELECT count(*) count FROM evidence_media WHERE submission_id=?',
        )
        .get(submissionId) as { count: number }
    ).count,
  );
  if (count >= MAX_FILES) throw new Error('MEDIA_LIMIT_REACHED');
  const { safeBuffer, width, height } = await processImage(file);
  const pathInfo = safeStoragePath(submissionId);
  await fs.mkdir(path.dirname(pathInfo.absolute), { recursive: true });
  try {
    await fs.writeFile(pathInfo.absolute, safeBuffer, {
      flag: 'wx',
      mode: 0o600,
    });
    const mediaId = `media-${randomUUID()}`;
    const now = new Date().toISOString();
    db.transaction(() => {
      if (rightsConfirmed && !row.rights_confirmed_at)
        db.prepare(
          'UPDATE submissions SET rights_confirmed_at=? WHERE id=?',
        ).run(now, submissionId);
      db.prepare(
        'INSERT INTO evidence_media(id,submission_id,storage_path,mime_type,width,height,ownership,visibility,rights_confirmed_at,redaction_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        mediaId,
        submissionId,
        pathInfo.relative,
        'image/webp',
        width,
        height,
        'user_submitted',
        'admin_only',
        rightsConfirmed ? now : row.rights_confirmed_at,
        'pending',
        now,
      );
    })();
    return { id: mediaId, width, height };
  } catch (error) {
    await fs.rm(pathInfo.absolute, { force: true });
    throw error;
  }
}

/** Admin-uploaded redacted replacement. It is deliberately private until a separate review marks it public. */
export async function saveAdminReplacement(
  db: SqliteDatabase,
  originalMediaId: string,
  file: File,
  rightsConfirmed: boolean,
) {
  if (!rightsConfirmed) throw new Error('RIGHTS_CONFIRMATION_REQUIRED');
  const original = db
    .prepare('SELECT submission_id FROM evidence_media WHERE id=?')
    .get(originalMediaId) as { submission_id: string | null } | undefined;
  if (!original?.submission_id) throw new Error('MEDIA_NOT_FOUND');
  const count = Number(
    (
      db
        .prepare(
          'SELECT count(*) count FROM evidence_media WHERE submission_id=?',
        )
        .get(original.submission_id) as { count: number }
    ).count,
  );
  if (count >= MAX_FILES) throw new Error('MEDIA_LIMIT_REACHED');
  const { safeBuffer, width, height } = await processImage(file);
  const pathInfo = safeStoragePath(original.submission_id);
  await fs.mkdir(path.dirname(pathInfo.absolute), { recursive: true });
  try {
    await fs.writeFile(pathInfo.absolute, safeBuffer, {
      flag: 'wx',
      mode: 0o600,
    });
    const id = `media-${randomUUID()}`;
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(
        "UPDATE evidence_media SET visibility='admin_only' WHERE id=?",
      ).run(originalMediaId);
      db.prepare(
        'INSERT INTO evidence_media(id,submission_id,replaces_media_id,storage_path,mime_type,width,height,ownership,visibility,rights_confirmed_at,redaction_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      ).run(
        id,
        original.submission_id,
        originalMediaId,
        pathInfo.relative,
        'image/webp',
        width,
        height,
        'self_shot',
        'admin_only',
        now,
        'pending',
        now,
      );
    })();
    return { id, width, height };
  } catch (error) {
    await fs.rm(pathInfo.absolute, { force: true });
    throw error;
  }
}

export async function readPublicMedia(db: SqliteDatabase, mediaId: string) {
  const row = db
    .prepare(
      "SELECT em.storage_path,em.mime_type FROM evidence_media em JOIN price_reports pr ON pr.id=em.price_report_id JOIN menu_items mi ON mi.id=pr.menu_item_id JOIN places p ON p.id=mi.place_id WHERE em.id=? AND em.visibility='public' AND em.rights_confirmed_at IS NOT NULL AND em.redaction_status IN ('not_needed','completed') AND pr.status='verified' AND pr.verification_method <> 'external_lead' AND pr.price_fen<=2500 AND date(pr.observed_at)>=date('now','-180 day') AND p.record_status='active' AND p.business_status IN ('open','unknown')",
    )
    .get(mediaId) as { storage_path: string; mime_type: string } | undefined;
  if (!row) throw new Error('NOT_FOUND');
  const root = uploadsRoot();
  const absolute = path.resolve(root, row.storage_path);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('NOT_FOUND');
  return {
    body: await fs.readFile(/* turbopackIgnore: true */ absolute),
    mimeType: row.mime_type,
  };
}

export async function readAdminMedia(db: SqliteDatabase, mediaId: string) {
  const row = db
    .prepare('SELECT storage_path,mime_type FROM evidence_media WHERE id=?')
    .get(mediaId) as { storage_path: string; mime_type: string } | undefined;
  if (!row) throw new Error('NOT_FOUND');
  const root = uploadsRoot();
  const absolute = path.resolve(root, row.storage_path);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error('NOT_FOUND');
  return {
    body: await fs.readFile(/* turbopackIgnore: true */ absolute),
    mimeType: row.mime_type,
  };
}
