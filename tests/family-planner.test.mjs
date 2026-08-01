import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLH_FAMILY_PLANNER_FORMAT,
  BLH_FAMILY_PLANNER_KIND,
  BLH_FAMILY_PLANNER_SCHEMA,
  BLHFamilyPlannerError,
  createFamilyPlannerPackage,
  normalizeFamilyPlannerWorkspace,
  parseFamilyPlannerPackage,
  serializeFamilyPlannerPackage
} from '../modules/family-planner.mjs';

function sampleItem(overrides = {}) {
  return {
    id: 'fp_item_1',
    title: 'Synthetic biology co-op lab',
    day: 'Tuesday',
    startTime: '09:00',
    endTime: '10:30',
    targetKind: 'track',
    targetId: 'upper',
    subject: 'Honors Biology',
    itemType: 'co-op',
    status: 'ready',
    location: 'Synthetic Community Room',
    sourceScreen: 'lessonpacks',
    sourceId: 'lp_synthetic_1',
    coOp: {
      enabled: true,
      eventName: 'Synthetic lab day',
      role: 'Teacher lead',
      materials: 'Paper cards and safe household objects',
      arrivalNotes: 'Arrive ten minutes early.',
      followUpOwner: 'Parent reviewer'
    },
    studentDirections: 'Complete the original synthetic lab and explain the model.',
    adultNotes: 'Synthetic coordination note.',
    order: 0,
    carriedFromId: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

function samplePlanner(overrides = {}) {
  return {
    activeWeekId: 'week_1',
    weeks: [{
      weekId: 'week_1',
      mode: 'co-op-heavy',
      familyNotes: 'Synthetic family note.',
      coOpNotes: 'Synthetic co-op note.',
      updatedAt: '2026-08-01T00:00:00.000Z',
      items: [sampleItem()]
    }],
    ...overrides
  };
}

function expectPlannerError(fn, code) {
  assert.throws(fn, error => {
    assert.ok(error instanceof BLHFamilyPlannerError);
    assert.equal(error.code, code);
    return true;
  });
}

test('creates schema-1 family planner package independent of product version', () => {
  const pkg = createFamilyPlannerPackage(samplePlanner(), { productVersion: '10.38' });
  assert.equal(pkg.format, BLH_FAMILY_PLANNER_FORMAT);
  assert.equal(pkg.kind, BLH_FAMILY_PLANNER_KIND);
  assert.equal(pkg.schemaVersion, BLH_FAMILY_PLANNER_SCHEMA);
  assert.equal(pkg.productVersion, '10.38');
  assert.equal(pkg.planner.weeks[0].mode, 'co-op-heavy');
});

test('round trip is deterministic and strips unknown properties', () => {
  const planner = samplePlanner({ unknown: 'drop me' });
  planner.weeks[0].items[0].unknown = 'drop me too';
  const first = serializeFamilyPlannerPackage(planner, { productVersion: '10.38' });
  const parsed = parseFamilyPlannerPackage(first);
  const second = serializeFamilyPlannerPackage(parsed);
  assert.equal(first, second);
  assert.equal(parsed.planner.unknown, undefined);
  assert.equal(parsed.planner.weeks[0].items[0].unknown, undefined);
  assert.ok(first.endsWith('\n'));
});

test('week and item ordering are preserved', () => {
  const planner = samplePlanner({
    activeWeekId: 'week_2',
    weeks: [
      { weekId:'week_1', mode:'standard', familyNotes:'', coOpNotes:'', items:[sampleItem({ id:'fp_a', day:'Friday', order:2 })] },
      { weekId:'week_2', mode:'catch-up', familyNotes:'', coOpNotes:'', items:[sampleItem({ id:'fp_b', day:'Monday', order:0, status:'carryover' })] }
    ]
  });
  const normalized = normalizeFamilyPlannerWorkspace(planner);
  assert.deepEqual(normalized.weeks.map(week => week.weekId), ['week_1', 'week_2']);
  assert.equal(normalized.weeks[0].items[0].id, 'fp_a');
  assert.equal(normalized.activeWeekId, 'week_2');
});

test('invalid days, types, statuses, targeting, sources, and time windows fail closed', () => {
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ day:'Sunday' })] }] })), 'INVALID_PLANNER');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ itemType:'exam' })] }] })), 'INVALID_PLANNER');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ status:'done' })] }] })), 'INVALID_PLANNER');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ targetKind:'student', targetId:'' })] }] })), 'INVALID_PLANNER');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ sourceScreen:'', sourceId:'abc' })] }] })), 'INVALID_PLANNER');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ startTime:'11:00', endTime:'09:00' })] }] })), 'INVALID_PLANNER');
});

test('co-op event name is required but role may remain empty for director warning', () => {
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ coOp:{ enabled:true, eventName:'', role:'' } })] }] })), 'INVALID_PLANNER');
  const pkg = createFamilyPlannerPackage(samplePlanner({ weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ coOp:{ enabled:true, eventName:'Synthetic event', role:'' } })] }] }));
  assert.equal(pkg.planner.weeks[0].items[0].coOp.role, '');
});

test('duplicate item and week identifiers fail closed', () => {
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({
    weeks:[{ ...samplePlanner().weeks[0], items:[sampleItem({ id:'same' }), sampleItem({ id:'same', title:'Second' })] }]
  })), 'DUPLICATE_ID');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({
    weeks:[samplePlanner().weeks[0], { ...samplePlanner().weeks[0], items:[] }]
  })), 'DUPLICATE_ID');
  expectPlannerError(() => createFamilyPlannerPackage(samplePlanner({
    activeWeekId:'week_2',
    weeks:[
      { ...samplePlanner().weeks[0], items:[sampleItem({ id:'same' })] },
      { ...samplePlanner().weeks[0], weekId:'week_2', items:[sampleItem({ id:'same' })] }
    ]
  })), 'DUPLICATE_ID');
});

test('malformed, partial, unsupported, dangerous, and polluted inputs fail closed', () => {
  expectPlannerError(() => parseFamilyPlannerPackage('{bad json'), 'MALFORMED_JSON');
  expectPlannerError(() => parseFamilyPlannerPackage({}), 'INVALID_FORMAT');
  expectPlannerError(() => parseFamilyPlannerPackage({
    format: BLH_FAMILY_PLANNER_FORMAT,
    schemaVersion: 999,
    kind: BLH_FAMILY_PLANNER_KIND,
    productVersion: '10.38',
    planner: samplePlanner()
  }), 'UNSUPPORTED_SCHEMA');
  expectPlannerError(() => parseFamilyPlannerPackage({
    format: BLH_FAMILY_PLANNER_FORMAT,
    schemaVersion: 1,
    kind: 'calendar-sync',
    productVersion: '10.38',
    planner: samplePlanner()
  }), 'UNSUPPORTED_KIND');
  expectPlannerError(() => createFamilyPlannerPackage({ activeWeekId:'week_1' }), 'INVALID_PLANNER');

  const dangerous = samplePlanner();
  Object.defineProperty(dangerous.weeks[0].items[0], '__proto__', { value:{ polluted:true }, enumerable:true });
  expectPlannerError(() => createFamilyPlannerPackage(dangerous), 'DANGEROUS_KEY');

  const inherited = samplePlanner();
  Object.setPrototypeOf(inherited, { polluted:true });
  expectPlannerError(() => createFamilyPlannerPackage(inherited), 'INVALID_PLANNER');
  assert.equal(Object.prototype.polluted, undefined);
});
