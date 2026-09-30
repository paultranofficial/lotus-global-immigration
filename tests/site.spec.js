const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { completeForm, expectLeadPayload, mockCrm } = require('./helpers');

test('renders Vietnamese and English pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { name: /Vươn xa từ/i })).toBeVisible();
  await expect.poll(() => page.locator('#lotus-data').evaluate((el) => JSON.parse(el.textContent).lang)).toBe('vi');

  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /Go further/i })).toBeVisible();
  await expect.poll(() => page.locator('#lotus-data').evaluate((el) => JSON.parse(el.textContent).lang)).toBe('en');
});

test('redirects legacy ?lang=en URL to /en/', async ({ page }) => {
  await page.goto('/?lang=en');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('destination dialog CTA pre-ticks the matching destination', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-detail="usa"]').click();
  await expect(page.locator('#detail-dialog')).toBeVisible();
  await page.locator('#dialog-cta').click();
  await expect(page.locator('#detail-dialog')).toBeHidden();
  await expect(page.locator('input[name="destination"][value="Mỹ (USA)"]')).toBeChecked();
});

test('career filters update visible count in both languages', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-filter="healthcare"]').click();
  await expect(page.locator('#career-count')).toHaveText('1 hướng nghề nghiệp');
  await page.locator('[data-filter="beauty"]').click();
  await expect(page.locator('#career-count')).toHaveText('2 hướng nghề nghiệp');

  await page.goto('/en/');
  await page.locator('[data-filter="healthcare"]').click();
  await expect(page.locator('#career-count')).toHaveText('1 career paths');
  await page.locator('[data-filter="beauty"]').click();
  await expect(page.locator('#career-count')).toHaveText('2 career paths');
});

test('submits all 4 form steps with the expected CRM payload', async ({ page }) => {
  const crmRequests = await mockCrm(page);
  await page.goto('/');
  await completeForm(page);
  await expect(page.locator('#lf-submit')).toBeDisabled();
  await page.locator('#lf-consent').check();
  await page.locator('#lf-submit').click();

  await expect(page.locator('#lf-thanks')).toBeVisible();
  expect(crmRequests).toHaveLength(1);
  expectLeadPayload(crmRequests[0]);
  expect(Object.keys(crmRequests[0]).sort()).toEqual([
    'brand',
    'consent',
    'consent_at',
    'consent_version',
    'country',
    'education',
    'email',
    'field_interest',
    'goal',
    'language',
    'name',
    'pain_point',
    'phone',
    'source_url',
    'target_audience',
    'timeframe',
    'utm_campaign',
    'utm_medium',
    'utm_source'
  ]);
});

test('requires consent before submitting', async ({ page }) => {
  const crmRequests = await mockCrm(page);
  await page.goto('/');
  await completeForm(page);
  await expect(page.locator('#lf-submit')).toBeDisabled();
  await page.locator('#lf-consent').check();
  await expect(page.locator('#lf-submit')).toBeEnabled();
  await page.locator('#lf-consent').uncheck();
  await expect(page.locator('#lf-submit')).toBeDisabled();
  expect(crmRequests).toHaveLength(0);
});

test('honeypot prevents sending data to CRM', async ({ page }) => {
  const crmRequests = await mockCrm(page);
  await page.goto('/');
  await completeForm(page);
  await page.locator('#lf-consent').check();
  await page.locator('#lf-website').fill('https://spam.example');
  await page.locator('#lf-submit').click();
  await expect(page.locator('#lf-thanks')).toBeVisible();
  expect(crmRequests).toHaveLength(0);
});

test('has no serious or critical axe violations on public pages', async ({ page }) => {
  for (const url of ['/', '/en/']) {
    await page.goto(url);
    await page.addStyleTag({
      content: `
        *,*::before,*::after{animation:none!important;transition:none!important}
        .reveal-ready,.reveal-ready *{opacity:1!important;transform:none!important}
      `
    });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(bad).toEqual([]);
  }
});
