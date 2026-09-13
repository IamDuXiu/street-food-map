import { expect, test } from '@playwright/test';

async function seedCandidate(page: import('@playwright/test').Page, suffix: string) {
  const sourceUrl = `https://example.com/candidate-ui-${suffix}`;
  const records = [
    {
      candidate_id: `UI-${suffix}-1`,
      store_name: `候选池测试店 ${suffix}`,
      meal_name: '现场套餐',
      displayed_price_yuan: 18,
      source_url: sourceUrl,
      address_or_area: '南山区学府路 100 号',
      suggested_import_zone: '深大粤海',
      evidence_summary: '候选池端到端测试线索',
    },
    {
      candidate_id: `UI-${suffix}-2`,
      store_name: `候选池测试店 ${suffix}`,
      meal_name: '现场粉面',
      displayed_price_yuan: 20,
      source_url: sourceUrl,
      address_or_area: '南山区学府路 100 号',
      suggested_import_zone: '深大粤海',
      evidence_summary: '候选池端到端测试线索',
    },
  ];
  const result = await page.evaluate(async (payload) => {
    const csrf = await fetch('/api/v1/admin/csrf').then((response) => response.json());
    const response = await fetch('/api/v1/admin/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify(payload),
    });
    return { ok: response.ok, body: await response.json() };
  }, records);
  expect(result.ok).toBe(true);
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('密码').fill('phase1-demo-password');
  await page.getByRole('button', { name: /进入后台工作台/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('候选池支持按店勾选、必填拦截、demo 落点并生成带版本的预览', async ({ page }) => {
  const suffix = `${Date.now()}`;
  await login(page);
  await seedCandidate(page, suffix);
  await page.goto('/admin/leads');
  await page.waitForSelector('.candidate-workspace');

  const row = page.locator('.candidate-store-row').filter({ hasText: `候选池测试店 ${suffix}` });
  await expect(row).toHaveCount(1);
  await row.locator('input[aria-label*="全部餐食"]').check();
  await row.locator('.candidate-meal-row input').first().uncheck();
  await expect(page.getByText('已准备 1 家 / 1 份餐食')).toBeVisible();

  await page.getByRole('button', { name: '进入导入预览' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '还有必填信息未完成' })).toBeVisible();

  await page.getByLabel('完整地址').fill(`深圳市南山区学府路 100 号现场门店 ${suffix}`);
  await page.getByRole('combobox', { name: '启用片区' }).click();
  await page.locator('.ui-select-menu:not([hidden]) [role="option"][data-value="深大粤海"]').click();
  await page.getByRole('combobox', { name: '准入类型' }).click();
  await page.locator('.ui-select-menu:not([hidden]) [role="option"][data-value="public"]').click();
  await page.getByLabel('餐食类别：现场粉面').fill('粉面');
  await page.getByLabel('核验日期').fill('2026-09-05');
  await page.getByRole('combobox', { name: '核验方式' }).click();
  await page.locator('.ui-select-menu:not([hidden]) [role="option"][data-value="onsite_menu"]').click();
  await page.getByLabel('示意地图，点击确认店铺位置').click({ position: { x: 120, y: 120 } });
  await expect(page.getByText(/坐标系固定为 GCJ-02/)).toBeVisible();
  await page.getByLabel('仍在营业且门头一致').check();
  await page.getByLabel('常规正价，非优惠摊薄').check();
  await page.getByLabel('确实可作为一人一餐').check();
  await page.getByRole('button', { name: '进入导入预览' }).click();
  await expect(page).toHaveURL(/\/admin\/import\?draft=/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '候选导入预览' })).toBeVisible();
  await expect(page.getByText('预览版本', { exact: false })).toBeVisible();
  await expect(page.getByText('检查通过', { exact: true })).toBeVisible();

  const draftParam = new URL(page.url()).searchParams.get('draft');
  expect(draftParam).toBeTruthy();
  await page.getByRole('button', { name: /确认提交候选/ }).click();
  await expect(page.getByRole('status').filter({ hasText: /已提交 1 份餐食，新增 1 家地点/ })).toBeVisible();
  await page.goto('/admin/leads');
  await page.waitForSelector('.candidate-workspace');
  await expect(page.locator(`[role="option"][data-value="${draftParam}"]`)).toHaveCount(0);
});

test('候选池草稿刷新可恢复且手机无横向溢出', async ({ page }) => {
  const suffix = `${Date.now()}`;
  await login(page);
  await seedCandidate(page, suffix);
  await page.goto('/admin/leads');
  await page.waitForSelector('.candidate-workspace');
  const row = page.locator('.candidate-store-row').filter({ hasText: `候选池测试店 ${suffix}` });
  await row.locator('.candidate-meal-row input').first().check();
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByRole('status').filter({ hasText: '草稿已保存' })).toBeVisible();
  await page.reload();
  await page.waitForSelector('.candidate-workspace');
  await expect(page.getByText('已准备 1 家 / 1 份餐食')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.waitForSelector('.candidate-workspace');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.coordinate-map')).toHaveCount(1);
});
