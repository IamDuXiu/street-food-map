import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { closeDatabase, databasePath, migrateDatabase } from '../lib/server/db';
import { createBackup } from './backup';

const CONFIRM = 'RESTORE-BUDGET-MAP';
const CURRENT_SCHEMA = 7;
const SUPPORTED_BACKUP_SCHEMAS = [4, 5, 6, 7] as const;
type RestoreOptions = {
  databaseFile?: string;
  uploadsDir?: string;
  backupCurrent?: () => Promise<unknown>;
  simulateReplaceFailure?: boolean;
};

function safeEntry(entry: string) {
  return (
    entry.length > 0 &&
    !path.isAbsolute(entry) &&
    !entry.split(/[\\/]/).includes('..') &&
    !entry.includes('\0')
  );
}
async function validateStage(stage: string) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(stage, 'manifest.json'), 'utf8'),
  ) as { schemaVersion: number; files: Record<string, string> };
  const manifestVersion = Number(manifest.schemaVersion);
  // Schema 4 backups predate anonymous-submission tokens; they remain restorable
  // and are upgraded in the staging database before any production replacement.
  if (
    !SUPPORTED_BACKUP_SCHEMAS.includes(
      manifestVersion as (typeof SUPPORTED_BACKUP_SCHEMAS)[number],
    ) ||
    !manifest.files['budget-map.sqlite']
  )
    throw new Error('备份 schema 不兼容');
  const actualFiles = await listFiles(stage);
  const listedFiles = Object.keys(manifest.files);
  if (listedFiles.some((file) => !safeEntry(file)))
    throw new Error('备份包含不安全路径');
  if (
    actualFiles.some(
      (file) => file !== 'manifest.json' && !manifest.files[file],
    )
  )
    throw new Error('备份包含未列入 manifest 的文件');
  if (listedFiles.some((file) => !actualFiles.includes(file)))
    throw new Error('manifest 缺少备份文件');
  for (const [file, expected] of Object.entries(manifest.files)) {
    const actual = crypto
      .createHash('sha256')
      .update(await fs.readFile(path.join(stage, file)))
      .digest('hex');
    if (actual !== expected) throw new Error(`校验失败：${file}`);
  }
  const db = new Database(path.join(stage, 'budget-map.sqlite'), {
    fileMustExist: true,
  });
  try {
    db.pragma('foreign_keys = ON');
    const archivedVersion = Number(
      (
        db
          .prepare('SELECT max(version) version FROM schema_migrations')
          .get() as { version: number | null }
      ).version,
    );
    if (archivedVersion !== manifestVersion)
      throw new Error('备份 schema 与归档数据库版本不一致');

    migrateDatabase(db);
    const migratedVersion = Number(
      (
        db
          .prepare('SELECT max(version) version FROM schema_migrations')
          .get() as { version: number | null }
      ).version,
    );
    if (migratedVersion !== CURRENT_SCHEMA)
      throw new Error('备份迁移未达到当前 schema');
    const candidateColumns = db.pragma(
      'table_info(source_lead_items)',
    ) as Array<{ name: string }>;
    if (!candidateColumns.some((column) => column.name === 'matched_place_id'))
      throw new Error('候选表缺少 matched_place_id');
    const candidateForeignKeys = db.pragma(
      'foreign_key_list(source_lead_items)',
    ) as Array<{ table: string; from: string; to: string }>;
    if (
      !candidateForeignKeys.some(
        (foreignKey) =>
          foreignKey.table === 'places' &&
          foreignKey.from === 'matched_place_id' &&
          foreignKey.to === 'id',
      )
    )
      throw new Error('候选表 matched_place_id 外键缺失');
    const trigger = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='source_leads_referenced_delete'",
      )
      .get();
    if (!trigger) throw new Error('source_leads_referenced_delete 触发器缺失');
    if ((db.pragma('integrity_check', { simple: true }) as string) !== 'ok')
      throw new Error('SQLite integrity_check 失败');
    if ((db.pragma('foreign_key_check') as unknown[]).length)
      throw new Error('SQLite foreign_key_check 失败');
    const media = db
      .prepare('SELECT storage_path FROM evidence_media')
      .all() as Array<{ storage_path: string }>;
    for (const item of media) {
      if (
        !safeEntry(item.storage_path) ||
        !(await fileExists(path.join(stage, 'uploads', item.storage_path)))
      )
        throw new Error(`媒体文件缺失：${item.storage_path}`);
    }
    db.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    db.close();
  }
}
async function fileExists(file: string) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error('备份不允许符号链接');
    if (entry.isDirectory()) files.push(...(await listFiles(root, relative)));
    else files.push(relative);
  }
  return files;
}

