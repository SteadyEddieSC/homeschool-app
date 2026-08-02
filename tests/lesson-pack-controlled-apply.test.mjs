import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLH_LESSON_PACK_CONTROLLED_APPLY_VERSION,
  BLH_LESSON_PACK_CONTROLLED_APPLY_SCHEMA,
  BLHLessonPackControlledApplyError,
  createControlledApplyPlan,
  normalizeControlledApplyWorkspace,
  applyControlledOverlay,
  rollbackControlledOverlay,
  createStudentSafeOverlay,
  activeOverlaysForTarget
} from '../modules/lesson-pack-controlled-apply.mjs';

const NOW = '2026-08-02T12:00:00.000Z';

function pack(overrides = {}) {
  return {
    id: 'lp_synthetic_science',
    title: 'Synthetic science pack',
    subject: 'Honors Biology',
    track: 'Upper learner',
    targetWeekId: 'week_01',
    targetScreen: 'biology',
    status: 'ready',
    objective: 'Explain a synthetic cell model.',
    sections: [
      { id: 'section_learn', title: 'Learn', body: 'Read the original synthetic explanation.' },
      { id: 'section_proof', title: 'Proof', body: 'Explain the model in your own words.' }
    ],
    practicePrompts: ['Sort the synthetic cell cards.'],
    labPrompts: ['Build a stand-in model and label it.'],
    mediaNeeds: {
      heroImage: true,
      supportingImages: false,
      diagramOrMap: true,
      sourceLicenseReview: true,
      altText: true,
      notes: 'Original synthetic diagram plan.'
    },
    noEquipmentPath: {
      enabled: true,
      directions: 'Use paper cards and household objects.',
      evidence: 'Photo or oral explanation.'
    },
    updatedAt: NOW,
    ...overrides
  };
}

function selection(overrides = {}) {
  return {
    objective: true,
    sectionIds: ['section_proof'],
    practicePrompts: true,
    labPrompts: false,
    noEquipmentPath: true,
    mediaPlan: true,
    ...overrides
  };
}

function review(overrides = {}) {
  return {
    rightsAttested: true,
    mediaReviewed: true,
    noEquipmentReviewed: true,
    reviewerRole: 'parent',
    auditNote: 'Reviewed synthetic content and target fit.',
    ...overrides
  };
}

function emptyWorkspace() {
  return {
    version: BLH_LESSON_PACK_CONTROLLED_APPLY_VERSION,
    schemaVersion: BLH_LESSON_PACK_CONTROLLED_APPLY_SCHEMA,
    overlays: [],
    audit: []
  };
}

function errorCode(callback) {
  try {
    callback();
    return '';
  } catch (error) {
    assert.ok(error instanceof BLHLessonPackControlledApplyError);
    return error.code;
  }
}

test('exposes the schema-1 controlled-apply contract', () => {
  assert.equal(BLH_LESSON_PACK_CONTROLLED_APPLY_VERSION, 'v10.43');
  assert.equal(BLH_LESSON_PACK_CONTROLLED_APPLY_SCHEMA, 1);
});

test('creates a deterministic selective plan', () => {
  const source = pack();
  const plan = createControlledApplyPlan(source, selection(), review(), { now: NOW });
  assert.equal(plan.sourcePackId, source.id);
  assert.deepEqual(plan.selection.sectionIds, ['section_proof']);
  assert.equal(plan.content.sections[0].title, 'Proof');
  assert.equal(plan.content.practicePrompts.length, 1);
  assert.equal(plan.content.labPrompts.length, 0);
  assert.equal(plan.review.rightsAttested, true);
  assert.match(plan.fingerprint, /^[a-f0-9]{16}$/);
  assert.ok(Object.isFrozen(plan));
});

test('requires ready status before controlled apply', () => {
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack({ status: 'draft' }), selection(), review(), { now: NOW })),
    'PACK_NOT_READY'
  );
});

test('requires at least one student-facing component', () => {
  const none = selection({
    objective: false,
    sectionIds: [],
    practicePrompts: false,
    labPrompts: false,
    noEquipmentPath: false,
    mediaPlan: false
  });
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack(), none, review(), { now: NOW })),
    'EMPTY_SELECTION'
  );
});

test('requires explicit original or authorized content attestation', () => {
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack(), selection(), review({ rightsAttested: false }), { now: NOW })),
    'RIGHTS_ATTESTATION_REQUIRED'
  );
});

