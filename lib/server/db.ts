import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

const projectRoot = process.cwd();
export const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR ?? path.join(projectRoot, 'data'));
export const databasePath = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH ?? path.join(dataDir, 'budget-map.sqlite'));

let cached: SqliteDatabase | null = null;

function migrationFiles() {
  const directory = path.join(projectRoot, 'db', 'migrations');
  return fs.readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
}

function reconcileCandidatePoolSchema(db: SqliteDatabase) {
  const columns = db.pragma('table_info(source_lead_items)') as Array<{
    name: string;
  }>;
  if (!columns.some((column) => column.name === 'matched_place_id'))
    db.exec(
      'ALTER TABLE source_lead_items ADD COLUMN matched_place_id TEXT REFERENCES places(id) ON DELETE RESTRICT',
    );
}

/** Apply all unapplied migrations, including the schema-6 candidate drift fix. */
export function migrateDatabase(db: SqliteDatabase) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  for (const file of migrationFiles()) {
    const version = Number(file.split('_')[0]);
    const exists = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
    if (!exists) {
      const applyMigration = db.transaction(() => {
        // Version 7 reconciles two schema-6 shapes observed in the field.  Do
        // this check only for v7 and keep it in the same transaction as the
        // migration SQL and ledger write.  Other migration failures must
        // propagate unchanged.
        if (version === 7) reconcileCandidatePoolSchema(db);
        db.exec(fs.readFileSync(path.join(projectRoot, 'db', 'migrations', file), 'utf8'));
        db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
      });
      applyMigration();
    }
  }
}

export function openDatabase(filePath = databasePath): SqliteDatabase {
  if (cached && filePath === databasePath) return cached;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrateDatabase(db);
  if (filePath === databasePath) cached = db;
  return db;
}

export function closeDatabase() { cached?.close(); cached = null; }

export function withDatabase<T>(callback: (db: SqliteDatabase) => T): T { return callback(openDatabase()); }
