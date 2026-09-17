import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { createBackup } from '@/scripts/backup';
import { migrateDatabase, openDatabase } from '@/lib/server/db';
import { replacePrice } from '@/lib/server/repository';
import { restoreBackup } from '@/scripts/restore';

const roots: string[] = [];
const migrationFiles = [
  '001_initial.sql',
  '002_price_source_lead.sql',
  '003_admin_action_indexes.sql',
  '004_price_source_lead_integrity.sql',
  '005_submission_tokens_limits.sql',
  '006_candidate_pool.sql',
  '007_candidate_pool_reconcile.sql',
  '008_regions.sql',
  '009_creator_sources.sql',
  '010_place_city.sql',
];

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function rawSchemaDb(file: string, version: number, matchedColumn = false, omitSix = false) {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  for (const migration of migrationFiles.slice(0, version)) {
    const migrationVersion = Number(migration.slice(0, 3));
    if (!(omitSix && migrationVersion === 6))
      db.exec(fs.readFileSync(path.join('db/migrations', migration), 'utf8'));
    db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES (?,?)').run(
      migrationVersion,
      new Date().toISOString(),
    );
  }
  if (matchedColumn)
    db.exec(
      'ALTER TABLE source_lead_items ADD COLUMN matched_place_id TEXT REFERENCES places(id) ON DELETE RESTRICT',
    );
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();
}

function schemaObjects(db: Database.Database) {
  const columns = db.pragma('table_info(source_lead_items)') as Array<{
    name: string;
  }>;
  const foreignKeys = db.pragma('foreign_key_list(source_lead_items)') as Array<{
    table: string;
    from: string;
    to: string;
  }>;
  const trigger = db
    .prepare(
      "SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name='source_leads_referenced_delete'",
    )
    .get() as { name: string; sql: string } | undefined;
  return {
    version: Number(
      (
        db.prepare('SELECT max(version) version FROM schema_migrations').get() as {
          version: number;
        }
      ).version,
    ),
    matchedColumn: columns.some((column) => column.name === 'matched_place_id'),
    matchedForeignKey: foreignKeys.some(
      (foreignKey) =>
        foreignKey.table === 'places' &&
        foreignKey.from === 'matched_place_id' &&
        foreignKey.to === 'id',
    ),
    trigger,
  };
}

function sha(file: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function archiveDb(root: string, dbFile: string, schemaVersion: number) {
  const stage = fs.mkdtempSync(path.join(root, 'archive-stage-'));
  fs.copyFileSync(dbFile, path.join(stage, 'budget-map.sqlite'));
  fs.mkdirSync(path.join(stage, 'uploads'), { recursive: true });
  const manifest = {
    schemaVersion,
    files: { 'budget-map.sqlite': sha(path.join(stage, 'budget-map.sqlite')) },
  };
  fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest));
  const archive = path.join(root, `schema-${schemaVersion}.zip`);
  execFileSync('zip', ['-qr', archive, '.'], { cwd: stage });
  return archive;
}

function makeTarget(root: string) {
  const file = path.join(root, 'target.sqlite');
  const db = openDatabase(file);
  db.prepare(
    "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('target-marker','目标保留','student',113.9,22.5,1)",
  ).run();
  db.close();
  return file;
}

