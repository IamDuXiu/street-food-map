import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shenzhen-budget-map-vitest-'));
process.env.DATABASE_PATH = path.join(root, 'budget-map.sqlite');
process.env.DATA_DIR = root;
process.env.UPLOADS_DIR = path.join(root, 'uploads');
process.env.BACKUPS_DIR = path.join(root, 'backups');
process.env.SESSION_SECRET = 'vitest-isolation-secret-012345678901234567890';
const { closeDatabase } = await import('@/lib/server/db');
afterAll(() => { closeDatabase(); fs.rmSync(root, { recursive: true, force: true }); });
