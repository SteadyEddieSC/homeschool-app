export const BLH_FAMILY_PLANNER_FORMAT = 'beaufort-learning-harbor-family-planner';
export const BLH_FAMILY_PLANNER_SCHEMA = 1;
export const BLH_FAMILY_PLANNER_KIND = 'family-planner-workspace';
export const BLH_FAMILY_PLANNER_PRODUCT_VERSION = '10.38';
export const BLH_FAMILY_PLANNER_DAYS = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
export const BLH_FAMILY_PLANNER_MODES = Object.freeze(['standard', 'catch-up', 'flex', 'co-op-heavy', 'break-light']);
export const BLH_FAMILY_PLANNER_TYPES = Object.freeze(['lesson', 'assignment', 'co-op', 'project', 'review', 'admin', 'flex', 'life-skill']);
export const BLH_FAMILY_PLANNER_STATUSES = Object.freeze(['planned', 'ready', 'carryover', 'archived']);
export const BLH_FAMILY_PLANNER_TARGET_KINDS = Object.freeze(['all', 'student', 'track']);
export const BLH_FAMILY_PLANNER_SOURCE_SCREENS = Object.freeze(['', 'assignments', 'lessonpacks', 'missionplanner', 'schedule', 'pacing', 'yearplan', 'insights']);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_WEEKS = 80;
const MAX_ITEMS_PER_WEEK = 200;

export class BLHFamilyPlannerError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHFamilyPlannerError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertNoDangerousKeys(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDangerousKeys(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new BLHFamilyPlannerError('DANGEROUS_KEY', `Dangerous key rejected at ${path}.${key}`);
    }
    assertNoDangerousKeys(value[key], `${path}.${key}`);
  }
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableSort(value[key]);
  return output;
}

function requiredText(value, path, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value, path, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalBoolean(value, path, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be a boolean`);
  }
  return value;
}

function optionalInteger(value, path, fallback = 0, min = 0, max = 100000) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be an integer from ${min} to ${max}`);
  }
  return number;
}

function enumValue(value, allowed, path, fallback = '') {
  const normalized = optionalText(value, path, 80) || fallback;
  if (!allowed.includes(normalized)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `Unsupported ${path}: ${normalized}`);
  }
  return normalized;
}

function idValue(value, path) {
  const id = requiredText(value, path, 140);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} contains unsupported characters`);
  }
  return id;
}

function timeValue(value, path) {
  const normalized = optionalText(value, path, 5);
  if (!normalized) return '';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must use 24-hour HH:MM format`);
  }
  return normalized;
}

function normalizeCoOp(value, path) {
  const source = value === undefined || value === null ? {} : value;
  if (!isPlainObject(source)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be an object`);
  }
  assertNoDangerousKeys(source, path);
  const enabled = optionalBoolean(source.enabled, `${path}.enabled`);
  const eventName = optionalText(source.eventName, `${path}.eventName`, 240);
  if (enabled && !eventName) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.eventName is required when co-op coordination is enabled`);
  }
  return stableSort({
    arrivalNotes: optionalText(source.arrivalNotes, `${path}.arrivalNotes`, 2000),
    enabled,
    eventName,
    followUpOwner: optionalText(source.followUpOwner, `${path}.followUpOwner`, 160),
    materials: optionalText(source.materials, `${path}.materials`, 2000),
    role: optionalText(source.role, `${path}.role`, 160)
  });
}

export function normalizeFamilyPlannerItem(item, path = '$.planner.weeks[0].items[0]') {
  if (!isPlainObject(item)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be an object`);
  }
  assertNoDangerousKeys(item, path);
  const startTime = timeValue(item.startTime, `${path}.startTime`);
  const endTime = timeValue(item.endTime, `${path}.endTime`);
  if (startTime && endTime && startTime > endTime) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.endTime must not be earlier than startTime`);
  }
  const targetKind = enumValue(item.targetKind, BLH_FAMILY_PLANNER_TARGET_KINDS, `${path}.targetKind`, 'all');
  const targetId = optionalText(item.targetId, `${path}.targetId`, 160);
  if (targetKind !== 'all' && !targetId) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.targetId is required for ${targetKind} targeting`);
  }
  const sourceScreen = enumValue(item.sourceScreen, BLH_FAMILY_PLANNER_SOURCE_SCREENS, `${path}.sourceScreen`, '');
  const sourceId = optionalText(item.sourceId, `${path}.sourceId`, 180);
  if (sourceId && !sourceScreen) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.sourceScreen is required when sourceId is present`);
  }
  return stableSort({
    adultNotes: optionalText(item.adultNotes, `${path}.adultNotes`, 5000),
    carriedFromId: optionalText(item.carriedFromId, `${path}.carriedFromId`, 140),
    coOp: normalizeCoOp(item.coOp, `${path}.coOp`),
    createdAt: optionalText(item.createdAt, `${path}.createdAt`, 80),
    day: enumValue(item.day, BLH_FAMILY_PLANNER_DAYS, `${path}.day`, 'Monday'),
    endTime,
    id: idValue(item.id, `${path}.id`),
    itemType: enumValue(item.itemType, BLH_FAMILY_PLANNER_TYPES, `${path}.itemType`, 'lesson'),
    location: optionalText(item.location, `${path}.location`, 240),
    order: optionalInteger(item.order, `${path}.order`, 0, 0, 100000),
    sourceId,
    sourceScreen,
    startTime,
    status: enumValue(item.status, BLH_FAMILY_PLANNER_STATUSES, `${path}.status`, 'planned'),
    studentDirections: requiredText(item.studentDirections, `${path}.studentDirections`, 6000),
    subject: optionalText(item.subject, `${path}.subject`, 180),
    targetId,
    targetKind,
    title: requiredText(item.title, `${path}.title`, 240),
    updatedAt: optionalText(item.updatedAt, `${path}.updatedAt`, 80)
  });
}

