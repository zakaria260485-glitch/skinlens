import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { requiredProfileFields } from '../lib/routine-builder.js';

const [html, app] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

test('public interface contains no automated skin-measurement claims', () => {
  const publicSource = `${html}\n${app}`;
  for (const forbidden of [
    /DermIQ/i,
    /skin score/i,
    /età (?:visiva|cutanea)/i,
    /laborator/i,
    /validazion/i,
    /mappa (?:della|del|visiva)/i,
    /problema rilevato/i,
    /analisi (?:della|del|fotografica)/i,
    /accurat[oa]/i
  ]) assert.doesNotMatch(publicSource, forbidden);
  assert.match(html, /guida cosmetica informativa basata sulle mie risposte/i);
  assert.match(html, /non valuta la pelle/i);
});

test('only the six used fields are required', () => {
  const tags = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map((match) => match[0]);
  const requiredIds = tags
    .filter((tag) => /\srequired(?:\s|=|>)/.test(tag))
    .map((tag) => tag.match(/\bid="([^"]+)"/)?.[1])
    .filter(Boolean);
  const domToProfile = { skinGoal: 'goal' };
  assert.deepEqual(
    requiredIds.map((id) => domToProfile[id] || id).sort(),
    [...requiredProfileFields].sort()
  );
  for (const removed of ['actualAge', 'pregnancy', 'facialHair']) assert.doesNotMatch(html, new RegExp(`id="${removed}"`));
});

test('routine can be submitted with no photo and no photo state enters the profile', () => {
  assert.doesNotMatch(html.match(/id="photoInput"[^>]*>/)?.[0] || '', /\brequired\b/);
  const profileFunction = app.slice(app.indexOf('function getProfile()'), app.indexOf('function updateReady()'));
  for (const field of requiredProfileFields) assert.match(profileFunction, new RegExp(`${field}:`));
  assert.doesNotMatch(profileFunction, /photo|image|camera|quality/i);
  const submitBlock = app.slice(app.indexOf("ui.form.addEventListener('submit'"), app.indexOf("ui.newRoutine.addEventListener"));
  assert.match(submitBlock, /renderRoutine\(buildRoutine\(profile\)\)/);
  assert.doesNotMatch(submitBlock, /photo|camera|quality/i);
});

test('removed product concepts do not remain as hidden interface elements', () => {
  for (const removedId of ['overallScore', 'skinAge', 'metricsGrid', 'maskPanel', 'progressPanel', 'reportedAge']) {
    assert.doesNotMatch(html, new RegExp(`id="${removedId}"`));
    assert.doesNotMatch(app, new RegExp(`#${removedId}\\b`));
  }
});
