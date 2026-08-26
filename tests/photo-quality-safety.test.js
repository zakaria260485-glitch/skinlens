import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [source, html] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

test('photo coach requests one optional front-facing image', () => {
  assert.match(html, /Un solo scatto, guardando avanti/);
  assert.match(html, /id="photoInput"[^>]*type="file"/);
  assert.doesNotMatch(html.match(/id="photoInput"[^>]*>/)?.[0] || '', /\brequired\b/);
  assert.doesNotMatch(html, /Foto \d+ di \d+|sinistra|destra/i);
  assert.match(source, /facingMode: 'user'/);
});

test('technical coaching uses only resolution, general light and sharpness', () => {
  assert.match(source, /label: 'Risoluzione'/);
  assert.match(source, /label: 'Luce generale'/);
  assert.match(source, /label: 'Nitidezza generale'/);
  assert.match(source, /function sampleVisual\(/);
  assert.doesNotMatch(source, /FaceDetector|measureFace|skinMetric|estimatedAge/i);
});

test('camera, bitmap, canvas and preview resources are released', () => {
  assert.match(source, /mediaStream\?\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
  assert.match(source, /URL\.revokeObjectURL\(previewUrl\)/);
  assert.match(source, /close: \(\) => bitmap\.close\(\)/);
  assert.match(source, /canvas\.width = 0/);
  assert.match(source, /window\.addEventListener\('pagehide'/);
  assert.match(source, /document\.addEventListener\('visibilitychange'/);
});

test('photo output is explicitly separate from routine output', () => {
  assert.match(html, /Non cambia la routine e non valuta la pelle/);
  assert.match(source, /Questo controllo non modifica la routine/);
  const photoBlock = source.slice(source.indexOf('ui.chooseFile.addEventListener'), source.indexOf('document.addEventListener'));
  assert.doesNotMatch(photoBlock, /buildRoutine\(|renderRoutine\(/);
});
