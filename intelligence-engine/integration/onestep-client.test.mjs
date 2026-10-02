import assert from 'node:assert/strict';
import test from 'node:test';
import { OneStepIntelligenceClient } from './onestep-client.mjs';

test('CRM adapter preserves input, expands Europe, omits contact PII and uses server key', async () => {
  let captured;
  const client = new OneStepIntelligenceClient({ baseUrl: 'https://engine.example.com', apiKey: 'test-only',
    fetchImpl: async (url, options) => { captured = { url, options }; return { ok: true, json: async () => ({ ok: true }) }; } });
  const lead = { brand: 'lotus', name: 'Synthetic', email: 'synthetic@example.com', country: 'Châu Âu', education: 'Bachelor' };
  const original = structuredClone(lead);
  await client.analyseIntake(lead, '2026-10-02');
  const body = JSON.parse(captured.options.body);
  assert.deepEqual(body.target_markets, ['DE', 'FR', 'NL', 'FI', 'IE']);
  assert.equal(captured.options.headers['X-API-Key'], 'test-only');
  assert.equal(body.profile.nationality, undefined);
  assert.equal(body.profile.email, undefined);
  assert.deepEqual(lead, original);
});

test('unknown market asks for clarification without making a request', async () => {
  const client = new OneStepIntelligenceClient({ baseUrl: 'https://engine.example.com', apiKey: 'test-only',
    fetchImpl: () => { throw new Error('unexpected network'); } });
  assert.equal((await client.analyseIntake({ country: 'Undecided' })).status, 'market_clarification_required');
});

test('multiple comma-separated CRM destinations are all preserved', async () => {
  let payload;
  const client = new OneStepIntelligenceClient({ baseUrl: 'https://engine.example.com', apiKey: 'test-only',
    fetchImpl: async (url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({}) }; } });
  await client.analyseIntake({ country: 'Canada, Mỹ (USA), Châu Âu' }, '2026-10-02');
  assert.deepEqual(payload.target_markets, ['CA', 'US', 'DE', 'FR', 'NL', 'FI', 'IE']);
});

test('server errors cannot masquerade as an empty policy answer', async () => {
  const client = new OneStepIntelligenceClient({ baseUrl: 'https://engine.example.com', apiKey: 'test-only',
    fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(client.context({}), /HTTP 503/);
});
