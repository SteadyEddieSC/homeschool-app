import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLHLessonPackApplyError,
  applyLessonPackOverlay,
  createLessonPackApplyPlan,
  createStudentSafeLessonPackOverlay,
  fingerprintLessonPackOverlayPlan,
  listActiveLessonPackOverlays,
  normalizeLessonPackControlledApplyWorkspace,
  rollbackLessonPackOverlay
} from '../modules/lesson-pack-controlled-apply.mjs';

function samplePack(overrides = {}) {
  return {
    id: 'lp_synthetic_botany',
    title: 'Synthetic botany observation pack',
    subject: 'Botany',
    track: 'Lower learner',
    targetWeekId: 'week_1',
    targetScreen: 'botany',
    status: 'ready',
    objective: 'Explain how a synthetic plant structure supports its function.',
    sections: [
      { id: 'section_learn', title: 'Learn', body: 'Read the original synthetic explanation.' },
      { id: 'section_check', title: 'Check', body: 'Compare two synthetic structures.' }
    ],
    practicePrompts: ['Name the structure.', 'Explain its function.'],
    labPrompts: ['Observe a safe household leaf or use the no-equipment card.'],
    mediaNeeds: {
      heroImage: true,
      supportingImages: true,
      diagramOrMap: true,
      sourceLicenseReview: true,
      altText: true,
      notes: 'Use a public-domain diagram.'
    },
    noEquipmentPath: {
      enabled: true,
      directions: 'Use paper index cards to model the parts.',
      evidence: 'Submit a labeled sketch and oral explanation.'
    },
    adultNotes: 'Never student-facing.',
    updatedAt: '2026-08-02T12:00:00.000Z',
    ...overrides
  };
}

function sampleRequest(overrides = {}) {
  return {
    targetScreen: 'botany',
    targetWeekId: 'week_1',
    selection: {
      includeObjective: true,
      sectionIds: ['section_learn'],
      includePractice: true,
      includeLabs: true,
      includeNoEquipment: true,
      includeMediaPlan: true
    },
    contentRightsAttested: true,
    mediaLicenseReviewed: true,
    mediaProvenanceReviewed: true,
    auditNote: 'Reviewed for local family use.',
    ...overrides
  };
}

function expectError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof BLHLessonPackApplyError);
    assert.equal(error.code, code);
    return true;
  });
}

test('apply plan is deterministic and does not mutate the source pack', () => {
  const pack = samplePack();
  const snapshot = structuredClone(pack);
  const first = createLessonPackApplyPlan({}, pack, sampleRequest());
  const second = createLessonPackApplyPlan({}, pack, sampleRequest());
  assert.deepEqual(first, second);
  assert.deepEqual(pack, snapshot);
  assert.equal(first.after.fingerprint, fingerprintLessonPackOverlayPlan({
    content: first.after.content,
    selection: first.request.selection,
    sourcePack: {
      id: first.sourcePack.id,
      subject: first.sourcePack.subject,
      targetScreen: first.request.targetScreen,
      targetWeekId: first.request.targetWeekId,
      title: first.sourcePack.title,
      track: first.sourcePack.track,
      updatedAt: first.sourcePack.updatedAt
    }
  }));
});

test('apply requires ready status, a selection, rights attestation, media review, and audit note', () => {
  expectError(() => createLessonPackApplyPlan({}, samplePack({ status: 'draft' }), sampleRequest()), 'PACK_NOT_READY');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ selection: {} })), 'EMPTY_SELECTION');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ contentRightsAttested: false })), 'RIGHTS_ATTESTATION_REQUIRED');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ mediaLicenseReviewed: false })), 'MEDIA_REVIEW_REQUIRED');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ auditNote: '' })), 'INVALID_APPLY');
});

test('apply creates one browser-local overlay and audit entry without rewriting source content', () => {
  const pack = samplePack();
  const sourceSnapshot = structuredClone(pack);
  const result = applyLessonPackOverlay({}, pack, sampleRequest(), {
    role: 'teacher',
    now: '2026-08-02T13:00:00.000Z',
    id: 'overlay_one',
    auditId: 'audit_apply_one'
  });
  assert.deepEqual(pack, sourceSnapshot);
  assert.equal(result.overlay.status, 'active');
  assert.equal(result.workspace.overlays.length, 1);
  assert.equal(result.workspace.audit.length, 1);
  assert.equal(result.workspace.audit[0].action, 'apply');
  assert.equal(result.overlay.content.sections.length, 1);
  assert.equal(result.overlay.content.sections[0].id, 'section_learn');
});

