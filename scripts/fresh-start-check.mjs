import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Node's tsx loader (rather than the tsx CLI) avoids an IPC socket in restricted sandboxes.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'street-food-sign-fresh-'));
const dataDir = path.join(root, 'data');
const uploadsDir = path.join(root, 'uploads');
const backupsDir = path.join(root, 'backups');
process.env.DATA_DIR = dataDir;
process.env.DATABASE_PATH = path.join(dataDir, 'budget-map.sqlite');
process.env.UPLOADS_DIR = uploadsDir;
process.env.BACKUPS_DIR = backupsDir;
process.env.SESSION_SECRET = randomBytes(32).toString('base64url');
process.env.ADMIN_PASSWORD = 'fresh-start-check-password';

let closeDatabase;
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(backupsDir, { recursive: true });
  const dbModule = await import('../lib/server/db.ts');
  closeDatabase = dbModule.closeDatabase;
  await import('./setup-demo.ts');
  const { PlaceRepository } = await import('../lib/server/repository.ts');
  const { createBackup } = await import('./backup.ts');
  const db = dbModule.openDatabase();
  const migration = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  const publicPlaces = new PlaceRepository(db).listPublic({ maxPriceFen: 2500 });
  if (migration.version < 5 || publicPlaces.length === 0) throw new Error('fresh environment checks failed');
  const archive = await createBackup(backupsDir);
  if (!fs.existsSync(archive)) throw new Error('backup check failed');
  console.log(`Fresh environment OK: setup, schema ${migration.version}, ${publicPlaces.length} public places, isolated backup created.`);
} finally {
  closeDatabase?.();
  fs.rmSync(root, { recursive: true, force: true });
}
