import test from 'node:test';
import assert from 'node:assert/strict';
import { describeMask, selectPriorityMasks, selectReliablePriorities } from '../lib/mask-policy.js';

const providerMasks = [
  'debug_beard_mask.png', 'hd_moisture_output.png', 'hd_droopy_upper_eyelid_output.png',
  'hd_wrinkle_output_all.png', 'hd_wrinkle_output_forehead.png', 'hd_pore_output_all.png', 'hd_texture_output.png'
];

const priorities = [
  { key: 'hd_pore', stableScore: 68, observations: 2 },
  { key: 'hd_wrinkle', stableScore: 72, observations: 2 },
  { key: 'hd_texture', stableScore: 74, observations: 2 }
];

test('debug and unrelated provider masks are never user-facing', () => {
  assert.equal(describeMask('debug_beard_mask.png'), null);
  assert.equal(describeMask('hd_moisture_output.png'), null);
  assert.equal(describeMask('hd_droopy_upper_eyelid_output.png'), null);
});

test('only one whitelisted map per confirmed priority is selected', () => {
  const selected = selectPriorityMasks(providerMasks, priorities, 'none');
  assert.deepEqual(selected.map((item) => item.name), ['hd_pore_output_all.png', 'hd_wrinkle_output_all.png', 'hd_texture_output.png']);
});

test('facial hair removes sensitive maps and whole-face wrinkle overlays', () => {
  const selected = selectPriorityMasks(providerMasks, priorities, 'beard');
  assert.deepEqual(selected.map((item) => item.name), ['hd_wrinkle_output_forehead.png']);
});

test('a single scan never unlocks a map', () => {
  const selected = selectPriorityMasks(providerMasks, [{ key: 'hd_pore', stableScore: 60, observations: 1 }], 'none');
  assert.deepEqual(selected, []);
});

test('facial hair prevents sensitive metrics from becoming priorities', () => {
  const metrics = [
    { key: 'hd_pore', stableScore: 55 },
    { key: 'hd_texture', stableScore: 61 },
    { key: 'hd_wrinkle', stableScore: 70 },
    { key: 'hd_dark_circles', stableScore: 72 }
  ];
  assert.deepEqual(selectReliablePriorities(metrics, 'beard').map((item) => item.key), ['hd_wrinkle', 'hd_dark_circles']);
  assert.deepEqual(selectReliablePriorities(metrics, 'none').map((item) => item.key), ['hd_pore', 'hd_texture', 'hd_wrinkle']);
});
