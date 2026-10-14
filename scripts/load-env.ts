/**
 * 让 `tsx scripts/*.ts` 也读项目根目录的 `.env` / `.env.local`。
 *
 * 为什么需要：Next.js 自己会加载 `.env*`，但用 tsx 直接跑的脚本（采集、部署自查、
 * 引导、初始化）不会。结果是「把 MINIMAX_API_KEY 写进 .env.local 后 npm run
 * collect:web 却说没有 Key」——配置文件看起来没生效。
 *
 * 与 Next.js 的优先级保持一致：
 *   - 已存在的进程环境变量优先（导出的值不会被文件覆盖）；
 *   - `.env.local` 覆盖 `.env`。
 * 只做最小解析（`KEY=value`，支持引号、忽略注释与空行），不引入依赖。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 项目根目录（本文件位于 <root>/scripts/）。用脚本位置推导，避免依赖当前工作目录。 */
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    out[match[1]] = value;
  }
  return out;
}

/** 幂等：重复调用不会覆盖已经生效的值。 */
export function loadLocalEnv(cwd = PROJECT_ROOT): string[] {
  const loaded: string[] = [];
  // 先读 .env，再让 .env.local 在文件之间覆盖（与 Next.js 的优先级一致）。
  const merged: Record<string, string> = {};
  for (const file of ['.env', '.env.local']) {
    const full = path.join(cwd, file);
    if (fs.existsSync(full)) loaded.push(file);
    Object.assign(merged, parseEnvFile(full));
  }
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return loaded;
}
