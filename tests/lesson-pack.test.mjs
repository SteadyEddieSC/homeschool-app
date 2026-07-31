import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLH_LESSON_PACK_FORMAT,
  BLH_LESSON_PACK_KIND,
  BLH_LESSON_PACK_SCHEMA,
  BLHLessonPackError,
  createLessonPackPackage,
  parseLessonPackPackage,
  serializeLessonPackPackage
} from '../modules/lesson-pack.mjs';

function samplePack(overrides = {}) {
  return {
    id: 'lp_synthetic_botany',
    title: 'Synthetic botany observation pack',
    subject: 'Botany',
    track: 'Lower learner',
    targetWeekId: 'week_1',
    targetScreen: 'botany',
    status: 'draft',
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
    adultNotes: 'Synthetic-only planning note.',
    sourceDraftId: 'legacy_demo_1',
    createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
    ...overrides
  };
}

function expectLessonError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof BLHLessonPackError);
    assert.equal(error.code, code);
    return true;
  });
}

test('creates schema-1 lesson package independent of product version', () => {
  const pkg = createLessonPackPackage(samplePack(), { productVersion: '10.37' });
  assert.equal(pkg.format, BLH_LESSON_PACK_FORMAT);
  assert.equal(pkg.kind, BLH_LESSON_PACK_KIND);
  assert.equal(pkg.schemaVersion, BLH_LESSON_PACK_SCHEMA);
  assert.equal(pkg.productVersion, '10.37');
  assert.equal(pkg.pack.applyMode, 'draft-only');
});

test('round trip is deterministic and strips unknown fields', () => {
  const first = serializeLessonPackPackage(samplePack({ unknown: 'drop me' }), { productVersion: '10.37' });
  const parsed = parseLessonPackPackage(first);
  const second = serializeLessonPackPackage(parsed);
  assert.equal(first, second);
  assert.equal(parsed.pack.unknown, undefined);
  assert.ok(first.endsWith('\n'));
});

test('section ordering and prompt ordering are preserved', () => {
  const parsed = parseLessonPackPackage(serializeLessonPackPackage(samplePack()));
  assert.deepEqual(parsed.pack.sections.map(section => section.id), ['section_learn', 'section_check']);
  assert.deepEqual(parsed.pack.practicePrompts, ['Name the structure.', 'Explain its function.']);
});

test('enabled no-equipment path requires directions and evidence', () => {
  expectLessonError(() => createLessonPackPackage(samplePack({
    noEquipmentPath: { enabled: true, directions: '', evidence: '' }
  })), 'INVALID_PACK');
});

test('malformed and unsupported files fail closed with stable codes', () => {
  expectLessonError(() => parseLessonPackPackage('{bad json'), 'MALFORMED_JSON');
  expectLessonError(() => parseLessonPackPackage({}), 'INVALID_FORMAT');
  expectLessonError(() => parseLessonPackPackage({
    format: BLH_LESSON_PACK_FORMAT,
    schemaVersion: 999,
    kind: BLH_LESSON_PACK_KIND,
    productVersion: '10.37',
    pack: samplePack()
  }), 'UNSUPPORTED_SCHEMA');
  expectLessonError(() => parseLessonPackPackage({
    format: BLH_LESSON_PACK_FORMAT,
    schemaVersion: 1,
    kind: 'live-overlay',
    productVersion: '10.37',
    pack: samplePack()
  }), 'UNSUPPORTED_KIND');
});

test('partial packs, duplicate section ids, and unsupported status are rejected', () => {
  expectLessonError(() => createLessonPackPackage({ id: 'partial' }), 'INVALID_PACK');
  expectLessonError(() => createLessonPackPackage(samplePack({
    sections: [
      { id: 'same', title: 'A', body: 'A' },
      { id: 'same', title: 'B', body: 'B' }
    ]
  })), 'DUPLICATE_ID');
  expectLessonError(() => createLessonPackPackage(samplePack({ status: 'applied' })), 'INVALID_PACK');
});

test('dangerous keys and polluted prototypes are rejected', () => {
  const polluted = samplePack();
  Object.defineProperty(polluted, '__proto__', {
    value: { polluted: true },
    enumerable: true,
    configurable: true
  });
  expectLessonError(() => createLessonPackPackage(polluted), 'DANGEROUS_KEY');

  const inherited = samplePack();
  Object.setPrototypeOf(inherited, { polluted: true });
  expectLessonError(() => createLessonPackPackage(inherited), 'INVALID_PACK');
  assert.equal(Object.prototype.polluted, undefined);
});