test('requires media review only when media is selected', () => {
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack(), selection(), review({ mediaReviewed: false }), { now: NOW })),
    'MEDIA_REVIEW_REQUIRED'
  );
  const plan = createControlledApplyPlan(
    pack(),
    selection({ mediaPlan: false }),
    review({ mediaReviewed: false }),
    { now: NOW }
  );
  assert.equal(plan.selection.mediaPlan, false);
});

test('requires no-equipment review only when that path is selected', () => {
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack(), selection(), review({ noEquipmentReviewed: false }), { now: NOW })),
    'NO_EQUIPMENT_REVIEW_REQUIRED'
  );
  const plan = createControlledApplyPlan(
    pack(),
    selection({ noEquipmentPath: false }),
    review({ noEquipmentReviewed: false }),
    { now: NOW }
  );
  assert.equal(plan.selection.noEquipmentPath, false);
});

test('rejects unauthorized reviewer roles', () => {
  assert.equal(
    errorCode(() => createControlledApplyPlan(pack(), selection(), review({ reviewerRole: 'director' }), { now: NOW })),
    'ROLE_NOT_ALLOWED'
  );
});

test('apply creates a separate overlay and audit without mutating the source pack', () => {
  const source = pack();
  const before = JSON.stringify(source);
  const plan = createControlledApplyPlan(source, selection(), review(), { now: NOW });
  const result = applyControlledOverlay(emptyWorkspace(), plan, {
    now: NOW,
    overlayId: 'lpo_apply_1',
    auditId: 'lpa_apply_1'
  });
  assert.equal(JSON.stringify(source), before);
  assert.equal(result.overlay.status, 'active');
  assert.equal(result.workspace.overlays.length, 1);
  assert.deepEqual(result.workspace.audit.map(entry => entry.action), ['apply']);
});

test('duplicate active fingerprints fail closed', () => {
  const plan = createControlledApplyPlan(pack(), selection(), review(), { now: NOW });
  const first = applyControlledOverlay(emptyWorkspace(), plan, {
    now: NOW,
    overlayId: 'lpo_apply_1',
    auditId: 'lpa_apply_1'
  });
  assert.equal(
    errorCode(() => applyControlledOverlay(first.workspace, plan, { now: NOW })),
    'DUPLICATE_ACTIVE_OVERLAY'
  );
});

test('rollback deactivates the overlay and preserves append-only audit evidence', () => {
  const plan = createControlledApplyPlan(pack(), selection(), review(), { now: NOW });
  const first = applyControlledOverlay(emptyWorkspace(), plan, {
    now: NOW,
    overlayId: 'lpo_apply_1',
    auditId: 'lpa_apply_1'
  });
  const rolled = rollbackControlledOverlay(
    first.workspace,
    'lpo_apply_1',
    { reviewerRole: 'teacher', auditNote: 'Rolled back after additional review.' },
    { now: '2026-08-03T12:00:00.000Z', auditId: 'lpa_rollback_1' }
  );
  assert.equal(rolled.overlay.status, 'rolled-back');
  assert.equal(rolled.workspace.overlays.length, 1);
  assert.deepEqual(rolled.workspace.audit.map(entry => entry.action), ['apply', 'rollback']);
  assert.equal(
    errorCode(() => rollbackControlledOverlay(rolled.workspace, 'lpo_apply_1', review())),
    'OVERLAY_NOT_ACTIVE'
  );
});

test('student-safe projection and target filtering omit adult-only fields and reject dangerous workspaces', () => {
  const plan = createControlledApplyPlan(pack(), selection(), review(), { now: NOW });
  const { overlay, workspace } = applyControlledOverlay(emptyWorkspace(), plan, {
    now: NOW,
    overlayId: 'lpo_apply_1',
    auditId: 'lpa_apply_1'
  });
  const safe = createStudentSafeOverlay(overlay);
  assert.equal(safe.title, overlay.title);
  assert.equal('auditNote' in safe, false);
  assert.equal('reviewerRole' in safe, false);
  assert.equal('rightsAttested' in safe, false);
  assert.equal('rolledBackAt' in safe, false);
  assert.equal(activeOverlaysForTarget(workspace, { screen: 'biology', weekId: 'week_01' }).length, 1);
  assert.equal(activeOverlaysForTarget(workspace, { screen: 'biology', weekId: 'week_99' }).length, 0);
  assert.equal(
    errorCode(() => normalizeControlledApplyWorkspace({ schemaVersion: 2, overlays: [], audit: [] })),
    'UNSUPPORTED_SCHEMA'
  );
  assert.equal(
    errorCode(() => normalizeControlledApplyWorkspace(JSON.parse('{"__proto__":{"polluted":true}}'))),
    'DANGEROUS_KEY'
  );
});
