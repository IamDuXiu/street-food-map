import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('密码').fill('phase1-demo-password');
  await page.getByRole('button', { name: '进入后台工作台' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('投稿蜜罐不可见且服务端拒绝填充蜜罐的请求', async ({ page }) => {
  await page.goto('/submit');
  await page.waitForLoadState('networkidle');
  const honeypot = page.locator('input[name="website"]');
  await expect(honeypot).toHaveAttribute('hidden', '');
  expect(await honeypot.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (element as HTMLInputElement).hidden && style.opacity === '0' && style.pointerEvents === 'none' && rect.right < 0 && rect.width <= 2;
  })).toBe(true);
  await expect(honeypot).toHaveAttribute('aria-hidden', 'true');
  await expect(honeypot).toHaveAttribute('tabindex', '-1');

  const response = await page.request.post('/api/v1/submissions', {
    data: { website: 'automated-bot' },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.code).toBe('REQUEST_REJECTED');
});

test('后台登录失败使用错误 tone 并保持可重试', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('密码').fill('明显不正确的密码');
  await page.getByRole('button', { name: '进入后台工作台' }).click();
  const error = page.getByRole('alert').filter({ hasText: '账号或密码不正确' });
  await expect(error).toBeVisible();
  await expect(error).toHaveClass(/ui-notice-error/);
  await expect(page.getByRole('button', { name: '进入后台工作台' })).toBeEnabled();
});

test('区域选择器打开后聚焦搜索框，Escape 关闭并恢复触发按钮焦点', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /选择区域/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '选一个吃饭范围' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('搜索行政区或商圈')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole('navigation', { name: '深圳市行政区' }).getByRole('button', { name: /南山区/ }).click();
  await expect(dialog.getByText('南山区 / 商圈')).toBeVisible();
  await page.getByLabel('搜索行政区或商圈').fill('科技园');
  await expect(dialog.getByRole('button', { name: /科技园.*已有饭签/ })).toBeVisible();
});

test('归档确认取消与 Escape 不发送请求并恢复原焦点', async ({ page }) => {
  await login(page);
  await page.goto('/admin/places');
  const action = page.locator('.place-admin-row').first().getByRole('button', { name: '归档' });
  const requests: string[] = [];
  await page.route('**/api/v1/admin/places/*', async (route) => {
    if (route.request().method() === 'PATCH') requests.push(route.request().method());
    await route.continue();
  });
  await action.click();
  const dialog = page.getByRole('dialog', { name: '归档这个地点？' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(action).toBeFocused();
  expect(requests).toHaveLength(0);

  await action.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).toBeHidden();
  expect(requests).toHaveLength(0);
});

test('归档失败后确认弹窗保持可重试，成功后才关闭', async ({ page }) => {
  await login(page);
  await page.goto('/admin/places');
  const action = page.locator('.place-admin-row').first().getByRole('button', { name: '归档' });
  let calls = 0;
  await page.route('**/api/v1/admin/places/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    calls += 1;
    if (calls === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: '模拟失败' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  await action.click();
  const dialog = page.getByRole('dialog', { name: '归档这个地点？' });
  await dialog.getByRole('button', { name: '确认归档' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '归档失败' })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '确认归档' })).toBeEnabled();

  await dialog.getByRole('button', { name: '确认归档' }).click();
  await expect(page.getByRole('status').filter({ hasText: '地点已归档' })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(calls).toBe(2);
});

test('后台手机端可到达退出操作并回到登录页', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const logout = page.getByRole('button', { name: /退出后台/ }).last();
  await expect(logout).toBeVisible();
  await logout.click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
