import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('data', { recursive: true });
await mkdir('artifacts/phase-0', { recursive: true });
await writeFile('data/.gitkeep', '');
console.log('Demo environment ready: DemoMapAdapter is active; no account or map key is needed.');