export function normalizeFamilyPlannerWeek(week, index = 0) {
  const path = `$.planner.weeks[${index}]`;
  if (!isPlainObject(week)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path} must be an object`);
  }
  assertNoDangerousKeys(week, path);
  if (!Array.isArray(week.items)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.items must be an array`);
  }
  if (week.items.length > MAX_ITEMS_PER_WEEK) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `${path}.items exceeds ${MAX_ITEMS_PER_WEEK}`);
  }
  const items = week.items.map((item, itemIndex) => normalizeFamilyPlannerItem(item, `${path}.items[${itemIndex}]`));
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw new BLHFamilyPlannerError('DUPLICATE_ID', `Duplicate planner item id: ${item.id}`);
    }
    ids.add(item.id);
  }
  return stableSort({
    coOpNotes: optionalText(week.coOpNotes, `${path}.coOpNotes`, 5000),
    familyNotes: optionalText(week.familyNotes, `${path}.familyNotes`, 5000),
    items,
    mode: enumValue(week.mode, BLH_FAMILY_PLANNER_MODES, `${path}.mode`, 'standard'),
    updatedAt: optionalText(week.updatedAt, `${path}.updatedAt`, 80),
    weekId: idValue(week.weekId, `${path}.weekId`)
  });
}

export function normalizeFamilyPlannerWorkspace(planner) {
  if (!isPlainObject(planner)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', 'Planner workspace must be an object');
  }
  assertNoDangerousKeys(planner, '$.planner');
  if (!Array.isArray(planner.weeks)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', '$.planner.weeks must be an array');
  }
  if (planner.weeks.length > MAX_WEEKS) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', `$.planner.weeks exceeds ${MAX_WEEKS}`);
  }
  const weeks = planner.weeks.map(normalizeFamilyPlannerWeek);
  const weekIds = new Set();
  const itemIds = new Set();
  for (const week of weeks) {
    if (weekIds.has(week.weekId)) {
      throw new BLHFamilyPlannerError('DUPLICATE_ID', `Duplicate planner week id: ${week.weekId}`);
    }
    weekIds.add(week.weekId);
    for (const item of week.items) {
      if (itemIds.has(item.id)) {
        throw new BLHFamilyPlannerError('DUPLICATE_ID', `Duplicate planner item id across weeks: ${item.id}`);
      }
      itemIds.add(item.id);
    }
  }
  const activeWeekId = optionalText(planner.activeWeekId, '$.planner.activeWeekId', 140) || weeks[0]?.weekId || '';
  if (activeWeekId && weeks.length && !weekIds.has(activeWeekId)) {
    throw new BLHFamilyPlannerError('INVALID_PLANNER', '$.planner.activeWeekId must reference an included planner week');
  }
  return stableSort({
    activeWeekId,
    weeks
  });
}

export function createFamilyPlannerPackage(planner, options = {}) {
  const productVersion = typeof options.productVersion === 'string' && options.productVersion.trim()
    ? options.productVersion.trim()
    : BLH_FAMILY_PLANNER_PRODUCT_VERSION;
  return stableSort({
    format: BLH_FAMILY_PLANNER_FORMAT,
    kind: BLH_FAMILY_PLANNER_KIND,
    planner: normalizeFamilyPlannerWorkspace(planner),
    productVersion,
    schemaVersion: BLH_FAMILY_PLANNER_SCHEMA
  });
}

export function parseFamilyPlannerPackage(input) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new BLHFamilyPlannerError('MALFORMED_JSON', 'Family-planner file is not valid JSON', { cause: error.message });
    }
  }
  if (!isPlainObject(value)) {
    throw new BLHFamilyPlannerError('INVALID_PACKAGE', 'Family-planner file must be an object');
  }
  assertNoDangerousKeys(value);
  if (value.format !== BLH_FAMILY_PLANNER_FORMAT) {
    throw new BLHFamilyPlannerError('INVALID_FORMAT', 'Family-planner file format is missing or unsupported');
  }
  if (!Number.isInteger(value.schemaVersion)) {
    throw new BLHFamilyPlannerError('INVALID_PACKAGE', 'Family-planner schemaVersion must be an integer');
  }
  if (value.schemaVersion !== BLH_FAMILY_PLANNER_SCHEMA) {
    throw new BLHFamilyPlannerError('UNSUPPORTED_SCHEMA', `Unsupported family-planner schema: ${value.schemaVersion}`, {
      supported: [BLH_FAMILY_PLANNER_SCHEMA]
    });
  }
  if (value.kind !== BLH_FAMILY_PLANNER_KIND) {
    throw new BLHFamilyPlannerError('UNSUPPORTED_KIND', `Unsupported family-planner kind: ${String(value.kind)}`);
  }
  if (typeof value.productVersion !== 'string' || !value.productVersion.trim()) {
    throw new BLHFamilyPlannerError('INVALID_PACKAGE', 'Family-planner productVersion is required');
  }
  return createFamilyPlannerPackage(value.planner, { productVersion: value.productVersion });
}

export function serializeFamilyPlannerPackage(input, options = {}) {
  const plannerPackage = input && input.format === BLH_FAMILY_PLANNER_FORMAT
    ? parseFamilyPlannerPackage(input)
    : createFamilyPlannerPackage(input, options);
  const space = options.pretty === false ? 0 : 2;
  return `${JSON.stringify(stableSort(plannerPackage), null, space)}\n`;
}
