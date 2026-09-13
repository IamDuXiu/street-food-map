import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openDatabase } from '@/lib/server/db';
import { restoreBackup } from '@/scripts/restore';

const roots: string[] = [];
function sha(file: string) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('restore backup integrity', () => {
  it('成功恢复 SQLite 与 uploads，替换失败时两者均回滚', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-map-restore-test-')); roots.push(root); const currentDb = path.join(root, 'current.sqlite'); const currentUploads = path.join(root, 'uploads');
    const db = openDatabase(currentDb); db.prepare("INSERT INTO pilot_zones(id,name,audience,center_lng,center_lat) VALUES ('restore-zone','恢复测试','student',113.9,22.5)").run(); db.close(); fs.mkdirSync(path.join(currentUploads, 'proof'), { recursive: true }); fs.writeFileSync(path.join(currentUploads, 'proof', 'old.txt'), 'old');
    const stage = fs.mkdtempSync(path.join(root, 'archive-stage-')); fs.copyFileSync(currentDb, path.join(stage, 'budget-map.sqlite')); fs.mkdirSync(path.join(stage, 'uploads', 'proof'), { recursive: true }); fs.writeFileSync(path.join(stage, 'uploads', 'proof', 'new.txt'), 'new');
    const files = ['budget-map.sqlite', 'uploads/proof/new.txt']; const manifest = { schemaVersion: 9, files: Object.fromEntries(files.map((file) => [file, sha(path.join(stage, file))])) }; fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest)); const archive = path.join(root, 'restore.zip'); execFileSync('zip', ['-qr', archive, '.'], { cwd: stage });
    await restoreBackup(archive, 'RESTORE-BUDGET-MAP', { databaseFile: currentDb, uploadsDir: currentUploads, backupCurrent: async () => undefined }); expect(fs.readFileSync(path.join(currentUploads, 'proof', 'new.txt'), 'utf8')).toBe('new'); expect(fs.existsSync(path.join(currentUploads, 'proof', 'old.txt'))).toBe(false);
    const beforeDb = sha(currentDb); await expect(restoreBackup(archive, 'RESTORE-BUDGET-MAP', { databaseFile: currentDb, uploadsDir: currentUploads, backupCurrent: async () => undefined, simulateReplaceFailure: true })).rejects.toThrow('SIMULATED_RESTORE_REPLACE_FAILURE'); expect(sha(currentDb)).toBe(beforeDb); expect(fs.readFileSync(path.join(currentUploads, 'proof', 'new.txt'), 'utf8')).toBe('new');
    const brokenStage = fs.mkdtempSync(path.join(root, 'broken-stage-')); fs.copyFileSync(currentDb, path.join(brokenStage, 'budget-map.sqlite')); fs.mkdirSync(path.join(brokenStage, 'uploads'), { recursive: true }); fs.writeFileSync(path.join(brokenStage, 'manifest.json'), JSON.stringify({ schemaVersion: 9, files: { 'budget-map.sqlite': 'not-the-real-sha' } })); const brokenArchive = path.join(root, 'broken.zip'); execFileSync('zip', ['-qr', brokenArchive, '.'], { cwd: brokenStage }); await expect(restoreBackup(brokenArchive, 'RESTORE-BUDGET-MAP', { databaseFile: currentDb, uploadsDir: currentUploads, backupCurrent: async () => undefined })).rejects.toThrow('校验失败'); expect(sha(currentDb)).toBe(beforeDb); expect(fs.readFileSync(path.join(currentUploads, 'proof', 'new.txt'), 'utf8')).toBe('new');
    const mediaDb = path.join(root, 'media.sqlite'); const media = openDatabase(mediaDb); media.prepare("INSERT INTO submissions(id,type,payload_json,status,created_at) VALUES ('missing-media-sub','correction','{}','rejected','2025-01-01')").run(); media.prepare("INSERT INTO evidence_media(id,submission_id,storage_path,mime_type,ownership,visibility,redaction_status,created_at) VALUES ('missing-media','missing-media-sub','proof/missing.jpg','image/jpeg','user_submitted','admin_only','pending','2025-01-01')").run(); media.close(); const missingStage = fs.mkdtempSync(path.join(root, 'missing-stage-')); fs.copyFileSync(mediaDb, path.join(missingStage, 'budget-map.sqlite')); fs.mkdirSync(path.join(missingStage, 'uploads'), { recursive: true }); const missingManifest = { schemaVersion: 9, files: { 'budget-map.sqlite': sha(path.join(missingStage, 'budget-map.sqlite')) } }; fs.writeFileSync(path.join(missingStage, 'manifest.json'), JSON.stringify(missingManifest)); const missingArchive = path.join(root, 'missing-media.zip'); execFileSync('zip', ['-qr', missingArchive, '.'], { cwd: missingStage }); await expect(restoreBackup(missingArchive, 'RESTORE-BUDGET-MAP', { databaseFile: currentDb, uploadsDir: currentUploads, backupCurrent: async () => undefined })).rejects.toThrow('媒体文件缺失'); expect(sha(currentDb)).toBe(beforeDb); expect(fs.readFileSync(path.join(currentUploads, 'proof', 'new.txt'), 'utf8')).toBe('new');
  });
});
