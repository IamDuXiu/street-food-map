import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatPreflight, runPreflight } from '@/lib/server/preflight';

const TOUCHED = [
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_USERNAME',
  'NEXT_PUBLIC_MAP_MODE',
  'NEXT_PUBLIC_TENCENT_MAP_KEY',
  'TENCENT_MAP_WEB_SERVICE_KEY',
  'TENCENT_MAP_KEY',
  'MINIMAX_API_KEY',
  'BILIBILI_COOKIE',
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of TOUCHED) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of TOUCHED) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const check = () =>
  runPreflight({ skipDataDirCheck: true, dataDir: '/tmp/unused' });
const find = (report: ReturnType<typeof runPreflight>, key: string) =>
  report.items.find((item) => item.keys.includes(key))!;

describe('deployment credential preflight', () => {
  it('passes with a demo map, no keys, and an admin password', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40);
    process.env.ADMIN_PASSWORD = 'a-long-enough-password';
    const report = check();
    expect(report.ok).toBe(true);
    expect(report.errors).toBe(0);
    expect(find(report, 'NEXT_PUBLIC_MAP_MODE').level).toBe('ok');
    expect(find(report, 'NEXT_PUBLIC_MAP_MODE').detail).toContain('纸上地图');
    // 选填项缺失只是 optional，不会污染告警数
    expect(find(report, 'TENCENT_MAP_WEB_SERVICE_KEY').level).toBe('optional');
    expect(find(report, 'MINIMAX_API_KEY').level).toBe('optional');
    expect(report.warnings).toBe(0);
  });

  it('fails when the tencent basemap is selected without an own key', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40);
    process.env.ADMIN_PASSWORD = 'a-long-enough-password';
    process.env.NEXT_PUBLIC_MAP_MODE = 'tencent';
    const report = check();
    expect(report.ok).toBe(false);
    const item = find(report, 'NEXT_PUBLIC_TENCENT_MAP_KEY');
    expect(item.level).toBe('error');
    expect(item.detail).toContain('回退');
    expect(item.hint).toContain('重新 build');
  });

  it('accepts the tencent basemap when the key is present', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40);
    process.env.ADMIN_PASSWORD = 'a-long-enough-password';
    process.env.NEXT_PUBLIC_MAP_MODE = 'tencent';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'own-tencent-key';
    const report = check();
    expect(report.ok).toBe(true);
    expect(find(report, 'NEXT_PUBLIC_TENCENT_MAP_KEY').level).toBe('ok');
  });

  it('warns when a browser key is configured but the mode is not tencent', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40);
    process.env.ADMIN_PASSWORD = 'a-long-enough-password';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'orphan-key';
    const report = check();
    expect(report.ok).toBe(true);
    const item = find(report, 'NEXT_PUBLIC_TENCENT_MAP_KEY');
    expect(item.level).toBe('warning');
    expect(item.detail).toContain('不是 tencent');
  });

  it('warns that the admin backend is unusable without a password', () => {
    process.env.SESSION_SECRET = 'x'.repeat(40);
    const report = check();
    const item = find(report, 'ADMIN_PASSWORD');
    expect(item.level).toBe('warning');
    expect(item.detail).toContain('无法登录');
    expect(report.ok).toBe(true);
  });

  it('rejects a too-short session secret and blank env values', () => {
    process.env.SESSION_SECRET = 'too-short';
    process.env.ADMIN_PASSWORD = '   ';
    const report = check();
    expect(report.ok).toBe(false);
    expect(find(report, 'SESSION_SECRET').level).toBe('error');
    // 只有空白字符视为未配置
    expect(find(report, 'ADMIN_PASSWORD').level).toBe('warning');
  });

  it('reports an unwritable data directory as an error', () => {
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-')),
      'not-a-dir',
    );
    fs.writeFileSync(file, 'x');
    const report = runPreflight({ dataDir: path.join(file, 'data') });
    expect(report.ok).toBe(false);
    expect(find(report, 'DATA_DIR').level).toBe('error');
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  it('never echoes credential values', () => {
    process.env.SESSION_SECRET = 'super-secret-session-value-0123456789';
    process.env.ADMIN_PASSWORD = 'super-secret-admin-password';
    process.env.NEXT_PUBLIC_TENCENT_MAP_KEY = 'super-secret-map-key';
    process.env.TENCENT_MAP_WEB_SERVICE_KEY = 'super-secret-web-service';
    process.env.MINIMAX_API_KEY = 'super-secret-llm-key';
    const text = formatPreflight(check());
    for (const secret of [
      'super-secret-session-value-0123456789',
      'super-secret-admin-password',
      'super-secret-map-key',
      'super-secret-web-service',
      'super-secret-llm-key',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('已配置');
  });
});
