import fs from 'node:fs/promises';
import path from 'node:path';
import { openDatabase, type SqliteDatabase } from '../lib/server/db';

export async function runMaintenance(now = new Date(), simulateFailure = false, injectedDb?: SqliteDatabase, injectedUploads?: string) {
  const db = injectedDb ?? openDatabase();
  const cutoff90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const cutoff30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const rejected = db.prepare("SELECT id FROM submissions WHERE status='rejected' AND created_at < ? AND payload_json NOT LIKE '%payload_cleared%'").all(cutoff90) as Array<{ id: string }>;
  const media = db.prepare("SELECT id,storage_path FROM evidence_media WHERE submission_id IN (SELECT id FROM submissions WHERE status='rejected' AND created_at < ?) AND price_report_id IS NULL").all(cutoff90) as Array<{ id: string; storage_path: string }>;
  const trash = await fs.mkdtemp(path.join('/tmp', 'budget-map-maintenance-'));
  const moved: Array<{ from: string; to: string }> = [];
  try {
    for (const item of media) {
      const from = path.resolve(injectedUploads ?? process.env.UPLOADS_DIR ?? 'uploads', item.storage_path);
      const to = path.join(trash, item.id);
      try { await fs.rename(from, to); moved.push({ from, to }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    if (simulateFailure) throw new Error('SIMULATED_FILE_FAILURE');
    db.transaction(() => {
      for (const item of media) db.prepare('DELETE FROM evidence_media WHERE id=?').run(item.id);
      for (const item of rejected) {
        const row = db.prepare('SELECT payload_json FROM submissions WHERE id=?').get(item.id) as { payload_json: string };
        const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
        db.prepare('UPDATE submissions SET payload_json=? WHERE id=?').run(JSON.stringify({ ...payload, payload_cleared: true }), item.id);
      }
      db.prepare('DELETE FROM analytics_events WHERE created_at < ?').run(cutoff30);
    })();
    await fs.rm(trash, { recursive: true, force: true });
    return { rejected: rejected.length, media: media.length };
  } catch (error) {
    for (const item of moved.reverse()) { await fs.mkdir(path.dirname(item.from), { recursive: true }); await fs.rename(item.to, item.from).catch(() => undefined); }
    await fs.rm(trash, { recursive: true, force: true }); throw error;
  }
}

if (process.argv[1]?.endsWith('maintenance.ts')) runMaintenance().then((result) => console.log(result));
