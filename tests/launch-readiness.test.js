import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const [home, privacy, terms, contact, manifest, packageJson, readme] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('privacy.html', root), 'utf8'),
  readFile(new URL('terms.html', root), 'utf8'),
  readFile(new URL('contact.html', root), 'utf8'),
  readFile(new URL('manifest.webmanifest', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
  readFile(new URL('README.md', root), 'utf8')
]);

test('RoutineGentile identity is coherent across public launch files', async () => {
  for (const source of [home, privacy, terms, contact, manifest, packageJson, readme]) {
    assert.match(source, /RoutineGentile|routinegentile/);
    assert.doesNotMatch(source, /SkinLens/i);
  }
  assert.equal(JSON.parse(packageJson).name, 'routinegentile');
  assert.equal(JSON.parse(manifest).name, 'RoutineGentile');
  await stat(new URL('assets/routinegentile-mark.svg', root));
  await stat(new URL('assets/routinegentile-launch.jpg', root));
  await stat(new URL('assets/routinegentile-og.svg', root));
});

test('launch pages expose privacy, terms, contact and an adult-only beta', () => {
  assert.match(home, /href="\/privacy\.html"/);
  assert.match(home, /href="\/terms\.html"/);
  assert.match(home, /href="\/contact\.html"/);
  assert.match(privacy, /Dati tecnici di connessione/);
  assert.match(privacy, /Vercel Web Analytics/);
  assert.match(privacy, /non usa cookie/);
  assert.match(terms, /beta gratuita destinata a persone maggiorenni/);
  assert.match(terms, /non effettua analisi cliniche/i);
  assert.match(contact, /Mountaj Zakaria/);
  assert.match(contact, /elialuxuryllc@gmail\.com/);
});

test('public claims are specific about form and photo data', () => {
  assert.match(home, /Risposte e foto non inviate/);
  assert.match(privacy, /non invia al nostro server le risposte del questionario o la fotografia facoltativa/);
  assert.doesNotMatch(home, /clinicamente|scientificamente|diagnosi accurata|risultati garantiti/i);
});
