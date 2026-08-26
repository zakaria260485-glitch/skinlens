import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [home, privacy, terms] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('privacy.html', root), 'utf8'),
  readFile(new URL('terms.html', root), 'utf8')
]);

test('paid kit is clearly optional, priced and routed to the verified Payhip product', () => {
  assert.match(home, /Kit Costanza 30 Giorni/);
  assert.match(home, /€7,90/);
  assert.match(home, /https:\/\/payhip\.com\/b\/HbAG9\?utm_source=routinegentile/);
  assert.match(home, /target="_blank" rel="noopener sponsored"/);
  assert.match(home, /Acquisto e consegna su Payhip/);
});

test('privacy and terms distinguish the free app from the external purchase', () => {
  assert.match(privacy, /Payhip, un servizio esterno/);
  assert.match(privacy, /non riceve né conserva i dati completi della carta/);
  assert.match(terms, /guida online rimane gratuita/);
  assert.match(terms, /licenza personale, non esclusiva e non trasferibile/);
});

test('commercial copy avoids clinical promises and fake pressure', () => {
  const offer = home.match(/<aside class="kit-offer"[\s\S]*?<\/aside>/)?.[0] ?? '';
  assert.ok(offer);
  assert.doesNotMatch(offer, /diagnos|cura|guar|risultato garantito|solo oggi|ultimi posti|prima e dopo/i);
});
