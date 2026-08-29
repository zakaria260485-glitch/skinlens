import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app, privacy, readme] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8')
]);

test('public copy distinguishes uploaded front image from local side images', () => {
  assert.match(html + privacy, /foto frontale[^<]*DermIQ/i);
  assert.match(html + privacy, /foto laterali[^<]*dispositivo/i);
  assert.match(privacy, /RoutineGentile non salva intenzionalmente le fotografie/i);
});

test('browser persistence is disclosed and never stores photos', () => {
  assert.match(app, /sessionStorage/);
  assert.match(app, /localStorage/);
  assert.match(privacy, /non includono fotografie/i);
  const historyEntry = app.slice(app.indexOf('const entry ='), app.indexOf('function progressCard'));
  assert.doesNotMatch(historyEntry, /\b(?:photo|image|blob|file)\b/i);
});

test('README matches the protected DermIQ architecture', () => {
  assert.match(readme, /DERMIQ_API_KEY/);
  assert.match(readme, /foto frontale compressa/);
  assert.match(readme, /non è una diagnosi/i);
});
