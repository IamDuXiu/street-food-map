import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../lib/server/db';
import { seedDemo } from '../lib/server/seed';
import { seedNationalDemo } from '../lib/server/seed-national';
import { seedRegions } from './seed-regions';
import { hashPassword, verifyPassword } from '../lib/server/auth';
import { formatPreflight, runPreflight } from '../lib/server/preflight';
import { loadLocalEnv } from './load-env';
import { randomBytes } from 'node:crypto';

// 与 Next.js 一致地读取 .env / .env.local（已存在的进程环境变量优先）。
loadLocalEnv();
const envPath = path.resolve('.env.local');
let localEnv = '';
try {
  localEnv = fs.readFileSync(envPath, 'utf8');
} catch {}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  const generatedSecret = randomBytes(32).toString('base64url');
  process.env.SESSION_SECRET = generatedSecret;
  const lines = localEnv ? localEnv.split(/\r?\n/) : [];
  const index = lines.findIndex((line) => /^SESSION_SECRET=/.test(line));
  if (index >= 0) lines[index] = `SESSION_SECRET=${generatedSecret}`;
  else if (index < 0) lines.push(`SESSION_SECRET=${generatedSecret}`);
  fs.writeFileSync(envPath, `${lines.filter((line, i) => i !== lines.length - 1 || line).join('\n').replace(/\n*$/, '\n')}`);
}
fs.mkdirSync(path.resolve(process.env.DATA_DIR ?? 'data'), { recursive: true });
fs.mkdirSync(path.resolve(process.env.UPLOADS_DIR ?? 'uploads'), { recursive: true });
fs.mkdirSync(path.resolve(process.env.BACKUPS_DIR ?? 'backups'), { recursive: true });
const db = openDatabase();
seedDemo(db);
seedNationalDemo(db);
seedRegions(db);
const currentSetting = db.prepare('SELECT password_hash FROM admin_settings WHERE id=1').get() as { password_hash: string } | undefined;
const configuredHash = process.env.ADMIN_PASSWORD_HASH || (process.env.ADMIN_PASSWORD ? (currentSetting && verifyPassword(process.env.ADMIN_PASSWORD, currentSetting.password_hash) ? currentSetting.password_hash : hashPassword(process.env.ADMIN_PASSWORD)) : '');
if (configuredHash) db.prepare('INSERT INTO admin_settings(id,password_hash,password_version,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,password_version=CASE WHEN admin_settings.password_hash=excluded.password_hash THEN admin_settings.password_version ELSE admin_settings.password_version+1 END,updated_at=excluded.updated_at').run(configuredHash, 1, new Date().toISOString());
console.log('Demo environment ready: SQLite migrated and demo seed is idempotent.');
console.log(configuredHash ? 'Admin password configured from local environment.' : 'Admin password not configured; run npm run admin:password and set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD before login.');
console.log('DemoMapAdapter is active; no account or map key is needed.');
console.log('');
// 部署前凭据自查：说明哪些第三方凭据需要你自己的账号、缺了会怎样。只报告不阻塞。
console.log(formatPreflight(runPreflight()));
console.log('');
console.log('提示：正式部署前先跑 `npm run preflight`（严格模式，缺必需项会失败）。');
