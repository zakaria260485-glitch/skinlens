import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function text(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function headerMap(rule) {
  return new Map(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

test('Vercel applies strict browser security headers', async () => {
  const config = JSON.parse(await text('vercel.json'));
  const globalRule = config.headers.find(({ source }) => source === '/(.*)');
  assert.ok(globalRule, 'missing global header rule');
  const headers = headerMap(globalRule);

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(headers.get('strict-transport-security') || '', /max-age=63072000/);

  const csp = headers.get('content-security-policy') || '';
  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "connect-src 'self'"
  ]) assert.match(csp, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);

  const permissions = headers.get('permissions-policy') || '';
  assert.match(permissions, /camera=\(self\)/);
  for (const feature of ['microphone', 'geolocation', 'payment', 'usb']) {
    assert.match(permissions, new RegExp(`${feature}=\\(\\)`));
  }
});

test('API and entrypoint responses cannot be cached', async () => {
  const config = JSON.parse(await text('vercel.json'));
  const apiRule = config.headers.find(({ source }) => source === '/api/(.*)');
  const rootRule = config.headers.find(({ source }) => source === '/');
  assert.ok(apiRule, 'missing API header rule');
  assert.ok(rootRule, 'missing root cache rule');

  const apiHeaders = headerMap(apiRule);
  assert.match(apiHeaders.get('cache-control') || '', /no-store/);
  assert.equal(apiHeaders.get('vercel-cdn-cache-control'), 'no-store');
  assert.match(apiHeaders.get('x-robots-tag') || '', /noindex/);
  assert.match(headerMap(rootRule).get('cache-control') || '', /no-store/);

  for (const asset of ['/app.js', '/analytics.js', '/styles.css']) {
    const rule = config.headers.find(({ source }) => source === asset);
    assert.ok(rule, `missing cache rule for ${asset}`);
    const value = headerMap(rule).get('cache-control') || '';
    assert.match(value, /max-age=0/);
    assert.match(value, /must-revalidate/);
    assert.doesNotMatch(value, /immutable/);
  }
});

test('tracked environment template is empty and local secrets are ignored', async () => {
  const envExample = await text('.env.example');
  assert.match(envExample, /^DERMIQ_API_KEY=\s*$/m);
  assert.doesNotMatch(envExample, /diq_sk_[A-Za-z0-9_-]+/);

  const ignore = await text('.gitignore');
  for (const pattern of ['.env', '.env.*', '!.env.example', '.vercel', 'node_modules', '*.pem', '*.key', '*.p12']) {
    assert.ok(ignore.split(/\r?\n/).includes(pattern), `missing .gitignore rule: ${pattern}`);
  }
});

test('repository contains no obvious private key or DermIQ token', async () => {
  const excludedDirectories = new Set(['.git', '.vercel', 'node_modules', 'coverage']);
  const candidateExtensions = new Set(['.js', '.json', '.html', '.css', '.md', '.yaml', '.yml', '.example', '.txt']);
  const findings = [];

  async function scan(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await scan(absolute);
        continue;
      }
      if (!candidateExtensions.has(path.extname(entry.name)) && entry.name !== '.env.example') continue;
      const content = await readFile(absolute, 'utf8');
      if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) || /diq_sk_[A-Za-z0-9_-]{8,}/.test(content)) {
        findings.push(path.relative(root, absolute));
      }
    }
  }

  await scan(root);
  assert.deepEqual(findings, []);
});

test('package scripts make deploy builds fail closed on validation errors', async () => {
  const pkg = JSON.parse(await text('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts.build, 'node tests/run-all.js');
  assert.equal(pkg.scripts.test, 'node tests/run-all.js');
  assert.equal(pkg.scripts.check, 'node tests/run-all.js');
  assert.match(pkg.scripts['test:syntax'], /--syntax-only/);
  assert.deepEqual(pkg.dependencies, undefined);
  assert.deepEqual(pkg.devDependencies, undefined);
});
