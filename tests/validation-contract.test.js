import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, app] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

test('Skin Check requires every input that changes analysis safety', () => {
  const required = [...html.matchAll(/<(?:input|select)\b[^>]*\brequired\b[^>]*>/g)]
    .map((match) => match[0].match(/\bid="([^"]+)"/)?.[1]).filter(Boolean).sort();
  assert.deepEqual(required, ['actualAge', 'consent', 'facialHair', 'photoInput', 'pregnancy', 'sensitivity', 'skinGoal', 'skinType']);
  assert.match(app, /profileComplete/);
  assert.match(app, /age >= 18/);
});

test('the result contract exposes indicators, priorities, age range and beard filtering', () => {
  for (const id of ['overallScore', 'skinAge', 'metricsGrid', 'priorityList', 'maskPanel', 'reportedAge']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /selectReliablePriorities/);
  assert.match(app, /FACIAL_HAIR_SENSITIVE/);
  assert.match(app, /Prima lettura/);
  assert.match(app, /ageRange/);
});

test('claims remain cosmetic and explicitly non-diagnostic', () => {
  assert.match(html, /osservazioni cosmetiche/i);
  assert.match(html, /non diagnosi mediche/i);
  assert.doesNotMatch(html + app, /diagnosi automatica|cura l'acne|accuratezza clinica|risultato garantito/i);
});
