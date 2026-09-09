import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(
  process.env.DATA_DIR ?? '/tmp/shenzhen-budget-map-playwright',
);
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(root, 'backups'), { recursive: true });
