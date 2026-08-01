import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLH_LEARNER_ROUTE_RESOLVER_VERSION,
  assignmentMatchesLearner,
  completionKey,
  matchingAssignments,
  normalizeAssignment,
  normalizeLearner,
  resolveAssignmentDestination,
  resolveLearnerRoute,
  resolveLearnerRouteMatrix
} from '../modules/learner-route-resolver.mjs';

const assignments = [
  { id:'learn-lower', student:'lower', kind:'learn', screen:'lib-botany', label:'Lower learn' },
  { id:'learn-upper', student:'upper', kind:'learn', screen:'lib-biology', label:'Upper learn' },
  { id:'practice-upper', student:'track:upper', kind:'practice', screen:'biology', label:'Upper practice' },
  { id:'feedback-all', student:'all', kind:'feedback', screen:'portfolio', label:'Feedback' },
  { id:'proof-jordan', student:'student:stu_jordan', kind:'proof', screen:'assignments', label:'Jordan proof' }
];
const screens = ['home','study','lessonplayer','quizzes-tests','assignments','portfolio','lib-botany','lib-biology','biology'];

function upper() { return { id:'stu_jordan', name:'Jordan', levelId:'upper' }; }
function lower() { return { id:'stu_avery', name:'Avery', levelId:'lower' }; }

test('preserves exact lower and upper learner route selection', () => {
  assert.equal(resolveLearnerRoute({ kind:'learn', learner:lower(), assignments, availableScreens:screens }).assignment.id, 'learn-lower');
  assert.equal(resolveLearnerRoute({ kind:'learn', learner:upper(), assignments, availableScreens:screens }).assignment.id, 'learn-upper');
  assert.equal(resolveLearnerRoute({ kind:'proof', learner:upper(), assignments, availableScreens:screens }).assignment.id, 'proof-jordan');
  assert.equal(resolveLearnerRoute({ kind:'feedback', learner:lower(), assignments, availableScreens:screens }).assignment.id, 'feedback-all');
});

test('prefers unfinished work then deterministically repeats the first matching assignment', () => {
  const list = [
    { id:'first', student:'upper', kind:'learn', screen:'lib-biology' },
    { id:'second', student:'upper', kind:'learn', screen:'study' }
  ];
  const completed = { [completionKey('stu_jordan','first')]: { at:'now' } };
  const next = resolveLearnerRoute({ kind:'learn', learner:upper(), assignments:list, completed, availableScreens:screens });
  assert.equal(next.assignment.id, 'second');
  assert.equal(next.reasonCode, 'NEXT_UNFINISHED_ASSIGNMENT');
  completed[completionKey('stu_jordan','second')] = { at:'now' };
  const repeat = resolveLearnerRoute({ kind:'learn', learner:upper(), assignments:list, completed, availableScreens:screens });
  assert.equal(repeat.assignment.id, 'first');
  assert.equal(repeat.reasonCode, 'REPEAT_FIRST_MATCHING_ASSIGNMENT');
});

test('supports legacy, canonical, and named track targets without widening access', () => {
  assert.equal(assignmentMatchesLearner({ id:'a', student:'upper', kind:'learn', screen:'study' }, upper()), true);
  assert.equal(assignmentMatchesLearner({ id:'b', student:'track:lower', kind:'learn', screen:'study' }, lower()), true);
  assert.equal(assignmentMatchesLearner({ id:'c', student:'Jordan / upper track', kind:'learn', screen:'study' }, upper()), true);
  assert.equal(assignmentMatchesLearner({ id:'d', student:'student:stu_avery', kind:'learn', screen:'study' }, upper()), false);
  assert.equal(assignmentMatchesLearner({ id:'e', student:'not valid !', kind:'learn', screen:'study' }, lower()), false);
});

