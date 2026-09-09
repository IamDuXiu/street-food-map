import { expect, test } from '@playwright/test';

test('用户可以筛选、打开地点详情并导航', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: '示意地图' })).toBeVisible();
  await expect(page.getByText('示意底图', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '搜索和筛选' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /\d+ 个结果/ })).toBeVisible();
  await expect(
    page.locator('.results-panel a.card-link').first(),
  ).toBeVisible();
  const budget25 = page.getByRole('group', { name: '最高价格' }).getByRole('button', { name: '≤ ¥25' });
  await budget25.click();
  await expect(budget25).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /选择区域/ }).click();
  await page.getByRole('navigation', { name: '深圳行政区' }).getByRole('button', { name: /南山区/ }).click();
  await page.getByRole('button', { name: /科技园.*已有饭签/ }).click();
  await expect(
    page
      .locator('.results-panel')
      .getByText('科兴科学园', { exact: false })
      .first(),
  ).toBeVisible();
  await page
    .locator('.results-panel a.card-link')
    .filter({ hasText: '科兴科学园 · B1 员工餐厅' })
    .click();
  await expect(
    page.getByRole('heading', { name: '科兴科学园 · B1 员工餐厅' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /打开地图导航/ }).click();
});

test('地图和列表可互相选择，定位拒绝时仍可浏览', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /选择区域/ }).click();
  await page.getByRole('dialog', { name: '选一个吃饭范围' }).getByRole('button', { name: /我的附近/ }).click();
  await expect(
    page.getByText(/拒绝了定位|定位暂时不可用|不能定位/),
  ).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  const firstPin = page.getByRole('region', { name: '示意地图' }).getByRole('button', { name: /^选择/ }).first();
  await firstPin.click();
  await expect(page.locator('article.place-card.place-card-selected')).toBeVisible();
  await expect(
    page.locator('.results-panel a.card-link').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: /选择区域/ }).click();
  await page.getByRole('navigation', { name: '深圳行政区' }).getByRole('button', { name: /南山区/ }).click();
  await page.getByRole('button', { name: /科技园.*已有饭签/ }).click();
  await expect(
    page
      .locator('.results-panel')
      .getByText('科兴科学园', { exact: false })
      .first(),
  ).toBeVisible();
});

test('用户端筛选状态在详情返回后可恢复', async ({ page }) => {
  await page.goto('/');
  const budget25 = page.getByRole('group', { name: '最高价格' }).getByRole('button', { name: '≤ ¥25' });
  const tag = page.getByRole('combobox', { name: '按条件或标签筛选' });
  const sort = page.getByRole('combobox', { name: '结果排序' });
  const search = page.getByRole('textbox', { name: '搜店名或餐食' });

  await budget25.click();
  await tag.selectOption('有肉有菜');
  await sort.selectOption('freshness');
  await search.fill('科兴');
  const card = page.locator('.results-panel a.card-link').filter({ hasText: '科兴科学园 · B1 员工餐厅' });
  await expect(card).toBeVisible();
  await expect(sort).toHaveValue('freshness');

  await card.click();
  await expect(page.getByRole('heading', { name: '科兴科学园 · B1 员工餐厅' })).toBeVisible();
  await page.getByRole('link', { name: '← 回到地图' }).click();
  await expect(page).toHaveURL(/\/$/);

  await expect(search).toHaveValue('科兴');
  await expect(budget25).toHaveAttribute('aria-pressed', 'true');
  await expect(tag).toHaveValue('有肉有菜');
  await expect(sort).toHaveValue('freshness');
  await expect(card).toBeVisible();
});

test('用户端手机结果面板三态、点位联动且无横向溢出', async ({ page }) => {
  for (const [width, height] of [[375, 667], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('region', { name: '示意地图' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const panel = page.locator('[aria-live="polite"]').first();
    const peek = page.getByRole('button', { name: '收起', exact: true });
    const half = page.getByRole('button', { name: '半屏', exact: true });
    const full = page.getByRole('button', { name: '列表', exact: true });
    const firstPin = page.getByRole('region', { name: '示意地图' }).getByRole('button', { name: /^选择/ }).first();
    await firstPin.click();
    const selectedCard = page.getByRole('link', { name: /查看.+详情/ });
    await expect(selectedCard).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(peek).toHaveAttribute('aria-pressed', 'true');
    const peekHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);

    await half.click();
    await expect(half).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => panel.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(peekHeight);
    const halfHeight = await panel.evaluate((element) => element.getBoundingClientRect().height);

    await full.click();
    await expect(full).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => panel.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(halfHeight);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const selectedBox = await selectedCard.boundingBox();
    expect(selectedBox).not.toBeNull();
    expect(selectedBox!.y + selectedBox!.height).toBeLessThanOrEqual(height);
  }
});

test('定位成功后仍可按价格或最近核验排序', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 22.53, longitude: 113.94 });
  await page.goto('/');
  await page.getByRole('button', { name: /选择区域/ }).click();
  await page.getByRole('dialog', { name: '选一个吃饭范围' }).getByRole('button', { name: /我的附近/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '已显示你附近' })).toBeVisible({ timeout: 10_000 });

  const sort = page.getByRole('combobox', { name: '结果排序' });
  const priceResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/api/v1/map')) return false;
    return new URL(response.url()).searchParams.get('sort') === 'price';
  });
  await sort.selectOption('price');
  await priceResponse;
  await expect(sort).toHaveValue('price');
  const prices = await page.locator('.place-card .place-card-price').allTextContents();
  const numericPrices = prices.map((value) => Number(value.replace('¥', '')));
  expect(numericPrices.length).toBeGreaterThan(1);
  expect(numericPrices).toEqual([...numericPrices].sort((a, b) => a - b));

  const freshnessResponse = page.waitForResponse((response) => {
    if (!response.url().includes('/api/v1/map')) return false;
    return new URL(response.url()).searchParams.get('sort') === 'freshness';
  });
  await sort.selectOption('freshness');
  await freshnessResponse;
  await expect(sort).toHaveValue('freshness');
  expect((await page.locator('.place-card').all()).length).toBeGreaterThan(1);
});

