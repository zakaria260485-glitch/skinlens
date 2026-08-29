import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [home, privacy, terms] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../privacy.html', import.meta.url), 'utf8'),
  readFile(new URL('../terms.html', import.meta.url), 'utf8')
]);

test('paid kit is optional, priced and routed to the verified Payhip product', () => {
  assert.match(home, /https:\/\/payhip\.com\/b\/HbAG9\?utm_source=routinegentile/);
  assert.match(home, /€7,90/);
  assert.match(home, /Scopri il kit/);
  assert.match(home, /rel="noopener sponsored"/);
});

test('commercial copy avoids clinical promises and fake pressure', () => {
  assert.doesNotMatch(home, /cura|guarisce|risultati garantiti|solo oggi|ultimi posti/i);
  assert.match(home, /non diagnosi/i);
  assert.match(privacy + terms, /Payhip/);
});
