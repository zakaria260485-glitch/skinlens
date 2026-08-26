import test from 'node:test';
import assert from 'node:assert/strict';
import { ageRange, median, stabilityLevel, stabilizeMetrics } from '../lib/result-math.js';

test('median ignores extreme ordering and supports an even series', () => {
  assert.equal(median([91, 55, 72]), 72);
  assert.equal(median([80, 60]), 70);
});

test('visual age is always presented as a bounded range', () => {
  assert.deepEqual(ageRange(46, 1), { lower: 41, upper: 51 });
  assert.deepEqual(ageRange(46, 3), { lower: 42, upper: 50 });
});

test('metric stabilization uses at most the latest three observations', () => {
  const history = [
    { metrics: [{ key: 'hd_texture', score: 20 }] },
    { metrics: [{ key: 'hd_texture', score: 60 }] },
    { metrics: [{ key: 'hd_texture', score: 70 }] }
  ];
  const [result] = stabilizeMetrics([{ key: 'hd_texture', score: 80 }], history);
  assert.equal(result.stableScore, 70);
  assert.equal(result.observations, 3);
});

test('stability bands flag large scan-to-scan variation', () => {
  assert.equal(stabilityLevel(3), 'buona');
  assert.equal(stabilityLevel(7), 'media');
  assert.equal(stabilityLevel(12), 'bassa');
});
