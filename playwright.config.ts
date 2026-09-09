import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    launchOptions: { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'tsx scripts/setup-e2e.ts && npm run setup && npm run build && npm run start -- --hostname 127.0.0.1 --port 3100',
    env: { DEMO_AUTH: '1', DEMO_ADMIN_PASSWORD: 'phase1-demo-password', ADMIN_PASSWORD: 'phase1-demo-password', SESSION_SECRET: 'playwright-session-secret-012345678901234567890', DATABASE_PATH: '/tmp/shenzhen-budget-map-playwright/budget-map.sqlite', DATA_DIR: '/tmp/shenzhen-budget-map-playwright', UPLOADS_DIR: '/tmp/shenzhen-budget-map-playwright/uploads', BACKUPS_DIR: '/tmp/shenzhen-budget-map-playwright/backups', NEXT_PUBLIC_MAP_MODE: 'demo' },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: false } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } }
  ]
});
