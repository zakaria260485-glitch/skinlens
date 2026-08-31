import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [home, kit, privacy, terms] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../kit.html', import.meta.url), 'utf8'),
  readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
  readFile(new URL('../terms.html', import.meta.url), 'utf8')
]);

test('paid kit is optional, priced and routed to the verified Payhip product', () => {
  assert.match(home, /href="\/kit\?utm_source=app/);
  assert.match(kit, /https:\/\/payhip\.com\/b\/HbAG9\?utm_source=routinegentile/);
  assert.match(home + kit, /€7,90/);
  assert.match(home, /Scopri il kit/);
  assert.match(kit, /rel="noopener sponsored"/);
});

test('commercial copy avoids clinical promises and fake pressure', () => {
  assert.doesNotMatch(home + kit, /cura|guarisce|risultati garantiti|solo oggi|ultimi posti/i);
  assert.match(home + kit, /non diagnosi|non diagnostica/i);
  assert.match(privacy + terms, /Payhip/);
});
