const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { ONE_PIXEL_PNG, mockGithub } = require('./helpers');

async function login(page) {
  await page.goto('/admin/');
  await page.locator('#token').fill('github_pat_test');
  await page.locator('#login-form').getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#status')).toContainText('Đã khớp với website');
}

test('admin login, edit, upload image, and publish commits content plus new image only', async ({ page }) => {
  const github = await mockGithub(page);
  await login(page);

  await page.locator('input[aria-label="Hotline"]').fill('0879.769.570');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'logo-test.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG
  });
  await expect(page.locator('#btn-publish')).toBeEnabled();

  await page.locator('#btn-publish').click();
  await expect(page.locator('#dlg-publish')).toBeVisible();
  await page.locator('#pub-note').fill('Playwright test');
  await page.locator('#pub-go').click();

  await expect(page.locator('.toast')).toContainText('Đã lưu nội dung');
  expect(github.trees).toHaveLength(1);
  const paths = github.trees[0].tree.map((entry) => entry.path);
  expect(paths).toContain('content.json');
  expect(paths.some((p) => /^assets\/uploads\/.+logo-test.+\.png$/.test(p))).toBe(true);
  expect(paths).not.toContain('index.html');
  expect(paths).not.toContain('en/index.html');
  expect(paths).not.toContain('chinh-sach-du-lieu.html');
});

test('admin conflict flow appears when content changed on GitHub', async ({ page }) => {
  await mockGithub(page, { latestCommit: 'base111', latestBlob: 'blob-content-1' });
  await login(page);

  await page.route('https://api.github.com/repos/paultranofficial/lotus-global-immigration/git/ref/heads/main', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ object: { sha: 'newer222' } })
    });
  });
  await page.route('https://api.github.com/repos/paultranofficial/lotus-global-immigration/contents/content.json?ref=newer222', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sha: 'different-blob', content: '' })
    });
  });

  await page.locator('input[aria-label="Hotline"]').fill('0879.769.571');
  await page.locator('#btn-publish').click();
  await page.locator('#pub-go').click();

  await expect(page.locator('#dlg-confirm')).toBeVisible();
  await expect(page.locator('#cf-title')).toHaveText('Website vừa được cập nhật ở nơi khác');
});

test('admin restores a saved draft', async ({ page }) => {
  await mockGithub(page);
  await login(page);
  await page.locator('input[aria-label="Hotline"]').fill('0879.769.572');
  await expect(page.locator('#status')).toContainText('Có thay đổi chưa xuất bản');
  await page.waitForTimeout(750);

  await page.reload();
  await expect(page.locator('#dlg-confirm')).toBeVisible();
  await page.getByRole('button', { name: 'Mở bản nháp' }).click();
  await expect(page.locator('input[aria-label="Hotline"]')).toHaveValue('0879.769.572');
});

test('admin has no serious or critical axe violations after login', async ({ page }) => {
  await mockGithub(page);
  await login(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('#pv').analyze();
  const bad = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(bad).toEqual([]);
});
