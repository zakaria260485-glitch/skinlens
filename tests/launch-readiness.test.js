import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const [home, app, privacy, terms, contact, packageJson] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
  readFile(new URL('../terms.html', import.meta.url), 'utf8'),
  readFile(new URL('../contact.html', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

test('RoutineGentile identity is coherent across public launch files', async () => {
  for (const source of [home, privacy, terms, contact]) assert.match(source, /RoutineGentile/);
  assert.doesNotMatch(home + app, /SkinLens/i);
  assert.equal(JSON.parse(packageJson).name, 'routinegentile');
  await stat(new URL('../assets/routinegentile-mark.svg', import.meta.url));
});

test('launch pages expose privacy, terms, contact and adult consent', () => {
  for (const href of ['/privacy.html', '/terms.html', '/contact.html']) assert.match(home, new RegExp(`href="${href}"`));
  assert.match(home, /Ho almeno 18 anni/);
  assert.match(home, /osservazioni cosmetiche[^<]*non diagnosi/i);
});

test('public copy states the actual photo flow and uncertainty', () => {
  assert.match(home, /foto frontale[^<]*DermIQ/i);
  assert.match(home, /foto laterali[^<]*dispositivo/i);
  assert.match(home + app, /prima lettura|prima scansione/i);
  assert.match(home + terms, /luce, posa, trucco/i);
  assert.match(privacy, /localStorage/);
});
