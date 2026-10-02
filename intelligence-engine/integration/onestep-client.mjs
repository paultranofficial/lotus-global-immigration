const countryMarkets = Object.freeze({
  'Mỹ (USA)': ['US'], 'Mỹ': ['US'], 'Úc': ['AU'], 'Canada': ['CA'],
  'Singapore': ['SG'], 'Malaysia': ['MY'], 'Anh (UK)': ['UK'], 'Anh': ['UK'],
  'Đức': ['DE'], 'Pháp': ['FR'], 'Hà Lan': ['NL'], 'Phần Lan': ['FI'], 'Ireland': ['IE'],
  'Châu Âu': ['DE', 'FR', 'NL', 'FI', 'IE'],
});

export class OneStepIntelligenceClient {
  constructor({ baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 20000 }) {
    if (typeof window !== 'undefined') throw new Error('OneStep engine client is server-only');
    if (!baseUrl || !apiKey) throw new Error('Engine URL and server API key required');
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      throw new Error('Engine requires HTTPS outside local development');
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, body) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Intelligence engine returned HTTP ${response.status}`);
    return response.json();
  }

  async analyseIntake(lead, asOf = new Date().toISOString().slice(0, 10)) {
    const destinations = String(lead.country || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!destinations.length || destinations.some(value => !countryMarkets[value])) {
      return { status: 'market_clarification_required', country: lead.country };
    }
    const targetMarkets = [...new Set(destinations.flatMap(value => countryMarkets[value]))];
    // Consultation intake fields do not establish nationality or financial eligibility.
    return this.request('/v1/agents/lead', {
      target_markets: targetMarkets, as_of: asOf,
      profile: { education: lead.education || null, english: lead.language || null,
        field_interest: lead.field_interest || null, intake: lead.timeframe || null },
    });
  }

  context(request) { return this.request('/v1/agents/context', request); }
  freezePolicy(caseId, request) {
    return this.request(`/v1/cases/${encodeURIComponent(caseId)}/policy-snapshot`, request);
  }
}
