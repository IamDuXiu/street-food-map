import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLocalEnv } from '@/scripts/load-env';

const KEYS = ['SFM_TEST_A', 'SFM_TEST_B', 'SFM_TEST_C', 'SFM_TEST_QUOTED'];
let dir: string;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-env-'));
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('script env file loading', () => {
  it('reads .env and lets .env.local win, like Next.js does', () => {
    fs.writeFileSync(path.join(dir, '.env'), 'SFM_TEST_A=from-env\nSFM_TEST_B=only-env\n');
    fs.writeFileSync(path.join(dir, '.env.local'), 'SFM_TEST_A=from-local\n');
    const loaded = loadLocalEnv(dir);
    expect(loaded).toEqual(['.env', '.env.local']);
    expect(process.env.SFM_TEST_A).toBe('from-local');
    expect(process.env.SFM_TEST_B).toBe('only-env');
  });

  it('never overrides an exported process variable', () => {
    process.env.SFM_TEST_C = 'exported';
    fs.writeFileSync(path.join(dir, '.env'), 'SFM_TEST_C=from-file\n');
    loadLocalEnv(dir);
    expect(process.env.SFM_TEST_C).toBe('exported');
  });

  it('ignores comments, blank lines and export prefixes, and strips quotes', () => {
    fs.writeFileSync(
      path.join(dir, '.env'),
      ['# comment', '', 'export SFM_TEST_QUOTED="quoted value"', '   ', 'not a kv line'].join('\n'),
    );
    const loaded = loadLocalEnv(dir);
    expect(loaded).toEqual(['.env']);
    expect(process.env.SFM_TEST_QUOTED).toBe('quoted value');
  });

  it('is a no-op when no env files exist', () => {
    expect(loadLocalEnv(dir)).toEqual([]);
    expect(process.env.SFM_TEST_A).toBeUndefined();
  });
});