test('匿名投稿可以完成真实提交并到达成功页', async ({ page }) => {
  await page.goto('/submit');
  await page.getByLabel('地点名称').fill('测试饭点');
  await page.getByLabel('地址', { exact: true }).fill('深圳大学西门测试地址');
  await page.getByLabel('具体餐食').fill('测试套餐');
  await page.getByLabel('价格（元）').fill('18');
  await page.locator('input[type=file]').setInputFiles({
    name: 'proof.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByLabel(/我确认这张图片/).check();
  await page.getByRole('button', { name: /提交这条饭签/ }).click();
  await expect(page.getByRole('heading', { name: /收到/ })).toBeVisible();
  await expect(page.locator('.success-code strong')).toHaveText(
    /^[A-Za-z0-9_-]{22,}$/,
  );
  const lookupCode = await page.locator('.success-code strong').innerText();
  await page.getByRole('link', { name: /查询投稿状态/ }).click();
  await expect(page).toHaveURL(/\/submit\/status/);
  await expect(
    page.getByRole('heading', { name: /走到哪一步了/ }),
  ).toBeVisible();
  await page.getByLabel('查询码').fill(lookupCode);
  await page.getByRole('button', { name: '查询状态' }).click();
  await expect(page.locator('.status-result')).toContainText('已收到');
});

test('匿名价格投稿可查询，管理员独立核验后公开新价格', async ({ page }) => {
  await page.goto('/submit');
  await page.getByLabel('价格有变化').check();
  await page.locator('select[name="placeId"]').selectOption('kexing-b1-foodcourt');
  await page.locator('select[name="menuItemId"]').selectOption('kexing-rice');
  await page.getByLabel('价格（元）').fill('22.5');
  await page.getByLabel('我确认这张图片').check();
  await page.getByRole('button', { name: /提交这条饭签/ }).click();
  await expect(page.locator('.success-code strong')).toHaveText(
    /^[A-Za-z0-9_-]{22,}$/,
  );
  const lookupCode = await page.locator('.success-code strong').innerText();
  await page.goto(`/submit/status?code=${encodeURIComponent(lookupCode)}`);
  await expect(page.getByLabel('查询码')).toHaveValue(lookupCode);
  await page.getByRole('button', { name: '查询状态' }).click();
  await expect(page.locator('.status-result')).toContainText('已收到');

  await page.goto('/admin/login');
  await page.getByLabel('密码').fill('phase1-demo-password');
  await page.getByRole('button', { name: /进入演示工作台/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/submissions');
  await expect(page.getByText(/new_price/).first()).toBeVisible();
  await page.getByLabel('独立核验方式').selectOption('onsite_menu');
  await page.getByLabel('我已独立核验').check();
  const approvalResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/admin/submissions') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: '通过' }).click();
  expect((await approvalResponse).ok()).toBe(true);
  await page.goto('/places/kexing-b1-foodcourt');
  await expect(page.getByText('¥22.5', { exact: true }).first()).toBeVisible();
});

test('管理员入口明确为演示模式', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.getByText('演示模式', { exact: true })).toBeVisible();
  await page.getByLabel('密码').fill('phase1-demo-password');
  await page.getByRole('button', { name: /进入演示工作台/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByText('演示模式', { exact: true })).toBeVisible();
});

test('后台登录在 JavaScript 失效时也不会把密码写入 URL', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('/admin/login');
    await page.getByLabel('密码').fill('phase1-demo-password');
    await page.getByRole('button', { name: /进入演示工作台/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(new URL(page.url()).search).toBe('');
  } finally {
    await context.close();
  }
});

test('匿名访问后台页面会先跳转登录', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('管理员可以新增地点并完成 CSV 预览提交', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('密码').fill('phase1-demo-password');
  await page.getByRole('button', { name: /进入演示工作台/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await page.goto('/admin/places');
  await page.getByRole('button', { name: /新增地点/ }).click();
  await page.getByLabel('地点名称').fill(`E2E 地点 ${suffix}`);
  await page.getByLabel('地址').fill(`E2E 测试地址 ${suffix}`);
  await page.getByLabel('经度').fill('113.91');
  await page.getByLabel('纬度').fill('22.55');
  await page.getByRole('button', { name: '保存地点' }).click();
  await expect(page.getByText(`E2E 地点 ${suffix}`)).toBeVisible();
  await page.goto('/admin/import');
  const chineseHeader =
    '片区名称,店铺名称,地址,经度,纬度,坐标系,店铺类别,准入类型,餐食名称,餐食类别,价格（元）,核验日期,核验方式,证据文件名,线索链接,后台备注';
  const templateDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 CSV 导入模板' }).click();
  const download = await templateDownload;
  await expect(download.suggestedFilename()).toBe('街头饭签-导入模板.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toBe(
    `\uFEFF${chineseHeader}\r\n`,
  );
  const csv = [
    chineseHeader,
    `深大粤海,E2E CSV ${suffix},E2E CSV 地址 ${suffix},113.92,22.56,GCJ-02,街边快餐,public,E2E 套餐,米饭,18,2026-09-01,onsite_menu,,,`,
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText(/1 行检查通过/)).toBeVisible();
  await page.getByRole('button', { name: /确认导入/ }).click();
  await expect(page.getByText(/已原子导入 1 行/)).toBeVisible();
});

test('用户端空结果可恢复，筛选入口支持键盘焦点', async ({ page }) => {
  await page.goto('/');
  const region = page.getByRole('button', { name: /选择区域/ });
  await region.focus();
  await expect(region).toBeFocused();
  await page.getByRole('textbox', { name: '搜店名或餐食' }).fill('绝不会存在的饭点');
  await expect(page.getByRole('heading', { name: '这组筛选暂时没饭' })).toBeVisible();
  await page.getByRole('button', { name: '看 ¥25 内全部' }).click();
  await expect(page.getByRole('heading', { name: /\d+ 个结果/ })).toBeVisible();
});

test('用户可以按行政区和商圈浏览全深圳，并看见真实覆盖状态', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /选择区域/ }).click();
  await expect(page.getByRole('dialog', { name: '选一个吃饭范围' })).toBeVisible();
  await expect(page.getByRole('group', { name: '当前城市' })).toContainText('当前城市');
  await expect(page.getByRole('group', { name: '当前城市' })).toContainText('深圳市');
  const directory = page.locator('.district-rail button');
  await expect(directory).toHaveCount(12);
  await expect(directory.nth(0)).toContainText('我的附近');
  await expect(directory.nth(1)).toContainText('全城');
  await expect(directory.nth(2)).toContainText('福田区');
  await expect(directory.nth(3)).toContainText('罗湖区');
  await expect(directory.nth(4)).toContainText('南山区');
  await expect(directory.nth(10)).toContainText('光明区');
  await expect(directory.nth(11)).toContainText('大鹏新区');
  await page.getByRole('navigation', { name: '深圳行政区' }).getByRole('button', { name: /福田区/ }).click();
  await page.getByRole('button', { name: /华强北.*待共建/ }).click();
  await expect(page.getByText('当前范围 · 华强北', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '这里还没有真实饭签' })).toBeVisible();

  await page.getByRole('button', { name: /选择区域/ }).click();
  await page.getByLabel('搜索行政区或商圈').fill('科技园');
  await page.getByRole('button', { name: /科技园.*已有饭签/ }).click();
  await expect(page.getByText('当前范围 · 科技园', { exact: true })).toBeVisible();
  await expect(page.locator('.results-panel a.card-link').first()).toBeVisible();
});

test('区域目录支持附近与全城快捷入口，并按当前选择高亮', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 22.53, longitude: 113.94 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /选择区域.*当前深圳市/ })).toBeVisible();
  await page.getByRole('button', { name: /选择区域/ }).click();
  const dialog = page.getByRole('dialog', { name: '选一个吃饭范围' });
  const directory = dialog.locator('.district-rail button');

  await directory.nth(0).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: /已显示你附近|拒绝了定位|定位暂时不可用/ })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /选择区域/ }).click();
  await expect(directory.nth(0)).toHaveAttribute('aria-current', 'true');
  await expect(directory.nth(1)).not.toHaveAttribute('aria-current', 'true');
  await directory.nth(1).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /选择区域.*当前深圳市/ })).toBeVisible();

  await page.getByRole('button', { name: /选择区域/ }).click();
  await expect(directory.nth(1)).toHaveAttribute('aria-current', 'true');
  await directory.nth(4).click();
  await expect(directory.nth(4)).toHaveAttribute('aria-current', 'true');
  await expect(directory.nth(1)).not.toHaveAttribute('aria-current', 'true');
  await expect(dialog.getByText('南山区 / 商圈')).toBeVisible();
  await dialog.getByLabel('搜索行政区或商圈').fill('科技园');
  await expect(dialog.getByRole('button', { name: /科技园.*已有饭签/ })).toBeVisible();
});

test('后台登录页在手机宽度没有横向溢出且失败可重试', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: /饭签后台/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('密码').fill('明显不正确的密码');
  await page.getByRole('button', { name: /进入演示工作台/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '账号或密码不正确' })).toBeVisible();
});
