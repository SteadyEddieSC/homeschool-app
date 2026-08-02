import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLH_FAMILY_PLANNER_V2_VERSION,
  BLHFamilyPlannerV2Error,
  createWeekTemplate,
  normalizeTemplateLibrary,
  applyWeekTemplate,
  copyWeek,
  analyzeWeek,
  createLearnerSafePrintModel,
  createLearnerSafeCsv
} from '../modules/family-planner-v2.mjs';

const fixedNow = '2026-08-02T02:50:00.000Z';

function item(id, overrides = {}) {
  return {
    id,
    title:`Item ${id}`,
    day:'Monday',
    startTime:'09:00',
    endTime:'10:00',
    targetKind:'student',
    targetId:'avery',
    subject:'Botany',
    itemType:'lesson',
    status:'planned',
    location:'Home',
    sourceScreen:'assignments',
    sourceId:`src_${id}`,
    coOp:{ enabled:false, eventName:'', role:'', materials:'', arrivalNotes:'', followUpOwner:'' },
    studentDirections:'Complete the synthetic activity.',
    adultNotes:'PRIVATE ADULT NOTE',
    order:0,
    carriedFromId:'',
    createdAt:fixedNow,
    updatedAt:fixedNow,
    ...overrides
  };
}

function week(weekId, items = [], overrides = {}) {
  return { weekId, mode:'standard', familyNotes:'Family note', coOpNotes:'PRIVATE COOP NOTE', items, updatedAt:fixedNow, ...overrides };
}

test('creates a normalized reusable template from active items only', () => {
  const template = createWeekTemplate({
    week:week('week_1', [item('a'), item('archived', { status:'archived' })]),
    id:'tpl_week_1',
    name:'Normal week',
    description:'Synthetic reusable plan',
    createdAt:fixedNow
  });
  assert.equal(template.format, 'beaufort-learning-harbor-family-planner-template');
  assert.equal(template.items.length, 1);
  assert.equal(template.items[0].sourceItemId, 'a');
  assert.equal(template.name, 'Normal week');
});

test('template application is additive, deterministic, and idempotent', () => {
  const template = createWeekTemplate({ week:week('week_1', [item('a')]), id:'tpl_week_1', name:'Normal week', createdAt:fixedNow });
  const first = applyWeekTemplate({ template, targetWeek:week('week_2'), now:fixedNow });
  assert.equal(first.added, 1);
  assert.equal(first.week.items[0].carriedFromId, 'template:tpl_week_1:a');
  const second = applyWeekTemplate({ template, targetWeek:first.week, now:fixedNow });
  assert.equal(second.added, 0);
  assert.deepEqual(second.skipped, ['a']);
  assert.equal(second.week.items.length, 1);
});

test('duplicate week preserves source and avoids duplicate linked copies', () => {
  const source = week('week_1', [item('a'), item('b', { day:'Tuesday', status:'ready' })]);
  const target = week('week_2');
  const first = copyWeek({ sourceWeek:source, targetWeek:target, operation:'duplicate', now:fixedNow });
  assert.equal(first.added, 2);
  assert.deepEqual(source.items.map(entry => entry.id), ['a', 'b']);
  assert.equal(first.week.items[1].status, 'ready');
  const second = copyWeek({ sourceWeek:source, targetWeek:first.week, operation:'duplicate', now:fixedNow });
  assert.equal(second.added, 0);
  assert.equal(second.week.items.length, 2);
});

test('roll-forward creates explicit carryover and skips archived work', () => {
  const source = week('week_1', [item('a'), item('archived', { status:'archived' })]);
  const result = copyWeek({ sourceWeek:source, targetWeek:week('week_2'), operation:'roll-forward', now:fixedNow });
  assert.equal(result.added, 1);
  assert.equal(result.week.items[0].status, 'carryover');
  assert.equal(result.week.items[0].carriedFromId, 'roll-forward:week_1:a');
});

test('same-week copying fails closed', () => {
  assert.throws(() => copyWeek({ sourceWeek:week('week_1'), targetWeek:week('week_1') }), error => error instanceof BLHFamilyPlannerV2Error && error.code === 'SAME_WEEK');
});

test('analysis detects overloads, target-aware time conflicts, and responsibility gaps', () => {
  const entries = [
    item('a', { startTime:'09:00', endTime:'10:30' }),
    item('b', { startTime:'10:00', endTime:'11:00' }),
    item('c', { day:'Tuesday', targetKind:'track', targetId:'lower', coOp:{ enabled:true, eventName:'Lab day', role:'', materials:'Cards', arrivalNotes:'PRIVATE', followUpOwner:'' } })
  ];
  const analysis = analyzeWeek({ week:week('week_1', entries), students:[{ id:'avery', name:'Avery', levelId:'lower' }], learningLevels:[{ id:'lower', name:'Lower track' }], maxItemsPerDay:1, maxItemsPerTarget:1 });
  assert.equal(analysis.version, BLH_FAMILY_PLANNER_V2_VERSION);
  assert.equal(analysis.conflicts.length, 1);
  assert.equal(analysis.responsibilityGaps.length, 1);
  assert.ok(analysis.workloadWarnings.some(entry => entry.code === 'DAY_OVERLOAD'));
  assert.ok(analysis.workloadWarnings.some(entry => entry.code === 'TARGET_OVERLOAD'));
});

test('unrelated targets do not produce false time conflicts', () => {
  const analysis = analyzeWeek({
    week:week('week_1', [
      item('a', { targetId:'avery' }),
      item('b', { targetId:'jordan' })
    ]),
    students:[{ id:'avery', levelId:'lower' }, { id:'jordan', levelId:'upper' }]
  });
  assert.equal(analysis.conflicts.length, 0);
});

test('learner-safe print and CSV omit adult-only notes and arrival notes', () => {
  const source = week('week_1', [item('a', { coOp:{ enabled:true, eventName:'Lab', role:'Teacher', materials:'Paper', arrivalNotes:'PRIVATE ARRIVAL', followUpOwner:'Parent' } })]);
  const model = createLearnerSafePrintModel({ week:source, students:[{ id:'avery', name:'Avery' }] });
  const serialized = JSON.stringify(model);
  assert.equal(serialized.includes('PRIVATE ADULT NOTE'), false);
  assert.equal(serialized.includes('PRIVATE COOP NOTE'), false);
  assert.equal(serialized.includes('PRIVATE ARRIVAL'), false);
  const csv = createLearnerSafeCsv({ week:source, students:[{ id:'avery', name:'Avery' }] });
  assert.equal(csv.includes('PRIVATE'), false);
  assert.match(csv, /"Avery"/);
});

test('dangerous template keys and duplicate template IDs fail closed', () => {
  const template = createWeekTemplate({ week:week('week_1', [item('a')]), id:'tpl_one', name:'One', createdAt:fixedNow });
  assert.throws(() => normalizeTemplateLibrary([template, template]), /Duplicate template id/);
  const dangerous = JSON.parse('{"id":"tpl_bad","name":"Bad","mode":"standard","items":[],"__proto__":{"polluted":true}}');
  assert.throws(() => normalizeTemplateLibrary([dangerous]), error => error instanceof BLHFamilyPlannerV2Error && error.code === 'DANGEROUS_KEY');
  assert.equal(Object.prototype.polluted, undefined);
});
