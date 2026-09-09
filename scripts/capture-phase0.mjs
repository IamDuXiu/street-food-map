import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('artifacts/phase-0', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
await mobile.goto('http://127.0.0.1:3000/');
await mobile.screenshot({ path: 'artifacts/phase-0/home-375.png', fullPage: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto('http://127.0.0.1:3000/places/kexing-b1-foodcourt');
await desktop.screenshot({ path: 'artifacts/phase-0/detail-1440.png', fullPage: true });
await desktop.goto('http://127.0.0.1:3000/admin');
await desktop.screenshot({ path: 'artifacts/phase-0/admin-1440.png', fullPage: true });
await browser.close();
console.log('Saved phase 0 screenshots.');