export async function restoreBackup(
  archive: string,
  confirmation: string,
  options: RestoreOptions = {},
) {
  if (confirmation !== CONFIRM)
    throw new Error(`缺少确认词 ${CONFIRM}，当前数据未改变`);
  const stage = await fs.mkdtemp(path.join('/tmp', 'budget-map-restore-'));
  const targetDb = path.resolve(options.databaseFile ?? databasePath);
  const targetUploads = path.resolve(
    options.uploadsDir ?? process.env.UPLOADS_DIR ?? 'uploads',
  );
  let rollbackDir = '';
  try {
    const entries = execFileSync('unzip', ['-Z1', archive], {
      encoding: 'utf8',
    })
      .split(/\r?\n/)
      .filter(Boolean);
    if (entries.some((entry) => !safeEntry(entry)))
      throw new Error('备份包含不安全路径');
    execFileSync('unzip', ['-q', archive, '-d', stage]);
    await validateStage(stage);
    if (options.backupCurrent) await options.backupCurrent();
    else await createBackup();
    closeDatabase();
    rollbackDir = await fs.mkdtemp(path.join('/tmp', 'budget-map-rollback-'));
    const oldDb = path.join(rollbackDir, 'budget-map.sqlite');
    const oldDbWal = path.join(rollbackDir, 'budget-map.sqlite-wal');
    const oldDbShm = path.join(rollbackDir, 'budget-map.sqlite-shm');
    const oldUploads = path.join(rollbackDir, 'uploads');
    const moved = {
      db: false,
      wal: false,
      shm: false,
      uploads: false,
      newDb: false,
      newUploads: false,
    };
    try {
      if (await fileExists(targetDb)) {
        await fs.rename(targetDb, oldDb);
        moved.db = true;
      }
      if (await fileExists(`${targetDb}-wal`)) {
        await fs.rename(`${targetDb}-wal`, oldDbWal);
        moved.wal = true;
      }
      if (await fileExists(`${targetDb}-shm`)) {
        await fs.rename(`${targetDb}-shm`, oldDbShm);
        moved.shm = true;
      }
      if (await fileExists(targetUploads)) {
        await fs.rename(targetUploads, oldUploads);
        moved.uploads = true;
      }
      await fs.rename(path.join(stage, 'budget-map.sqlite'), targetDb);
      moved.newDb = true;
      if (options.simulateReplaceFailure)
        throw new Error('SIMULATED_RESTORE_REPLACE_FAILURE');
      await fs.rename(path.join(stage, 'uploads'), targetUploads);
      moved.newUploads = true;
    } catch (error) {
      if (moved.newDb && (await fileExists(targetDb)))
        await fs.rm(targetDb, { force: true });
      if (moved.newUploads && (await fileExists(targetUploads)))
        await fs.rm(targetUploads, { recursive: true, force: true });
      if (moved.uploads && (await fileExists(oldUploads)))
        await fs.rename(oldUploads, targetUploads);
      if (moved.shm && (await fileExists(oldDbShm)))
        await fs.rename(oldDbShm, `${targetDb}-shm`);
      if (moved.wal && (await fileExists(oldDbWal)))
        await fs.rename(oldDbWal, `${targetDb}-wal`);
      if (moved.db && (await fileExists(oldDb)))
        await fs.rename(oldDb, targetDb);
      throw error;
    }
    await fs.rm(rollbackDir, { recursive: true, force: true });
    rollbackDir = '';
    return targetDb;
  } finally {
    if (rollbackDir) await fs.rm(rollbackDir, { recursive: true, force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
}

async function main() {
  const fromIndex = process.argv.indexOf('--from');
  const confirmIndex = process.argv.indexOf('--confirm');
  const archive = fromIndex >= 0 ? process.argv[fromIndex + 1] : '';
  const confirmation = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : '';
  if (!archive)
    throw new Error(
      `用法：npm run restore -- --from <备份.zip> --confirm ${CONFIRM}`,
    );
  console.log('只读校验通过。输入确认词后才会覆盖当前数据库。');
  await restoreBackup(archive, confirmation);
  console.log(`恢复完成：${databasePath}`);
}
if (process.argv[1]?.endsWith('restore.ts'))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
