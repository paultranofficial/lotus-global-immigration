const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const CONTENT_B64 = Buffer.from(JSON.stringify(CONTENT, null, 2) + '\n').toString('base64');
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZ2SAAAAAElFTkSuQmCC',
  'base64'
);

async function mockCrm(page, options = {}) {
  const requests = [];
  await page.route('https://onestep-ai-crm.onrender.com/api/v1/leads/intake', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    requests.push(payload);
    if (options.fail) {
      await route.fulfill({ status: options.status || 500, contentType: 'application/json', body: JSON.stringify({ success: false }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, lead_id: 'lead-test-1234' })
    });
  });
  return requests;
}

async function mockGithub(page, options = {}) {
  const state = {
    content: options.content || CONTENT,
    baseCommit: options.baseCommit || 'base111',
    latestCommit: options.latestCommit || options.baseCommit || 'base111',
    baseBlob: options.baseBlob || 'blob-content-1',
    latestBlob: options.latestBlob || options.baseBlob || 'blob-content-1',
    blobs: [],
    trees: [],
    commits: [],
    refs: []
  };

  await page.route('https://api.github.com/repos/paultranofficial/lotus-global-immigration**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const apiBase = '/repos/paultranofficial/lotus-global-immigration';
    const subpath = url.pathname.slice(apiBase.length);
    const method = req.method();

    const json = async (body, status = 200, headers = {}) => route.fulfill({
      status,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(body)
    });

    if (subpath === '' || subpath === '/') {
      await json({ permissions: { push: true } });
      return;
    }

    if (method === 'GET' && subpath === '/git/ref/heads/main') {
      await json({ object: { sha: state.latestCommit } });
      return;
    }

    if (method === 'GET' && subpath === '/contents/content.json') {
      const ref = url.searchParams.get('ref');
      await json({
        sha: ref === state.baseCommit ? state.baseBlob : state.latestBlob,
        content: Buffer.from(JSON.stringify(state.content, null, 2) + '\n').toString('base64')
      });
      return;
    }

    if (method === 'GET' && subpath.startsWith('/git/commits/')) {
      await json({ sha: subpath.split('/').pop(), tree: { sha: 'tree-base' } });
      return;
    }

    if (method === 'POST' && subpath === '/git/blobs') {
      const body = JSON.parse(req.postData() || '{}');
      const sha = `blob-${state.blobs.length + 1}`;
      state.blobs.push({ sha, body });
      await json({ sha });
      return;
    }

    if (method === 'POST' && subpath === '/git/trees') {
      const body = JSON.parse(req.postData() || '{}');
      state.trees.push(body);
      await json({ sha: 'tree-new' });
      return;
    }

    if (method === 'POST' && subpath === '/git/commits') {
      const body = JSON.parse(req.postData() || '{}');
      state.commits.push(body);
      await json({ sha: 'commit-new' });
      return;
    }

    if (method === 'PATCH' && subpath === '/git/refs/heads/main') {
      const body = JSON.parse(req.postData() || '{}');
      state.refs.push(body);
      await json({ object: { sha: body.sha } });
      return;
    }

    await json({ message: `Unhandled ${method} ${subpath}` }, 500);
  });

  return state;
}

async function completeForm(page) {
  await page.locator('input[name="field"][value="Chăm sóc sức khỏe (Healthcare)"]').check({ force: true });
  await expect(page.locator('[data-step="2"]')).toBeVisible();
  await page.locator('input[name="destination"][value="Mỹ (USA)"]').check({ force: true });
  await page.getByRole('button', { name: /Tiếp tục|Continue/ }).click();
  await page.locator('input[name="education"][value="Tốt nghiệp THPT"]').check({ force: true });
  await page.locator('input[name="language"][value="Giao tiếp cơ bản"]').check({ force: true });
  await page.locator('input[name="timeframe"][value="Trong 6 tháng"]').check({ force: true });
  await page.getByRole('button', { name: /Tiếp tục|Continue/ }).click();
  await page.locator('#lf-name').fill('Nguyen Van A');
  await page.locator('#lf-phone').fill('0912345678');
  await page.locator('#lf-email').fill('a@example.com');
}

function expectLeadPayload(payload) {
  expect(payload).toMatchObject({
    brand: 'lotus',
    name: 'Nguyen Van A',
    phone: '0912345678',
    email: 'a@example.com',
    goal: 'Lotus · Du học & nghề nghiệp · Chăm sóc sức khỏe (Healthcare)',
    field_interest: 'Chăm sóc sức khỏe (Healthcare)',
    country: 'Mỹ (USA)',
    education: 'Tốt nghiệp THPT',
    language: 'Giao tiếp cơ bản',
    timeframe: 'Trong 6 tháng',
    target_audience: 'Cho chính tôi',
    source_url: 'http://127.0.0.1:4173/#ket-noi',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    consent: true,
    consent_version: 'lotus-2026-09'
  });
  expect(payload.pain_point).toContain('Lĩnh vực: Chăm sóc sức khỏe (Healthcare)');
  expect(payload.consent_at).toEqual(expect.any(String));
}

module.exports = {
  CONTENT,
  CONTENT_B64,
  ONE_PIXEL_PNG,
  completeForm,
  expectLeadPayload,
  mockCrm,
  mockGithub
};