test('uses a deterministic lower-track fallback for incomplete learner mappings', () => {
  const learner = normalizeLearner({ id:'guest' });
  assert.equal(learner.track, 'lower');
  assert.ok(learner.warnings.includes('LEARNER_TRACK_DEFAULTED'));
  const resolved = resolveLearnerRoute({ kind:'learn', learner:{ id:'guest' }, assignments, availableScreens:screens });
  assert.equal(resolved.assignment.id, 'learn-lower');
});

test('falls back safely when an assignment or destination is missing', () => {
  const noAssignment = resolveLearnerRoute({ kind:'proof', learner:lower(), assignments, availableScreens:screens });
  assert.equal(noAssignment.assignment, null);
  assert.equal(noAssignment.screen, 'assignments');
  assert.equal(noAssignment.reasonCode, 'NO_MATCHING_ASSIGNMENT');

  const missingDestination = resolveLearnerRoute({
    kind:'learn', learner:lower(), assignments:[{ id:'x', student:'lower', kind:'learn', label:'Missing screen' }], availableScreens:screens
  });
  assert.equal(missingDestination.assignment.id, 'x');
  assert.equal(missingDestination.screen, 'study');
  assert.equal(missingDestination.reasonCode, 'ASSIGNMENT_DESTINATION_MISSING');
  assert.equal(missingDestination.usedFallback, true);

  const unavailableFallback = resolveLearnerRoute({
    kind:'practice', learner:lower(), assignments:[], availableScreens:['home']
  });
  assert.equal(unavailableFallback.screen, 'home');
});

test('direct assignment resolution enforces learner applicability and destination safety', () => {
  const allowed = resolveAssignmentDestination({ assignmentId:'proof-jordan', learner:upper(), assignments, availableScreens:screens });
  assert.equal(allowed.screen, 'assignments');
  assert.equal(allowed.exactDestination, true);
  const denied = resolveAssignmentDestination({ assignmentId:'proof-jordan', learner:lower(), assignments, availableScreens:screens });
  assert.equal(denied.assignment, null);
  assert.equal(denied.screen, 'home');
  assert.equal(denied.reasonCode, 'ASSIGNMENT_NOT_FOUND_OR_NOT_APPLICABLE');
});

test('skips malformed and duplicate assignments deterministically', () => {
  const result = matchingAssignments({
    learner:upper(),
    assignments:[
      { id:'same', student:'upper', kind:'learn', screen:'study' },
      { id:'same', student:'upper', kind:'learn', screen:'lib-biology' },
      { id:'bad-kind', student:'upper', kind:'launch', screen:'study' },
      null
    ]
  });
  assert.deepEqual(result.items.map(item => item.id), ['same']);
  assert.ok(result.diagnostics.some(item => item.code === 'DUPLICATE_ASSIGNMENT_ID_SKIPPED'));
  assert.ok(result.diagnostics.some(item => item.code === 'UNKNOWN_ROUTE_KIND'));
  assert.ok(result.diagnostics.some(item => item.code === 'INVALID_OBJECT'));
});

test('unknown route kinds fail closed to Home', () => {
  const result = resolveLearnerRoute({ kind:'launch', learner:upper(), assignments, availableScreens:screens });
  assert.equal(result.assignment, null);
  assert.equal(result.screen, 'home');
  assert.equal(result.reasonCode, 'UNKNOWN_ROUTE_KIND');
});

test('rejects dangerous objects and returns defensive frozen results', () => {
  const polluted = Object.create({ bad:true });
  polluted.id = 'bad'; polluted.kind = 'learn'; polluted.screen = 'study';
  assert.throws(() => normalizeAssignment(polluted), error => error.code === 'INVALID_PROTOTYPE');
  const matrix = resolveLearnerRouteMatrix({ learner:upper(), assignments, availableScreens:screens });
  assert.equal(matrix.version, BLH_LEARNER_ROUTE_RESOLVER_VERSION);
  assert.equal(Object.isFrozen(matrix), true);
  assert.equal(Object.isFrozen(matrix.routes.learn), true);
});