describe('database migration reconciliation', () => {
  it('fresh databases reach schema 10 with the matched column and delete trigger', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-fresh-'));
    roots.push(root);
    const db = openDatabase(path.join(root, 'fresh.sqlite'));
    const objects = schemaObjects(db);
    expect(objects.version).toBe(10);
    expect(objects.matchedColumn).toBe(true);
    expect(objects.matchedForeignKey).toBe(true);
    expect(objects.trigger?.name).toBe('source_leads_referenced_delete');
    db.close();
  });

  it('fresh schema 10 adds region catalog, creator-source and city columns', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-creator-'));
    roots.push(root);
    const db = openDatabase(path.join(root, 'creator.sqlite'));
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'regions',
        'creators',
        'creator_accounts',
        'entity_sources',
      ]),
    );
    const leadColumns = (
      db.pragma('table_info(source_leads)') as Array<{ name: string }>
    ).map((column) => column.name);
    expect(leadColumns).toEqual(
      expect.arrayContaining([
        'creator_id',
        'platform',
        'content_title',
        'content_url',
        'published_at',
        'city',
        'play_count',
        'public_visibility',
      ]),
    );
    const zoneColumns = (
      db.pragma('table_info(pilot_zones)') as Array<{ name: string }>
    ).map((column) => column.name);
    expect(zoneColumns).toContain('city');
    const placeColumns = (
      db.pragma('table_info(places)') as Array<{ name: string }>
    ).map((column) => column.name);
    expect(placeColumns).toContain('city');
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('creator-zone','创作者片区','student',113.9,22.5,1)",
    ).run();
    db.prepare(
      'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run('creator-place', 'creator-zone', '创作者店', '创作者店', '创作者地址', 113.9, 22.5, '快餐', 'public', now, now);
    db.prepare(
      'INSERT INTO menu_items(id,place_id,name,normalized_name,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run('creator-menu', 'creator-place', '创作者餐食', '创作者餐食', '米饭', now, now);
    // A creator clue (external_lead) can never become a verified price.
    expect(() =>
      db
        .prepare(
          'INSERT INTO price_reports(id,menu_item_id,price_fen,observed_at,verification_method,status,created_at) VALUES (?,?,?,?,?,?,?)',
        )
        .run('creator-price', 'creator-menu', 1200, '2026-09-01', 'external_lead', 'verified', now),
    ).toThrow();
    // One entity + platform + creator is recorded once (idempotent source dedupe).
    const insertSource = db.prepare(
      'INSERT INTO entity_sources(entity_type,entity_id,platform,creator_name,content_url,observed_at,created_at) VALUES (?,?,?,?,?,?,?)',
    );
    insertSource.run('place', 'creator-place', 'bilibili', '某UP主', 'https://example.com/v', '2026-09-01', now);
    expect(() =>
      insertSource.run('place', 'creator-place', 'bilibili', '某UP主', 'https://example.com/v2', '2026-09-02', now),
    ).toThrow();
    db.close();
  });

  it('schema-6 databases with or without matched_place_id both reconcile to the same schema', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-schema6-'));
    roots.push(root);
    const missing = path.join(root, 'missing.sqlite');
    const existing = path.join(root, 'existing.sqlite');
    rawSchemaDb(missing, 6);
    rawSchemaDb(existing, 6, true);
    const missingDb = openDatabase(missing);
    const existingDb = openDatabase(existing);
    expect(schemaObjects(missingDb)).toMatchObject({
      version: 10,
      matchedColumn: true,
      matchedForeignKey: true,
    });
    expect(schemaObjects(existingDb)).toMatchObject({
      version: 10,
      matchedColumn: true,
      matchedForeignKey: true,
    });
    missingDb.close();
    existingDb.close();
  });

  it('opening schema 10 again is idempotent and preserves key schema objects', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-repeat-'));
    roots.push(root);
    const file = path.join(root, 'repeat.sqlite');
    const first = openDatabase(file);
    const before = schemaObjects(first);
    first.close();
    const second = openDatabase(file);
    const after = schemaObjects(second);
    expect(after).toEqual(before);
    second.close();
  });

  it('schema-10 delete trigger blocks removing a lead referenced by a price', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-trigger-'));
    roots.push(root);
    const db = openDatabase(path.join(root, 'trigger.sqlite'));
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat,active) VALUES ('trigger-zone','触发器片区','student',113.9,22.5,1)",
    ).run();
    db.prepare(
      'INSERT INTO places(id,zone_id,name,normalized_name,address,lng,lat,category,access_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run('trigger-place', 'trigger-zone', '触发器店', '触发器店', '触发器地址', 113.9, 22.5, '餐馆', 'public', now, now);
    db.prepare(
      'INSERT INTO menu_items(id,place_id,name,normalized_name,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run('trigger-menu', 'trigger-place', '触发器餐食', '触发器餐食', '米饭', now, now);
    db.prepare(
      'INSERT INTO source_leads(id,source_platform,source_url,clue_place_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run('trigger-lead', 'web', 'https://example.com/trigger', '触发器店', 'new', now, now);
    replacePrice(db, {
      menuItemId: 'trigger-menu',
      priceFen: 1800,
      observedAt: '2026-09-01',
      verificationMethod: 'onsite_menu',
      status: 'pending',
      sourceLeadId: 'trigger-lead',
    });
    expect(() => db.prepare('DELETE FROM source_leads WHERE id=?').run('trigger-lead')).toThrow();
    db.close();
  });

  it('restores a schema-4 archive by migrating staging to schema 10', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-schema4-'));
    roots.push(root);
    const legacy = path.join(root, 'legacy.sqlite');
    rawSchemaDb(legacy, 4);
    const archive = archiveDb(root, legacy, 4);
    const target = makeTarget(root);
    await restoreBackup(archive, 'RESTORE-BUDGET-MAP', {
      databaseFile: target,
      uploadsDir: path.join(root, 'target-uploads'),
      backupCurrent: async () => undefined,
    });
    const restored = new Database(target);
    expect(schemaObjects(restored)).toMatchObject({
      version: 10,
      matchedColumn: true,
      matchedForeignKey: true,
    });
    restored.close();
  });

  it('schema-10 backup round-trip keeps the reconciled schema objects', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-schema9-'));
    roots.push(root);
    const source = openDatabase();
    expect(schemaObjects(source)).toMatchObject({ version: 10, matchedColumn: true });
    const archive = await createBackup(path.join(root, 'backups'));
    const target = makeTarget(root);
    await restoreBackup(archive, 'RESTORE-BUDGET-MAP', {
      databaseFile: target,
      uploadsDir: path.join(root, 'target-uploads'),
      backupCurrent: async () => undefined,
    });
    const restored = new Database(target);
    expect(schemaObjects(restored)).toMatchObject({
      version: 10,
      matchedColumn: true,
      matchedForeignKey: true,
    });
    expect(restored.prepare("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='source_leads_referenced_delete'").get()).toBeTruthy();
    restored.close();
  });

  it('does not replace the target when staging migration fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-migration-failure-'));
    roots.push(root);
    const malformed = path.join(root, 'malformed.sqlite');
    rawSchemaDb(malformed, 6, false, true);
    const archive = archiveDb(root, malformed, 6);
    const target = makeTarget(root);
    const before = fs.readFileSync(target);
    await expect(
      restoreBackup(archive, 'RESTORE-BUDGET-MAP', {
        databaseFile: target,
        uploadsDir: path.join(root, 'target-uploads'),
        backupCurrent: async () => undefined,
      }),
    ).rejects.toThrow();
    expect(fs.readFileSync(target)).toEqual(before);
    const targetDb = new Database(target);
    expect(targetDb.prepare("SELECT 1 FROM pilot_zones WHERE id='target-marker'").get()).toBeTruthy();
    targetDb.close();
  });
});
