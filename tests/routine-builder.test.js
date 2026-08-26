import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRoutine, requiredProfileFields, validateRoutineProfile } from '../lib/routine-builder.js';

const base = Object.freeze({
  skinType: 'normal', sensitivity: 'no', goal: 'maintain', activeUse: 'no', knownReactions: 'no', adultConsent: true
});

test('routine matrix is deterministic, complete and free of intensive ingredients', () => {
  const dimensions = {
    skinType: ['dry', 'normal', 'combination', 'oily', 'unsure'],
    sensitivity: ['yes', 'sometimes', 'no'],
    goal: ['comfort', 'blemishes', 'texture', 'lines', 'maintain'],
    activeUse: ['yes', 'no'],
    knownReactions: ['yes', 'no']
  };
  let combinations = 0;
  for (const skinType of dimensions.skinType) for (const sensitivity of dimensions.sensitivity) {
    for (const goal of dimensions.goal) for (const activeUse of dimensions.activeUse) for (const knownReactions of dimensions.knownReactions) {
      const profile = { skinType, sensitivity, goal, activeUse, knownReactions, adultConsent: true };
      const first = buildRoutine(profile);
      assert.deepEqual(first, buildRoutine(profile));
      assert.ok(first.morning.length >= 2);
      assert.ok(first.evening.length >= 2);
      const text = [...first.morning, ...first.evening, ...first.cautions].join(' ');
      assert.match(text, /idrat/i);
      assert.match(text, /protezione solare/i);
      assert.match(text, /detergente/i);
      assert.doesNotMatch(text, /retino|salicil|glicol|mandelic|tretin|adapalen|benzoil/i);
      combinations += 1;
    }
  }
  assert.equal(combinations, 300);
});

test('sensitivity, current actives and known reactions reduce steps and add cautions', () => {
  const standard = buildRoutine(base);
  for (const change of [
    { sensitivity: 'yes' },
    { sensitivity: 'sometimes' },
    { activeUse: 'yes' },
    { knownReactions: 'yes' }
  ]) {
    const cautious = buildRoutine({ ...base, ...change });
    assert.equal(cautious.minimalMode, true);
    assert.ok(cautious.morning.length < standard.morning.length);
    assert.ok(cautious.cautions.length > standard.cautions.length);
  }
});

test('every required field changes output or activates the adult gate', () => {
  const alternatives = {
    skinType: 'dry', sensitivity: 'yes', goal: 'comfort', activeUse: 'yes', knownReactions: 'yes'
  };
  const baseline = buildRoutine(base);
  for (const [field, value] of Object.entries(alternatives)) {
    assert.notDeepEqual(buildRoutine({ ...base, [field]: value }), baseline, `${field} must affect output`);
  }
  const withoutConsent = { ...base, adultConsent: false };
  assert.deepEqual(validateRoutineProfile(withoutConsent).errors, ['adultConsent']);
  assert.throws(() => buildRoutine(withoutConsent), /Profilo incompleto/);
  assert.deepEqual([...requiredProfileFields].sort(), ['activeUse', 'adultConsent', 'goal', 'knownReactions', 'sensitivity', 'skinType'].sort());
});

test('invalid or missing values fail closed', () => {
  assert.equal(validateRoutineProfile({}).valid, false);
  for (const field of requiredProfileFields) {
    const invalid = { ...base };
    delete invalid[field];
    assert.ok(validateRoutineProfile(invalid).errors.includes(field));
    assert.throws(() => buildRoutine(invalid));
  }
});
