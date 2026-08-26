import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app, readme] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8')
]);

test('public copy clearly states local and temporary handling', () => {
  assert.match(html, /Tutto sul dispositivo/);
  assert.match(html, /Nessun dato salvato/);
  assert.match(html, /Risposte e foto non inviate/);
  assert.match(html, /Non sono inviate, salvate nello storico del browser o associate a un account/);
  assert.match(html, /La foto rimane nella pagina aperta/);
});

test('routine code performs no data request or persistent storage operation', () => {
  for (const forbidden of [
    /\bfetch\s*\(/,
    /XMLHttpRequest/,
    /navigator\.sendBeacon/,
    /\bWebSocket\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /indexedDB/,
    /document\.cookie/
  ]) assert.doesNotMatch(app, forbidden);
  assert.doesNotMatch(html, /<form\b[^>]*\baction=/i);
});

test('README privacy statements match implemented cleanup', () => {
  assert.match(readme, /non invia in rete risposte, routine o fotografie/);
  assert.match(readme, /non usa `localStorage`, `sessionStorage`, cookie o database del browser/);
  assert.match(app, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(app, /ui\.video\.srcObject = null/);
  assert.match(app, /window\.addEventListener\('pagehide'/);
});
