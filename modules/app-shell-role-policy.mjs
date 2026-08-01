export const BLH_APP_SHELL_POLICY_VERSION = 'v10.40';
export const BLH_APP_SHELL_POLICY_SCHEMA = 1;
export const BLH_ROLE_IDS = Object.freeze(['student', 'parent', 'teacher', 'director', 'admin']);

export const BLH_ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({ id:'student', icon:'🎮', label:'Student', headline:'Student Mode', summary:'Use the icons above, then start today’s lesson path.' }),
  Object.freeze({ id:'parent', icon:'👨‍👩‍👧‍👦', label:'Parent', headline:'Parent View', summary:'Weekly rhythm, learner supports, progress, habits, assignments, and reports without director/admin clutter.' }),
  Object.freeze({ id:'teacher', icon:'🛠️', label:'Teacher', headline:'Teacher Workspace', summary:'Plan lessons, build questions, assign work, manage resources, guide students, and tune the learning game.' }),
  Object.freeze({ id:'director', icon:'📊', label:'Director', headline:'Director Rollup', summary:'Class/co-op-wide reporting, readiness, follow-ups, schedule health, and family communications.' }),
  Object.freeze({ id:'admin', icon:'🔐', label:'Admin', headline:'Admin / Builder View', summary:'Everything is available, including backups, imports, diagnostics, data setup, and curriculum pack control.' })
]);

export const BLH_ROLE_DEFAULT_SCREENS = Object.freeze({
  student:'home', parent:'home', teacher:'home', director:'home', admin:'home'
});

export const BLH_ROLE_NAV_GROUPS = Object.freeze({
  student: Object.freeze([
    Object.freeze({id:'core', label:'Start', icon:'🚦'}),
    Object.freeze({id:'learn-library', label:'Learn Library', icon:'📚'}),
    Object.freeze({id:'learn-lab', label:'Learn Labs', icon:'🧪'}),
    Object.freeze({id:'skill-library', label:'Skill Library', icon:'📒'}),
    Object.freeze({id:'skill-lab', label:'Skill Labs', icon:'🛠️'}),
    Object.freeze({id:'manage', label:'Progress', icon:'✅'}),
    Object.freeze({id:'game', label:'Creatures', icon:'🐾'}),
    Object.freeze({id:'director', label:'Explore', icon:'🗺️'})
  ]),
  parent: Object.freeze([
    Object.freeze({id:'core', label:'Review', icon:'👀'}),
    Object.freeze({id:'learn-library', label:'Learn Library', icon:'📚'}),
    Object.freeze({id:'learn-lab', label:'Learn Labs', icon:'🧪'}),
    Object.freeze({id:'skill-library', label:'Skill Library', icon:'📒'}),
    Object.freeze({id:'skill-lab', label:'Skill Labs', icon:'🛠️'}),
    Object.freeze({id:'manage', label:'Support', icon:'🧠'}),
    Object.freeze({id:'game', label:'Creature check-ins', icon:'🐾'}),
    Object.freeze({id:'director', label:'Map', icon:'🗺️'})
  ]),
  teacher: Object.freeze([
    Object.freeze({id:'core', label:'Class start', icon:'🚦'}),
    Object.freeze({id:'teach', label:'Build / Run', icon:'🛠️'}),
    Object.freeze({id:'manage', label:'Assign / Support', icon:'📌'}),
    Object.freeze({id:'learn-library', label:'Learn Library', icon:'📚'}),
    Object.freeze({id:'learn-lab', label:'Learn Labs', icon:'🧪'}),
    Object.freeze({id:'game', label:'Game setup', icon:'🎲'}),
    Object.freeze({id:'director', label:'Plans', icon:'📊'})
  ]),
  director: Object.freeze([
    Object.freeze({id:'core', label:'Overview', icon:'🧭'}),
    Object.freeze({id:'director', label:'Rollups', icon:'📊'}),
    Object.freeze({id:'manage', label:'Follow-up', icon:'🔎'}),
    Object.freeze({id:'teach', label:'Class operations', icon:'🗓️'})
  ]),
  admin: Object.freeze([
    Object.freeze({id:'core', label:'Start', icon:'🚦'}),
    Object.freeze({id:'admin', label:'Admin', icon:'🔐'}),
    Object.freeze({id:'teach', label:'Build tools', icon:'🛠️'}),
    Object.freeze({id:'director', label:'Reports', icon:'📊'}),
    Object.freeze({id:'manage', label:'Manage', icon:'📌'}),
    Object.freeze({id:'game', label:'Game', icon:'🎮'}),
    Object.freeze({id:'learn-library', label:'Learn Library', icon:'📚'}),
    Object.freeze({id:'learn-lab', label:'Learn Labs', icon:'🧪'})
  ])
});

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SCREEN_ID = /^[a-z][a-z0-9-]*$/;
const GROUP_ID = /^[a-z][a-z0-9-]*$/;

