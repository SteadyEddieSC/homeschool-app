export const BLH_LEARNER_ROUTE_RESOLVER_VERSION = 'v10.41';
export const BLH_LEARNER_ROUTE_RESOLVER_SCHEMA = 1;
export const BLH_ROUTE_KINDS = Object.freeze(['learn', 'practice', 'quiz', 'proof', 'feedback']);
export const BLH_ROUTE_FALLBACKS = Object.freeze({
  learn: 'study',
  practice: 'lessonplayer',
  quiz: 'quizzes-tests',
  proof: 'assignments',
  feedback: 'portfolio'
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_ID = /^[a-z0-9][a-z0-9:_-]{0,119}$/i;
const TRACK_ALIASES = new Map([
  ['lower', 'lower'],
  ['pathfinder', 'lower'],
  ['avery', 'lower'],
  ['avery / lower track', 'lower'],
  ['younger', 'lower'],
  ['4-6', 'lower'],
  ['4th-6th', 'lower'],
  ['4th–6th', 'lower'],
  ['upper', 'upper'],
  ['trailblazer', 'upper'],
  ['jordan', 'upper'],
  ['jordan / upper track', 'upper'],
  ['older', 'upper'],
  ['8th', 'upper'],
  ['8th grade', 'upper']
]);
const ALL_ALIASES = new Set(['all', 'both', 'both learners', '*']);

export class BLHLearnerRouteResolverError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHLearnerRouteResolverError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BLHLearnerRouteResolverError('INVALID_OBJECT', `${label} must be a plain object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new BLHLearnerRouteResolverError('INVALID_PROTOTYPE', `${label} has an unsupported prototype`);
  }
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new BLHLearnerRouteResolverError('DANGEROUS_KEY', `${label} contains a dangerous key`, { key });
    }
  }
}

function cleanText(value, fallback = '', max = 700) {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.slice(0, max) || fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function normalizeTrack(value, fallback = 'lower') {
  const raw = cleanText(value, '').toLowerCase();
  if (!raw) return { track: fallback, warning: 'LEARNER_TRACK_DEFAULTED' };
  const alias = TRACK_ALIASES.get(raw);
  if (alias) return { track: alias, warning: alias === raw ? null : 'LEARNER_TRACK_ALIAS_NORMALIZED' };
  if (SAFE_ID.test(raw)) return { track: raw, warning: null };
  return { track: fallback, warning: 'LEARNER_TRACK_INVALID_DEFAULTED' };
}

export function normalizeLearner(learner, { defaultTrack = 'lower' } = {}) {
  const warnings = [];
  let source = learner;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    source = {};
    warnings.push('LEARNER_OBJECT_DEFAULTED');
  } else {
    assertPlainObject(source, 'learner');
  }
  const idRaw = cleanText(source.id ?? source.studentId, 'student', 120);
  const id = SAFE_ID.test(idRaw) ? idRaw : 'student';
  if (id !== idRaw) warnings.push('LEARNER_ID_INVALID_DEFAULTED');
  const trackResult = normalizeTrack(source.levelId ?? source.track, defaultTrack);
  if (trackResult.warning) warnings.push(trackResult.warning);
  return freezeDeep({
    id,
    name: cleanText(source.name ?? source.preferredName, 'Student', 160),
    track: trackResult.track,
    teamId: cleanText(source.teamId, '', 120),
    warnings
  });
}

function normalizeTarget(value, learnerIdHint = '') {
  const raw = cleanText(value, '').toLowerCase();
  if (!raw) return { type: 'all', value: 'all', raw: '', warning: 'ASSIGNMENT_TARGET_DEFAULTED_ALL' };
  if (ALL_ALIASES.has(raw)) return { type: 'all', value: 'all', raw, warning: raw === 'all' ? null : 'ASSIGNMENT_TARGET_ALIAS_NORMALIZED' };
  if (raw.startsWith('student:')) {
    const id = raw.slice('student:'.length).trim();
    if (!SAFE_ID.test(id)) return { type: 'invalid', value: '', raw, warning: 'ASSIGNMENT_TARGET_INVALID' };
    return { type: 'student', value: id, raw, warning: null };
  }
  if (raw.startsWith('track:')) {
    const result = normalizeTrack(raw.slice('track:'.length), '');
    if (!result.track) return { type: 'invalid', value: '', raw, warning: 'ASSIGNMENT_TARGET_INVALID' };
    return { type: 'track', value: result.track, raw, warning: result.warning };
  }
  const alias = TRACK_ALIASES.get(raw);
  if (alias) return { type: 'track', value: alias, raw, warning: alias === raw ? null : 'ASSIGNMENT_TARGET_ALIAS_NORMALIZED' };
  if (learnerIdHint && raw === learnerIdHint.toLowerCase()) return { type: 'student', value: learnerIdHint, raw, warning: null };
  if (SAFE_ID.test(raw)) return { type: 'student', value: raw, raw, warning: 'ASSIGNMENT_TARGET_LEGACY_STUDENT_ID' };
  return { type: 'invalid', value: '', raw, warning: 'ASSIGNMENT_TARGET_INVALID' };
}

export function normalizeAssignment(assignment, index = 0) {
  assertPlainObject(assignment, `assignments[${index}]`);
  const warnings = [];
  const idRaw = cleanText(assignment.id, `route-${index + 1}`, 120);
  const id = SAFE_ID.test(idRaw) ? idRaw : `route-${index + 1}`;
  if (id !== idRaw || !assignment.id) warnings.push('ASSIGNMENT_ID_DEFAULTED');
  const kind = cleanText(assignment.kind, '', 40).toLowerCase();
  if (!BLH_ROUTE_KINDS.includes(kind)) {
    throw new BLHLearnerRouteResolverError('UNKNOWN_ROUTE_KIND', `Unsupported route kind: ${kind || '(missing)'}`, { index, id });
  }
  const screenRaw = cleanText(assignment.screen ?? assignment.destination, '', 120).replace(/^screen-/, '');
  const screen = SAFE_ID.test(screenRaw) ? screenRaw : '';
  if (!screen) warnings.push(screenRaw ? 'ASSIGNMENT_SCREEN_INVALID' : 'ASSIGNMENT_SCREEN_MISSING');
  const target = normalizeTarget(assignment.student ?? assignment.assignedTo ?? assignment.target ?? assignment.track);
  if (target.warning) warnings.push(target.warning);
  return freezeDeep({
    id,
    kind,
    screen,
    target,
    label: cleanText(assignment.label ?? assignment.title, `Untitled ${kind} assignment`, 240),
    why: cleanText(assignment.why, 'Use the safest available route for this learner.', 700),
    action: cleanText(assignment.action, 'Open the assigned destination and follow its student directions.', 700),
    proof: cleanText(assignment.proof, 'Follow the existing review boundary for this activity.', 700),
    exact: cleanText(assignment.exact, '', 700),
    sourceIndex: index,
    warnings
  });
}

function normalizeAvailableScreens(value) {
  if (value === undefined || value === null) return null;
  const iterable = value instanceof Set ? [...value] : value;
  if (!Array.isArray(iterable)) throw new BLHLearnerRouteResolverError('INVALID_SCREEN_SET', 'availableScreens must be an array or Set');
  const screens = new Set();
  iterable.forEach((entry, index) => {
    const raw = cleanText(entry, '', 120).replace(/^screen-/, '');
    if (raw && SAFE_ID.test(raw)) screens.add(raw);
    else if (raw) throw new BLHLearnerRouteResolverError('INVALID_SCREEN_ID', `Invalid available screen at index ${index}: ${raw}`);
  });
  return screens;
}

function screenAvailable(screen, availableScreens) {
  if (!screen) return false;
  return availableScreens === null ? true : availableScreens.has(screen);
}

function normalizeCompleted(completed) {
  if (completed === undefined || completed === null) return {};
  assertPlainObject(completed, 'completed');
  return completed;
}

export function completionKey(learnerId, assignmentId) {
  return `${cleanText(learnerId, 'student', 120)}::${cleanText(assignmentId, 'assignment', 120)}`;
}

export function isAssignmentComplete(completed, learnerId, assignmentId) {
  const map = normalizeCompleted(completed);
  return !!map[completionKey(learnerId, assignmentId)];
}

export function assignmentMatchesLearner(assignment, learner) {
  const normalizedLearner = normalizeLearner(learner);
  const normalizedAssignment = normalizeAssignment(assignment, 0);
  const target = normalizedAssignment.target;
  if (target.type === 'all') return true;
  if (target.type === 'track') return target.value === normalizedLearner.track;
  if (target.type === 'student') return target.value.toLowerCase() === normalizedLearner.id.toLowerCase();
  return false;
}

function normalizeAssignmentList(assignments, learner) {
  if (!Array.isArray(assignments)) {
    return { assignments: [], diagnostics: [{ code: 'ASSIGNMENT_LIST_DEFAULTED_EMPTY', index: -1 }] };
  }
  const normalizedLearner = normalizeLearner(learner);
  const seen = new Set();
  const valid = [];
  const diagnostics = [];
  assignments.forEach((assignment, index) => {
    try {
      const item = normalizeAssignment(assignment, index);
      if (seen.has(item.id)) {
        diagnostics.push({ code: 'DUPLICATE_ASSIGNMENT_ID_SKIPPED', index, id: item.id });
        return;
      }
      seen.add(item.id);
      if (item.warnings.length) diagnostics.push(...item.warnings.map(code => ({ code, index, id: item.id })));
      valid.push(item);
    } catch (error) {
      diagnostics.push({ code: error.code || 'INVALID_ASSIGNMENT_SKIPPED', index, message: error.message });
    }
  });
  return { assignments: valid, diagnostics, learner: normalizedLearner };
}

export function matchingAssignments({ assignments, learner, kind = null } = {}) {
  const normalizedLearner = normalizeLearner(learner);
  const normalizedKind = kind === null || kind === undefined || kind === '' ? null : cleanText(kind, '', 40).toLowerCase();
  if (normalizedKind && !BLH_ROUTE_KINDS.includes(normalizedKind)) {
    return freezeDeep({ learner: normalizedLearner, items: [], diagnostics: [{ code: 'UNKNOWN_ROUTE_KIND', kind: normalizedKind }] });
  }
  const normalized = normalizeAssignmentList(assignments, normalizedLearner);
  const items = normalized.assignments.filter(item => {
    const target = item.target;
    const matches = target.type === 'all'
      || (target.type === 'track' && target.value === normalizedLearner.track)
      || (target.type === 'student' && target.value.toLowerCase() === normalizedLearner.id.toLowerCase());
    return matches && (!normalizedKind || item.kind === normalizedKind);
  });
  return freezeDeep({ learner: normalizedLearner, items: clone(items), diagnostics: clone(normalized.diagnostics) });
}

function chooseFallback(kind, fallbacks, availableScreens) {
  const requested = cleanText(fallbacks?.[kind], BLH_ROUTE_FALLBACKS[kind] || 'home', 120).replace(/^screen-/, '');
  if (screenAvailable(requested, availableScreens)) return { screen: requested, code: 'ROUTE_FALLBACK' };
  if (screenAvailable('home', availableScreens)) return { screen: 'home', code: 'HOME_FALLBACK' };
  return { screen: availableScreens && availableScreens.size ? [...availableScreens].sort()[0] : 'home', code: 'LAST_AVAILABLE_FALLBACK' };
}

function resolveSelectedAssignment({ item, learner, completed, availableScreens, fallback }) {
  const done = isAssignmentComplete(completed, learner.id, item.id);
  if (item.screen && screenAvailable(item.screen, availableScreens)) {
    return {
      assignment: item,
      screen: item.screen,
      exactDestination: true,
      usedFallback: false,
      completed: done,
      reasonCode: done ? 'REPEAT_FIRST_MATCHING_ASSIGNMENT' : 'NEXT_UNFINISHED_ASSIGNMENT',
      warnings: clone(item.warnings)
    };
  }
  return {
    assignment: item,
    screen: fallback.screen,
    exactDestination: false,
    usedFallback: true,
    completed: done,
    reasonCode: item.screen ? 'ASSIGNMENT_DESTINATION_UNAVAILABLE' : 'ASSIGNMENT_DESTINATION_MISSING',
    warnings: [...item.warnings, item.screen ? 'DESTINATION_NOT_AVAILABLE' : 'DESTINATION_MISSING']
  };
}

export function resolveLearnerRoute({
  kind,
  learner,
  assignments,
  completed = {},
  availableScreens = null,
  fallbacks = BLH_ROUTE_FALLBACKS
} = {}) {
  const normalizedKind = cleanText(kind, '', 40).toLowerCase();
  const normalizedLearner = normalizeLearner(learner);
  const screens = normalizeAvailableScreens(availableScreens);
  const fallback = BLH_ROUTE_KINDS.includes(normalizedKind)
    ? chooseFallback(normalizedKind, fallbacks, screens)
    : chooseFallback('unknown', { unknown: 'home' }, screens);
  if (!BLH_ROUTE_KINDS.includes(normalizedKind)) {
    return freezeDeep({
      version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,
      schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,
      kind: normalizedKind,
      learner: normalizedLearner,
      assignment: null,
      screen: fallback.screen,
      exactDestination: false,
      usedFallback: true,
      completed: false,
      reasonCode: 'UNKNOWN_ROUTE_KIND',
      warnings: ['UNKNOWN_ROUTE_KIND'],
      diagnostics: []
    });
  }
  const matches = matchingAssignments({ assignments, learner: normalizedLearner, kind: normalizedKind });
  const unfinished = matches.items.find(item => !isAssignmentComplete(completed, normalizedLearner.id, item.id));
  const selected = unfinished || matches.items[0] || null;
  const result = selected
    ? resolveSelectedAssignment({ item: selected, learner: normalizedLearner, completed, availableScreens: screens, fallback })
    : {
        assignment: null,
        screen: fallback.screen,
        exactDestination: false,
        usedFallback: true,
        completed: false,
        reasonCode: 'NO_MATCHING_ASSIGNMENT',
        warnings: ['NO_MATCHING_ASSIGNMENT']
      };
  return freezeDeep({
    version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,
    schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,
    kind: normalizedKind,
    learner: normalizedLearner,
    ...result,
    diagnostics: clone(matches.diagnostics)
  });
}

export function resolveAssignmentDestination({
  assignmentId,
  learner,
  assignments,
  completed = {},
  availableScreens = null,
  fallbacks = BLH_ROUTE_FALLBACKS
} = {}) {
  const normalizedLearner = normalizeLearner(learner);
  const screens = normalizeAvailableScreens(availableScreens);
  const matches = matchingAssignments({ assignments, learner: normalizedLearner });
  const id = cleanText(assignmentId, '', 120);
  const item = matches.items.find(candidate => candidate.id === id) || null;
  if (!item) {
    const fallback = chooseFallback('unknown', { unknown: 'home' }, screens);
    return freezeDeep({
      version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,
      schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,
      learner: normalizedLearner,
      assignment: null,
      screen: fallback.screen,
      exactDestination: false,
      usedFallback: true,
      completed: false,
      reasonCode: 'ASSIGNMENT_NOT_FOUND_OR_NOT_APPLICABLE',
      warnings: ['ASSIGNMENT_NOT_FOUND_OR_NOT_APPLICABLE'],
      diagnostics: clone(matches.diagnostics)
    });
  }
  const fallback = chooseFallback(item.kind, fallbacks, screens);
  const result = resolveSelectedAssignment({ item, learner: normalizedLearner, completed, availableScreens: screens, fallback });
  return freezeDeep({
    version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,
    schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,
    learner: normalizedLearner,
    ...result,
    diagnostics: clone(matches.diagnostics)
  });
}

export function resolveLearnerRouteMatrix(options = {}) {
  const routes = Object.fromEntries(BLH_ROUTE_KINDS.map(kind => [kind, resolveLearnerRoute({ ...options, kind })]));
  return freezeDeep({
    version: BLH_LEARNER_ROUTE_RESOLVER_VERSION,
    schema: BLH_LEARNER_ROUTE_RESOLVER_SCHEMA,
    learner: normalizeLearner(options.learner),
    routes
  });
}
