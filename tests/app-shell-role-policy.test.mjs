import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLHAppShellPolicyError,
  BLH_APP_SHELL_POLICY_SCHEMA,
  BLH_APP_SHELL_POLICY_VERSION,
  BLH_ROLE_IDS,
  createAppShellRolePolicy
} from '../modules/app-shell-role-policy.mjs';

const catalog = [
  { id:'home', label:'Home', icon:'🏡', group:'core', roles:[...BLH_ROLE_IDS], note:'Role dashboard' },
  { id:'study', label:'Study', icon:'📚', group:'learn-library', roles:['student','parent','teacher','admin'], note:'Learning work' },
  { id:'questions', label:'Question Lab', icon:'❓', group:'teach', roles:['teacher','admin'], note:'Authoring' },
  { id:'director', label:'Director Report', icon:'📊', group:'director', roles:['director','admin'], note:'Rollup' },
  { id:'data', label:'Data', icon:'💾', group:'admin', roles:['admin'], note:'Admin only' }
];

function policy(overrides = {}) {
  return createAppShellRolePolicy({ catalog, ...overrides });
}

test('creates deterministic role and screen snapshots', () => {
  const first = policy().snapshot();
  const second = policy().snapshot();
  assert.deepEqual(first, second);
  assert.equal(first.version, BLH_APP_SHELL_POLICY_VERSION);
  assert.equal(first.schema, BLH_APP_SHELL_POLICY_SCHEMA);
  assert.equal(first.screenCount, catalog.length);
  assert.deepEqual(first.defaults, {student:'home', parent:'home', teacher:'home', director:'home', admin:'home'});
});

test('fails closed for unknown roles and screens', () => {
  const appShell = policy();
  assert.equal(appShell.roleCanAccessStatic('study', 'student'), true);
  assert.equal(appShell.roleCanAccessStatic('questions', 'student'), false);
  assert.equal(appShell.roleCanAccessStatic('missing', 'admin'), false);
  assert.equal(appShell.roleCanAccessStatic('home', 'owner'), false);
  assert.equal(appShell.defaultScreen('owner'), null);
  assert.deepEqual(appShell.visibleScreens('owner'), []);
  assert.deepEqual(appShell.navGroupsForRole('owner'), []);
});

test('returns defensive copies rather than mutable policy internals', () => {
  const appShell = policy();
  const screens = appShell.catalog();
  screens[0].roles.length = 0;
  screens.push({id:'fake'});
  assert.equal(appShell.catalog().length, catalog.length);
  assert.equal(appShell.roleCanAccessStatic('home', 'student'), true);
  const roles = appShell.roleOptions();
  roles[0].label = 'Changed';
  assert.equal(appShell.roleOptions()[0].label, 'Student');
});

test('filters navigation groups through a role-aware resolver', () => {
  const appShell = policy();
  const studentGroups = appShell.navGroupsForRole('student', screen => screen.group);
  assert.deepEqual(studentGroups.map(group => group.id), ['core','learn-library']);
  const teacherGroups = appShell.navGroupsForRole('teacher', screen => screen.group);
  assert.deepEqual(teacherGroups.map(group => group.id), ['core','teach','learn-library']);
});

test('rejects duplicate screens and duplicate screen roles', () => {
  assert.throws(() => createAppShellRolePolicy({ catalog:[...catalog, {...catalog[0]}] }), error => error instanceof BLHAppShellPolicyError && error.code === 'DUPLICATE_SCREEN');
  assert.throws(() => createAppShellRolePolicy({ catalog:[{...catalog[0], roles:['student','student']}, ...catalog.slice(1)] }), error => error instanceof BLHAppShellPolicyError && error.code === 'DUPLICATE_SCREEN_ROLE');
});

test('rejects unsupported roles, invalid groups, and inaccessible defaults', () => {
  assert.throws(() => createAppShellRolePolicy({ catalog:[{...catalog[0], roles:['student','owner']}, ...catalog.slice(1)] }), error => error instanceof BLHAppShellPolicyError && error.code === 'UNKNOWN_SCREEN_ROLE');
  assert.throws(() => createAppShellRolePolicy({ catalog:[{...catalog[0], group:'Bad Group'}, ...catalog.slice(1)] }), error => error instanceof BLHAppShellPolicyError && error.code === 'INVALID_GROUP_ID');
  assert.throws(() => createAppShellRolePolicy({ catalog, defaults:{student:'data', parent:'home', teacher:'home', director:'home', admin:'home'} }), error => error instanceof BLHAppShellPolicyError && error.code === 'INACCESSIBLE_DEFAULT_SCREEN');
});

test('rejects polluted or dangerous objects', () => {
  const polluted = Object.create({ inherited:true });
  Object.assign(polluted, catalog[0]);
  assert.throws(() => createAppShellRolePolicy({ catalog:[polluted, ...catalog.slice(1)] }), error => error instanceof BLHAppShellPolicyError && error.code === 'INVALID_PROTOTYPE');
  const dangerous = JSON.parse('{"id":"evil","label":"Evil","icon":"!","group":"core","roles":["admin"],"note":"","__proto__":{}}');
  assert.throws(() => createAppShellRolePolicy({ catalog:[...catalog, dangerous] }), error => error instanceof BLHAppShellPolicyError && error.code === 'DANGEROUS_KEY');
});
