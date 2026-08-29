import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('DOM IDs are unique and ARIA references resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/\b(?:aria-labelledby|aria-describedby)="([^"]+)"/g)) {
    for (const id of match[1].split(/\s+/)) assert.ok(ids.includes(id), `missing ARIA target: ${id}`);
  }
});

test('all required Skin Check controls expose native and ARIA state', () => {
  const required = [...html.matchAll(/<(?:input|select)\b[^>]*\brequired\b[^>]*>/g)]
    .map((match) => match[0].match(/\bid="([^"]+)"/)?.[1]).filter(Boolean).sort();
  assert.deepEqual(required, ['actualAge', 'consent', 'facialHair', 'photoInput', 'pregnancy', 'sensitivity', 'skinGoal', 'skinType']);
  for (const id of required) assert.match(html, new RegExp(`id="${id}"[^>]*aria-required="true"`));
});

test('buttons declare behavior and status changes are announced', () => {
  for (const match of html.matchAll(/<button\b[^>]*>/g)) assert.match(match[0], /\btype="button"/);
  assert.match(html, /id="formMessage"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /id="loadingPanel"[^>]*aria-live="polite"/);
  assert.match(html, /class="results"[^>]*tabindex="-1"/);
  assert.match(app, /ui\.results\.focus\(\{ preventScroll: true \}\)/);
});

test('keyboard, touch and reduced-motion safeguards are present', async () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /playsinline/);
  assert.match(app, /prefers-reduced-motion|scrollIntoView/);
  assert.match(await readFile(new URL('../styles.css', import.meta.url), 'utf8'), /prefers-reduced-motion/);
});
