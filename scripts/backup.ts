import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openDatabase, databasePath, dataDir } from '../lib/server/db';

export async function createBackup(
  outputDir = path.resolve(
    /* turbopackIgnore: true */ process.env.BACKUPS_DIR ?? 'backups',
  ),
) {
  const db = openDatabase();
  await fs.mkdir(outputDir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const archive = path.join(outputDir, `budget-map-backup-${stamp}.zip`);
  const stage = await fs.mkdtemp(path.join('/tmp', 'budget-map-backup-'));
  const snapshot = path.join(stage, 'budget-map.sqlite');
  db.pragma('wal_checkpoint(TRUNCATE)');
  await db.backup(snapshot);
  const tables = [
    'pilot_zones',
    'places',
    'menu_items',
    'price_reports',
    'tags',
    'place_tags',
    'source_leads',
    'source_lead_items',
    'lead_conversion_drafts',
    'submissions',
    'evidence_media',
    'moderation_actions',
    'analytics_events',
    'rate_limit_buckets',
  ];
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    await fs.writeFile(
      path.join(stage, `${table}.json`),
      JSON.stringify(rows, null, 2),
    );
  }
  const uploads = path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOADS_DIR ?? 'uploads',
  );
  try {
    await fs.cp(uploads, path.join(stage, 'uploads'), { recursive: true });
  } catch {
    await fs.mkdir(path.join(stage, 'uploads'), { recursive: true });
  }
  const files = await listFiles(stage);
  const manifest = {
    schemaVersion: Number(
      (
        db.prepare('SELECT max(version) v FROM schema_migrations').get() as {
          v: number;
        }
      ).v,
    ),
    appVersion: '0.1.0',
    generatedAt: new Date().toISOString(),
    files: Object.fromEntries(
      await Promise.all(
        files
          .filter((file) => file !== 'manifest.json')
          .map(async (file) => [file, await sha256(path.join(stage, file))]),
      ),
    ),
  };
  await fs.writeFile(
    path.join(stage, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  execFileSync('zip', ['-qr', archive, '.'], { cwd: stage });
  await fs.rm(stage, { recursive: true, force: true });
  return archive;
}
async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, relative)));
    else files.push(relative);
  }
  return files;
}
async function sha256(file: string) {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}
if (process.argv[1]?.endsWith('backup.ts'))
  createBackup().then((file) => console.log(file));
