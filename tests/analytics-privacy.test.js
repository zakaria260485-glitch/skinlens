import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [home, app, analytics, privacy, configText] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('app.js', root), 'utf8'),
  readFile(new URL('analytics.js', root), 'utf8'),
  readFile(new URL('privacy.html', root), 'utf8'),
  readFile(new URL('vercel.json', root), 'utf8')
]);

test('first-party analytics is loaded without inline scripts', () => {
  assert.match(home, /<script src="\.\/analytics\.js"><\/script>/);
  assert.match(home, /<script defer src="\/_vercel\/insights\/script\.js"><\/script>/);
  assert.doesNotMatch(home, /<script>(?:.|\n)*?<\/script>/);
});

test('completion uses an anonymous route and never serializes profile values', () => {
  assert.match(app, /const completionPath = '\/routine-creata'/);
  assert.match(app, /history\.pushState\(\{ routineCreated: true \}, '', completionPath\)/);
  assert.doesNotMatch(app, /URLSearchParams|JSON\.stringify\(profile\)|location\.hash\s*=/);

  const config = JSON.parse(configText);
  assert.deepEqual(config.rewrites, [
    { source: '/routine-creata', destination: '/' }
  ]);
});

test('analytics removes query data and public copy describes the exact scope', () => {
  assert.match(analytics, /url\.search = ''/);
  assert.match(analytics, /url\.hash = ''/);
  assert.doesNotMatch(analytics, /skinType|sensitivity|goal|activeUse|knownReactions|photo/i);
  assert.match(privacy, /singole risposte, la routine prodotta e l'eventuale fotografia non vengono incluse/);
  assert.match(privacy, /consultabili per 30 giorni/);
});
