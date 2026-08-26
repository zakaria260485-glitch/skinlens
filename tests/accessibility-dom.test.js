import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [html, css, app] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

function values(source, attribute) {
  return [...source.matchAll(new RegExp(`\\b${attribute}="([^"]+)"`, 'g'))].map((match) => match[1]);
}

test('DOM IDs and accessibility references are complete and unambiguous', () => {
  const ids = values(html, 'id');
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  const idSet = new Set(ids);
  for (const attribute of ['for', 'aria-describedby', 'aria-labelledby', 'aria-controls']) {
    for (const value of values(html, attribute)) {
      for (const reference of value.split(/\s+/)) assert.ok(idSet.has(reference), `${attribute} references missing ID: ${reference}`);
    }
  }
  for (const target of [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])) assert.ok(idSet.has(target));
  for (const target of [...app.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1])) assert.ok(idSet.has(target), `app target missing: ${target}`);
});

test('required controls expose native and ARIA state while the photo remains optional', () => {
  const tags = [...html.matchAll(/<(?:input|select)\b[^>]*>/g)].map((match) => match[0]);
  const required = tags.filter((tag) => /\srequired(?:\s|=|>)/.test(tag));
  const ids = required.map((tag) => tag.match(/\bid="([^"]+)"/)?.[1]).filter(Boolean).sort();
  assert.deepEqual(ids, ['activeUse', 'adultConsent', 'knownReactions', 'sensitivity', 'skinGoal', 'skinType']);
  for (const control of required) assert.match(control, /aria-required="true"/);
  assert.doesNotMatch(tags.find((tag) => /id="photoInput"/.test(tag)), /\srequired(?:\s|=|>)/);
  assert.ok((html.match(/class="required-mark"/g) || []).length >= required.length);
});

test('all buttons declare their behavior and important changes are announced', () => {
  for (const button of html.matchAll(/<button\b[^>]*>/g)) assert.match(button[0], /\btype="(?:button|submit)"/);
  assert.match(html, /id="formMessage"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /id="photoMessage"[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.match(html, /class="camera-instruction"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /class="results"[^>]*tabindex="-1"/);
});

test('keyboard, touch and reduced-motion safeguards are present', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*3px solid/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /class="skip-link"/);
});

test('routine action depends on the questionnaire and never on the photo', () => {
  assert.match(html, /id="buildRoutineBtn"[^>]*type="submit"[^>]*disabled/);
  assert.match(app, /ui\.build\.disabled = !validateRoutineProfile\(getProfile\(\)\)\.valid/);
  const getProfileBlock = app.slice(app.indexOf('function getProfile()'), app.indexOf('function updateReady()'));
  assert.doesNotMatch(getProfileBlock, /photo|image|quality/i);
});
