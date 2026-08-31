import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, kit, analytics, privacy, eventApi] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../kit.html', import.meta.url), 'utf8'),
  readFile(new URL('../analytics.js', import.meta.url), 'utf8'),
  readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
  readFile(new URL('../api/event.js', import.meta.url), 'utf8')
]);

test('first-party analytics is loaded without serializing Skin Check data', () => {
  assert.match(html, /<script src="\/analytics\.js"><\/script>/);
  assert.match(html, /<script defer src="\/_vercel\/insights\/script\.js"><\/script>/);
  assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/);
  assert.doesNotMatch(analytics, /photo|skinType|sensitivity|facialHair|overallScore|DermIQ/i);
});

test('analytics strips query and fragment data', () => {
  assert.match(analytics, /url\.search\s*=\s*''/);
  assert.match(analytics, /url\.hash\s*=\s*''/);
  assert.match(privacy, /fotografie, l'età, le singole risposte, gli indicatori e i punteggi[^<]*non vengono inseriti negli eventi/i);
});

test('funnel events are allowlisted and never include Skin Check values', () => {
  assert.match(analytics + eventApi, /scan_start/);
  assert.match(analytics + eventApi, /scan_complete/);
  assert.match(analytics + eventApi, /checkout_click/);
  assert.doesNotMatch(eventApi, /['"](?:age|score|metric|profile|image|file|blob)['"]\s*:/i);
  assert.match(kit, /data-track="checkout_click"/);
});