export class BLHAppShellPolicyError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHAppShellPolicyError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BLHAppShellPolicyError('INVALID_OBJECT', `${label} must be a plain object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new BLHAppShellPolicyError('INVALID_PROTOTYPE', `${label} has an unsupported prototype`);
  }
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) throw new BLHAppShellPolicyError('DANGEROUS_KEY', `${label} contains a dangerous key`, { key });
  }
}

function cleanText(value, label, { required = true, max = 500 } = {}) {
  if (typeof value !== 'string') throw new BLHAppShellPolicyError('INVALID_TEXT', `${label} must be text`);
  const text = value.trim();
  if (required && !text) throw new BLHAppShellPolicyError('EMPTY_TEXT', `${label} must not be empty`);
  if (text.length > max) throw new BLHAppShellPolicyError('TEXT_TOO_LONG', `${label} exceeds ${max} characters`);
  return text;
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

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length !== BLH_ROLE_IDS.length) {
    throw new BLHAppShellPolicyError('INVALID_ROLES', 'Role definitions must include exactly the five supported roles');
  }
  const seen = new Set();
  const normalized = roles.map((role, index) => {
    assertPlainObject(role, `roles[${index}]`);
    const id = cleanText(role.id, `roles[${index}].id`, { max: 30 });
    if (!BLH_ROLE_IDS.includes(id)) throw new BLHAppShellPolicyError('UNKNOWN_ROLE', `Unsupported role: ${id}`);
    if (seen.has(id)) throw new BLHAppShellPolicyError('DUPLICATE_ROLE', `Duplicate role: ${id}`);
    seen.add(id);
    return {
      id,
      icon: cleanText(role.icon, `roles[${index}].icon`, { max: 20 }),
      label: cleanText(role.label, `roles[${index}].label`, { max: 80 }),
      headline: cleanText(role.headline, `roles[${index}].headline`, { max: 120 }),
      summary: cleanText(role.summary, `roles[${index}].summary`, { max: 500 })
    };
  });
  for (const id of BLH_ROLE_IDS) if (!seen.has(id)) throw new BLHAppShellPolicyError('MISSING_ROLE', `Missing role: ${id}`);
  return normalized;
}

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog) || !catalog.length) {
    throw new BLHAppShellPolicyError('INVALID_CATALOG', 'Screen catalog must be a non-empty array');
  }
  const seen = new Set();
  return catalog.map((screen, index) => {
    assertPlainObject(screen, `catalog[${index}]`);
    const id = cleanText(screen.id, `catalog[${index}].id`, { max: 80 });
    if (!SCREEN_ID.test(id)) throw new BLHAppShellPolicyError('INVALID_SCREEN_ID', `Invalid screen id: ${id}`);
    if (seen.has(id)) throw new BLHAppShellPolicyError('DUPLICATE_SCREEN', `Duplicate screen id: ${id}`);
    seen.add(id);
    const group = cleanText(screen.group, `catalog[${index}].group`, { max: 80 });
    if (!GROUP_ID.test(group)) throw new BLHAppShellPolicyError('INVALID_GROUP_ID', `Invalid group id: ${group}`);
    if (!Array.isArray(screen.roles) || !screen.roles.length) {
      throw new BLHAppShellPolicyError('INVALID_SCREEN_ROLES', `Screen ${id} must allow at least one role`);
    }
    const roleSet = new Set();
    const allowedRoles = screen.roles.map((role, roleIndex) => {
      const normalizedRole = cleanText(role, `catalog[${index}].roles[${roleIndex}]`, { max: 30 });
      if (!BLH_ROLE_IDS.includes(normalizedRole)) throw new BLHAppShellPolicyError('UNKNOWN_SCREEN_ROLE', `Screen ${id} uses unsupported role ${normalizedRole}`);
      if (roleSet.has(normalizedRole)) throw new BLHAppShellPolicyError('DUPLICATE_SCREEN_ROLE', `Screen ${id} repeats role ${normalizedRole}`);
      roleSet.add(normalizedRole);
      return normalizedRole;
    });
    return {
      id,
      label: cleanText(screen.label, `catalog[${index}].label`, { max: 160 }),
      icon: cleanText(screen.icon, `catalog[${index}].icon`, { max: 30 }),
      group,
      roles: allowedRoles,
      note: cleanText(screen.note || '', `catalog[${index}].note`, { required:false, max:700 })
    };
  });
}

function normalizeNavGroups(navGroups) {
  assertPlainObject(navGroups, 'navGroups');
  const normalized = {};
  for (const role of BLH_ROLE_IDS) {
    const groups = navGroups[role];
    if (!Array.isArray(groups) || !groups.length) throw new BLHAppShellPolicyError('MISSING_NAV_GROUPS', `Missing navigation groups for ${role}`);
    const seen = new Set();
    normalized[role] = groups.map((group, index) => {
      assertPlainObject(group, `navGroups.${role}[${index}]`);
      const id = cleanText(group.id, `navGroups.${role}[${index}].id`, { max:80 });
      if (!GROUP_ID.test(id)) throw new BLHAppShellPolicyError('INVALID_NAV_GROUP', `Invalid navigation group: ${id}`);
      if (seen.has(id)) throw new BLHAppShellPolicyError('DUPLICATE_NAV_GROUP', `Duplicate navigation group ${id} for ${role}`);
      seen.add(id);
      return {
        id,
        label: cleanText(group.label, `navGroups.${role}[${index}].label`, { max:120 }),
        icon: cleanText(group.icon, `navGroups.${role}[${index}].icon`, { max:30 })
      };
    });
  }
  return normalized;
}

function normalizeDefaults(defaults, catalog) {
  assertPlainObject(defaults, 'defaults');
  const byId = new Map(catalog.map(screen => [screen.id, screen]));
  const normalized = {};
  for (const role of BLH_ROLE_IDS) {
    const screenId = cleanText(defaults[role], `defaults.${role}`, { max:80 });
    const screen = byId.get(screenId);
    if (!screen) throw new BLHAppShellPolicyError('MISSING_DEFAULT_SCREEN', `Default screen ${screenId} for ${role} is not in the catalog`);
    if (!screen.roles.includes(role)) throw new BLHAppShellPolicyError('INACCESSIBLE_DEFAULT_SCREEN', `Default screen ${screenId} does not allow ${role}`);
    normalized[role] = screenId;
  }
  return normalized;
}

export function createAppShellRolePolicy({
  catalog,
  roles = BLH_ROLE_DEFINITIONS,
  navGroups = BLH_ROLE_NAV_GROUPS,
  defaults = BLH_ROLE_DEFAULT_SCREENS
}) {
  const normalizedRoles = normalizeRoles(roles);
  const normalizedCatalog = normalizeCatalog(catalog);
  const normalizedNavGroups = normalizeNavGroups(navGroups);
  const normalizedDefaults = normalizeDefaults(defaults, normalizedCatalog);
  const roleIds = new Set(BLH_ROLE_IDS);
  const screenById = new Map(normalizedCatalog.map(screen => [screen.id, screen]));

  const policy = {
    version: BLH_APP_SHELL_POLICY_VERSION,
    schema: BLH_APP_SHELL_POLICY_SCHEMA,
    roleOptions: () => clone(normalizedRoles),
    catalog: () => clone(normalizedCatalog),
    defaultScreen: role => roleIds.has(role) ? normalizedDefaults[role] : null,
    roleCanAccessStatic: (screenId, role) => {
      if (!roleIds.has(role) || typeof screenId !== 'string') return false;
      const screen = screenById.get(screenId);
      return !!screen && screen.roles.includes(role);
    },
    visibleScreens: role => {
      if (!roleIds.has(role)) return [];
      return clone(normalizedCatalog.filter(screen => screen.roles.includes(role)));
    },
    navGroupsForRole: (role, groupResolver = screen => screen.group) => {
      if (!roleIds.has(role) || typeof groupResolver !== 'function') return [];
      const visible = normalizedCatalog.filter(screen => screen.roles.includes(role));
      const used = new Set(visible.map(screen => groupResolver(clone(screen))).filter(Boolean));
      return clone(normalizedNavGroups[role].filter(group => used.has(group.id)));
    },
    snapshot: () => ({
      version: BLH_APP_SHELL_POLICY_VERSION,
      schema: BLH_APP_SHELL_POLICY_SCHEMA,
      roles: clone(normalizedRoles),
      defaults: clone(normalizedDefaults),
      screenCount: normalizedCatalog.length,
      screensByRole: Object.fromEntries(BLH_ROLE_IDS.map(role => [role, normalizedCatalog.filter(screen => screen.roles.includes(role)).map(screen => screen.id)])),
      navGroups: clone(normalizedNavGroups)
    })
  };
  return freezeDeep(policy);
}