test('identical active fingerprints fail closed instead of silently duplicating', () => {
  const first = applyLessonPackOverlay({}, samplePack(), sampleRequest(), {
    role: 'parent', now: '2026-08-02T13:00:00.000Z', id: 'overlay_one', auditId: 'audit_one'
  });
  expectError(() => applyLessonPackOverlay(first.workspace, samplePack(), sampleRequest(), {
    role: 'parent', now: '2026-08-02T13:01:00.000Z', id: 'overlay_two', auditId: 'audit_two'
  }), 'DUPLICATE_ACTIVE_OVERLAY');
});

test('new apply supersedes destination overlay and rollback restores the prior active state', () => {
  const first = applyLessonPackOverlay({}, samplePack(), sampleRequest(), {
    role: 'parent', now: '2026-08-02T13:00:00.000Z', id: 'overlay_one', auditId: 'audit_one'
  });
  const secondPack = samplePack({
    id: 'lp_synthetic_botany_revised',
    title: 'Revised synthetic botany pack',
    objective: 'Compare two synthetic plant structures.',
    updatedAt: '2026-08-02T13:05:00.000Z'
  });
  const second = applyLessonPackOverlay(first.workspace, secondPack, sampleRequest(), {
    role: 'admin', now: '2026-08-02T13:10:00.000Z', id: 'overlay_two', auditId: 'audit_two'
  });
  assert.deepEqual(listActiveLessonPackOverlays(second.workspace).map(item => item.id), ['overlay_two']);
  assert.equal(second.workspace.overlays.find(item => item.id === 'overlay_one').status, 'superseded');
  const rolled = rollbackLessonPackOverlay(second.workspace, 'overlay_two', { auditNote: 'Revert after family review.' }, {
    role: 'admin', now: '2026-08-02T13:15:00.000Z', auditId: 'audit_rollback_two'
  });
  assert.deepEqual(listActiveLessonPackOverlays(rolled.workspace).map(item => item.id), ['overlay_one']);
  assert.equal(rolled.workspace.overlays.find(item => item.id === 'overlay_two').status, 'rolled-back');
  assert.equal(rolled.workspace.audit.at(-1).action, 'rollback');
});

test('student-safe rendering excludes adult governance and reviewer details', () => {
  const result = applyLessonPackOverlay({}, samplePack(), sampleRequest(), {
    role: 'teacher', now: '2026-08-02T13:00:00.000Z', id: 'overlay_one', auditId: 'audit_one'
  });
  const safe = createStudentSafeLessonPackOverlay(result.overlay);
  const serialized = JSON.stringify(safe);
  assert.equal(safe.source.title, 'Synthetic botany observation pack');
  assert.equal(serialized.includes('adultNotes'), false);
  assert.equal(serialized.includes('auditNote'), false);
  assert.equal(serialized.includes('rightsAttested'), false);
  assert.equal(serialized.includes('appliedByRole'), false);
  assert.equal(serialized.includes('rollback'), false);
});

test('role, target, malformed, duplicate section, dangerous-key, and prototype-pollution inputs fail closed', () => {
  expectError(() => applyLessonPackOverlay({}, samplePack(), sampleRequest(), { role: 'student' }), 'ROLE_DENIED');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ targetScreen: 'biology' })), 'TARGET_MISMATCH');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ selection: { includeObjective: true, sectionIds: ['missing'] } })), 'UNKNOWN_SECTION');
  expectError(() => createLessonPackApplyPlan({}, samplePack(), sampleRequest({ selection: { includeObjective: true, sectionIds: ['section_learn', 'section_learn'] } })), 'DUPLICATE_ID');
  const dangerous = sampleRequest();
  Object.defineProperty(dangerous, '__proto__', { value: { polluted: true }, enumerable: true });
  expectError(() => createLessonPackApplyPlan({}, samplePack(), dangerous), 'DANGEROUS_KEY');
  const inherited = sampleRequest();
  Object.setPrototypeOf(inherited, { polluted: true });
  expectError(() => createLessonPackApplyPlan({}, samplePack(), inherited), 'INVALID_APPLY');
  assert.equal(Object.prototype.polluted, undefined);
});

test('workspace normalization stays bounded and strips unknown fields', () => {
  let workspace = {};
  for (let index = 0; index < 55; index += 1) {
    const pack = samplePack({
      id: `lp_${index}`,
      title: `Synthetic pack ${index}`,
      objective: `Synthetic objective ${index}`,
      updatedAt: `2026-08-02T14:${String(index).padStart(2, '0')}:00.000Z`
    });
    const result = applyLessonPackOverlay(workspace, pack, sampleRequest(), {
      role: 'parent',
      now: `2026-08-03T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`,
      id: `overlay_${index}`,
      auditId: `audit_${index}`
    });
    workspace = result.workspace;
  }
  const normalized = normalizeLessonPackControlledApplyWorkspace({ ...workspace, unknown: 'drop' });
  assert.ok(normalized.overlays.length <= 50);
  assert.ok(normalized.audit.length <= 50);
  assert.equal(normalized.unknown, undefined);
});
