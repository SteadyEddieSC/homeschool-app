import assert from 'node:assert/strict';
import test from 'node:test';

import { exportState, parseImport } from '../modules/data-adapter.mjs';

test('deterministic demo profile survives a portable round trip', () => {
  const state = {
    students: [
      { id: 'stu_jordan', name: 'Jordan' },
      { id: 'stu_avery', name: 'Avery' }
    ],
    curriculum: { weeks: [] },
    progress: {},
    demoProfile: {
      synthetic: true,
      familyName: 'Demo Family',
      scenario: 'active',
      schema: 'beaufortLearningHarbor.demo.v1',
      deterministicSeed: 'blh-v10.33-demo-family'
    }
  };

  const envelope = parseImport(exportState(state));
  assert.deepEqual(envelope.state.demoProfile, state.demoProfile);
});
