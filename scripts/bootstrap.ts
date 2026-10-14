/**
 * 生产 / 容器启动引导（幂等，可重复执行）。
 *
 * 1. 创建数据、上传、备份目录；
 * 2. 打开数据库——openDatabase() 会自动应用所有未执行的迁移；
 * 3. 按 ADMIN_PASSWORD / ADMIN_PASSWORD_HASH 初始化后台管理员密码；
 * 4. 写入区域目录（幂等，始终执行）；
 * 5. SEED_DEMO !== '0' 时写入演示门店（本地体验用；生产请设 SEED_DEMO=0）。
 *
 * Docker 入口脚本在每次启动时调用本文件；本机也可以手动 `npm run bootstrap`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from '../lib/server/auth';
import { openDatabase } from '../lib/server/db';
import { formatPreflight, runPreflight } from '../lib/server/preflight';
import { seedDemo } from '../lib/server/seed';
import { seedRegions } from './seed-regions';
import { loadLocalEnv } from './load-env';

// 容器里环境变量来自 compose；本机 / systemd 直接跑时补读 .env 与 .env.local。
loadLocalEnv();

function envDir(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return path.resolve(value || fallback);
}

const dataDir = envDir('DATA_DIR', 'data');
const uploadsDir = envDir('UPLOADS_DIR', path.join(dataDir, 'uploads'));
const backupsDir = envDir('BACKUPS_DIR', path.join(dataDir, 'backups'));
for (const dir of [dataDir, uploadsDir, backupsDir]) fs.mkdirSync(dir, { recursive: true });

// 凭据自查：只报告不阻塞。第三方凭据（腾讯地图 / 大模型）必须由部署者自己提供，
// 缺了什么、缺了会怎样，都在这里说清楚（`npm run preflight` 是严格版，会 exit 1）。
console.log('');
console.log(formatPreflight(runPreflight({ dataDir })));
console.log('');

// 打开数据库即应用迁移（幂等）。
const db = openDatabase();
console.log(`[bootstrap] 数据库就绪：${process.env.DATABASE_PATH?.trim() || path.join(dataDir, 'budget-map.sqlite')}`);

// 管理员密码：哈希优先，其次明文（只在初始化时使用）。
const providedHash = process.env.ADMIN_PASSWORD_HASH?.trim() || '';
const plainPassword = process.env.ADMIN_PASSWORD?.trim() || '';
const passwordHash = providedHash || (plainPassword ? hashPassword(plainPassword) : '');
if (passwordHash) {
  db.prepare(
    `INSERT INTO admin_settings(id,password_hash,password_version,updated_at) VALUES (1,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       password_hash=excluded.password_hash,
       password_version=CASE WHEN admin_settings.password_hash=excluded.password_hash THEN admin_settings.password_version ELSE admin_settings.password_version+1 END,
       updated_at=excluded.updated_at`,
  ).run(passwordHash, 1, new Date().toISOString());
  console.log('[bootstrap] 管理员密码已按环境变量更新（用户名：' + (process.env.ADMIN_USERNAME?.trim() || 'admin') + '）');
} else {
  const existing = db.prepare('SELECT 1 FROM admin_settings WHERE id=1').get();
  console.log(
    existing
      ? '[bootstrap] 未提供 ADMIN_PASSWORD(_HASH)，沿用库中已有的管理员密码。'
      : '[bootstrap] 未提供 ADMIN_PASSWORD(_HASH)，后台暂时无法登录。请设置后重启，或运行 npm run admin:password。',
  );
}

const regionCount = seedRegions(db);
console.log(`[bootstrap] 区域目录：${regionCount} 条`);

if (process.env.SEED_DEMO === '0') {
  console.log('[bootstrap] SEED_DEMO=0，跳过演示数据。');
} else {
  seedDemo(db);
  console.log('[bootstrap] 演示数据已写入（如需空库启动请设 SEED_DEMO=0）。');
}
