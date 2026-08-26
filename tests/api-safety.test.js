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

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

const environments = ['production', 'preview', 'development', undefined];
const endpoints = [
  {
    name: 'analyze',
    handler: analyze,
    request: () => new Request('https://routinegentile.example/api/analyze', { method: 'POST' })
  },
  {
    name: 'results',
    handler: results,
    request: () => new Request('https://routinegentile.example/api/results?id=invalid', { method: 'GET' })
  },
  {
    name: 'mask',
    handler: mask,
    request: () => new Request('https://routinegentile.example/api/mask?id=invalid&name=invalid', { method: 'GET' })
  }
];

for (const vercelEnvironment of environments) {
  const environmentName = vercelEnvironment ?? 'undefined';

  test(`DermIQ is default-deny in ${environmentName}`, { concurrency: false }, async () => {
    await withEnvironment({
      VERCEL_ENV: vercelEnvironment,
      NODE_ENV: vercelEnvironment === 'development' ? 'development' : 'production',
      DERMIQ_API_KEY: 'test-secret',
      // A stale flag must not be able to reopen the public project.
      DERMIQ_ANALYSIS_ENABLED: 'true'
    }, async () => {
      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;
      globalThis.fetch = async () => {
        fetchCalls += 1;
        throw new Error('DermIQ must never be called by the public build');
      };

      try {
        for (const endpoint of endpoints) {
          const response = await endpoint.handler(endpoint.request());
          const body = await response.json();

          assert.equal(response.status, 503, `${endpoint.name} must be closed`);
          assert.equal(body.code, 'DERMIQ_ANALYSIS_DISABLED');
          assert.equal(body.analysisEnabled, false);
          assert.equal(body.creditsConsumed, false);
          assert.match(response.headers.get('cache-control'), /no-store/);
          assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
        }
        assert.equal(fetchCalls, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
}

test('health exposes booleans but never the DermIQ secret', { concurrency: false }, async () => {
  await withEnvironment({
    VERCEL_ENV: 'production',
    NODE_ENV: 'production',
    DERMIQ_API_KEY: 'never-return-this-secret',
    DERMIQ_ANALYSIS_ENABLED: 'true'
  }, async () => {
    const response = health();
    const rawBody = await response.text();
    const body = JSON.parse(rawBody);

    assert.deepEqual(body, {
      ok: true,
      service: 'routinegentile-backend',
      configured: true,
      analysisEnabled: false
    });
    assert.equal(rawBody.includes('never-return-this-secret'), false);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  });
});
