import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [source, html] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('camera guides front, left and right with a visible oval', () => {
  assert.match(html, /Selfie guidato a 3 angoli/);
  assert.match(html, /id="faceOval"/);
  for (const direction of ['Guarda avanti', 'spalla sinistra', 'spalla destra']) assert.match(source, new RegExp(direction));
});

test('quality guidance no longer blocks every readable photo', () => {
  assert.match(source, /qualityApproved = true/);
  assert.match(source, /Foto accettata/);
  assert.doesNotMatch(source, /Prima foto da rifare/);
});

test('only the front image is sent and image resources are released', () => {
  assert.equal((source.match(/form\.append\('file'/g) || []).length, 1);
  assert.match(source, /Le viste laterali[^']*non vengono inviate/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /bitmap\.close\(\)/);
});
