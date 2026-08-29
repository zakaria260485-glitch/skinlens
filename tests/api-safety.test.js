import assert from 'node:assert/strict';
import test from 'node:test';

import analyze from '../api/analyze.js';
import health from '../api/health.js';
import mask from '../api/mask.js';
import results from '../api/results.js';

function withEnvironment(values, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve().then(callback).finally(() => {
    for (const [key, value] of previous) value === undefined ? delete process.env[key] : process.env[key] = value;
  });
}

test('the emergency switch closes every DermIQ endpoint without consuming credits', { concurrency: false }, async () => {
  await withEnvironment({ DERMIQ_API_KEY: 'test-secret', DERMIQ_ANALYSIS_ENABLED: 'false' }, async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
    try {
      const requests = [
        analyze(new Request('https://routinegentile.example/api/analyze', { method: 'POST' })),
        results(new Request('https://routinegentile.example/api/results?id=invalid')),
        mask(new Request('https://routinegentile.example/api/mask?id=invalid&name=invalid'))
      ];
      for (const pending of requests) {
        const response = await pending;
        const body = await response.json();
        assert.equal(response.status, 503);
        assert.equal(body.code, 'DERMIQ_ANALYSIS_DISABLED');
        assert.equal(body.creditsConsumed, false);
      }
      assert.equal(fetchCalls, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('health reports readiness without exposing the secret', { concurrency: false }, async () => {
  await withEnvironment({ DERMIQ_API_KEY: 'never-return-this-secret', DERMIQ_ANALYSIS_ENABLED: undefined }, async () => {
    const response = health();
    const raw = await response.text();
    assert.deepEqual(JSON.parse(raw), { ok: true, service: 'routinegentile-backend', configured: true, analysisEnabled: true });
    assert.equal(raw.includes('never-return-this-secret'), false);
  });
});

test('analysis is same-origin and validates before contacting DermIQ', { concurrency: false }, async () => {
  await withEnvironment({ DERMIQ_API_KEY: 'test-secret', DERMIQ_ANALYSIS_ENABLED: undefined }, async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('must not fetch'); };
    try {
      const response = await analyze(new Request('https://routinegentile.example/api/analyze', {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }
      }));
      assert.equal(response.status, 403);
      assert.equal(fetchCalls, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
});
