export const BLH_LESSON_PACK_FORMAT = 'beaufort-learning-harbor-lesson-pack';
export const BLH_LESSON_PACK_SCHEMA = 1;
export const BLH_LESSON_PACK_KIND = 'lesson-pack-draft';
export const BLH_LESSON_PACK_PRODUCT_VERSION = '10.37';
export const BLH_LESSON_PACK_STATUSES = Object.freeze(['draft', 'ready', 'archived']);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_SECTIONS = 20;
const MAX_PROMPTS = 30;

export class BLHLessonPackError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHLessonPackError';
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
      throw new BLHLessonPackError('DANGEROUS_KEY', `Dangerous key rejected at ${path}.${key}`);
    }
    assertNoDangerousKeys(value[key], `${path}.${key}`);
  }
}

function requiredText(value, path, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value, path, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalBoolean(value, path, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be a boolean`);
  }
  return value;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableSort(value[key]);
  return output;
}

function normalizePromptList(value, path) {
  if (!Array.isArray(value)) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be an array`);
  }
  if (value.length > MAX_PROMPTS) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} exceeds ${MAX_PROMPTS} prompts`);
  }
  return value
    .map((item, index) => optionalText(item, `${path}[${index}]`, 1000))
    .filter(Boolean);
}

export function normalizeLessonPackSection(section, index = 0) {
  if (!isPlainObject(section)) {
    throw new BLHLessonPackError('INVALID_PACK', `$.pack.sections[${index}] must be an object`);
  }
  assertNoDangerousKeys(section, `$.pack.sections[${index}]`);
  const id = requiredText(section.id, `$.pack.sections[${index}].id`, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new BLHLessonPackError('INVALID_PACK', `$.pack.sections[${index}].id contains unsupported characters`);
  }
  return stableSort({
    body: requiredText(section.body, `$.pack.sections[${index}].body`, 12000),
    id,
    title: requiredText(section.title, `$.pack.sections[${index}].title`, 240)
  });
}

function normalizeMediaNeeds(value) {
  const path = '$.pack.mediaNeeds';
  const source = value === undefined || value === null ? {} : value;
  if (!isPlainObject(source)) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be an object`);
  }
  assertNoDangerousKeys(source, path);
  return stableSort({
    altText: optionalBoolean(source.altText, `${path}.altText`),
    diagramOrMap: optionalBoolean(source.diagramOrMap, `${path}.diagramOrMap`),
    heroImage: optionalBoolean(source.heroImage, `${path}.heroImage`),
    notes: optionalText(source.notes, `${path}.notes`, 4000),
    sourceLicenseReview: optionalBoolean(source.sourceLicenseReview, `${path}.sourceLicenseReview`),
    supportingImages: optionalBoolean(source.supportingImages, `${path}.supportingImages`)
  });
}

function normalizeNoEquipmentPath(value) {
  const path = '$.pack.noEquipmentPath';
  const source = value === undefined || value === null ? {} : value;
  if (!isPlainObject(source)) {
    throw new BLHLessonPackError('INVALID_PACK', `${path} must be an object`);
  }
  assertNoDangerousKeys(source, path);
  const enabled = optionalBoolean(source.enabled, `${path}.enabled`);
  const directions = optionalText(source.directions, `${path}.directions`, 6000);
  const evidence = optionalText(source.evidence, `${path}.evidence`, 4000);
  if (enabled && (!directions || !evidence)) {
    throw new BLHLessonPackError('INVALID_PACK', 'Enabled no-equipment path requires directions and evidence expectations');
  }
  return stableSort({ enabled, directions, evidence });
}

export function normalizeLessonPackDraft(pack) {
  if (!isPlainObject(pack)) {
    throw new BLHLessonPackError('INVALID_PACK', 'Lesson pack must be an object');
  }
  assertNoDangerousKeys(pack, '$.pack');

  const id = requiredText(pack.id, '$.pack.id', 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new BLHLessonPackError('INVALID_PACK', '$.pack.id contains unsupported characters');
  }
  const status = optionalText(pack.status, '$.pack.status', 20) || 'draft';
  if (!BLH_LESSON_PACK_STATUSES.includes(status)) {
    throw new BLHLessonPackError('INVALID_PACK', `Unsupported lesson-pack status: ${status}`);
  }
  if (!Array.isArray(pack.sections) || pack.sections.length === 0) {
    throw new BLHLessonPackError('INVALID_PACK', '$.pack.sections must contain at least one section');
  }
  if (pack.sections.length > MAX_SECTIONS) {
    throw new BLHLessonPackError('INVALID_PACK', `$.pack.sections exceeds ${MAX_SECTIONS} sections`);
  }
  const sections = pack.sections.map(normalizeLessonPackSection);
  const sectionIds = new Set();
  for (const section of sections) {
    if (sectionIds.has(section.id)) {
      throw new BLHLessonPackError('DUPLICATE_ID', `Duplicate lesson-section id: ${section.id}`);
    }
    sectionIds.add(section.id);
  }

  return stableSort({
    adultNotes: optionalText(pack.adultNotes, '$.pack.adultNotes', 5000),
    applyMode: 'draft-only',
    createdAt: optionalText(pack.createdAt, '$.pack.createdAt', 80),
    id,
    labPrompts: normalizePromptList(pack.labPrompts || [], '$.pack.labPrompts'),
    mediaNeeds: normalizeMediaNeeds(pack.mediaNeeds),
    noEquipmentPath: normalizeNoEquipmentPath(pack.noEquipmentPath),
    objective: requiredText(pack.objective, '$.pack.objective', 4000),
    practicePrompts: normalizePromptList(pack.practicePrompts || [], '$.pack.practicePrompts'),
    sections,
    sourceDraftId: optionalText(pack.sourceDraftId, '$.pack.sourceDraftId', 160),
    status,
    subject: requiredText(pack.subject, '$.pack.subject', 160),
    targetScreen: requiredText(pack.targetScreen, '$.pack.targetScreen', 100),
    targetWeekId: optionalText(pack.targetWeekId, '$.pack.targetWeekId', 100),
    title: requiredText(pack.title, '$.pack.title', 240),
    track: requiredText(pack.track, '$.pack.track', 160),
    updatedAt: optionalText(pack.updatedAt, '$.pack.updatedAt', 80)
  });
}

export function createLessonPackPackage(pack, options = {}) {
  const productVersion = typeof options.productVersion === 'string' && options.productVersion.trim()
    ? options.productVersion.trim()
    : BLH_LESSON_PACK_PRODUCT_VERSION;
  return stableSort({
    format: BLH_LESSON_PACK_FORMAT,
    kind: BLH_LESSON_PACK_KIND,
    pack: normalizeLessonPackDraft(pack),
    productVersion,
    schemaVersion: BLH_LESSON_PACK_SCHEMA
  });
}

export function parseLessonPackPackage(input) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new BLHLessonPackError('MALFORMED_JSON', 'Lesson-pack file is not valid JSON', { cause: error.message });
    }
  }
  if (!isPlainObject(value)) {
    throw new BLHLessonPackError('INVALID_PACKAGE', 'Lesson-pack file must be an object');
  }
  assertNoDangerousKeys(value);
  if (value.format !== BLH_LESSON_PACK_FORMAT) {
    throw new BLHLessonPackError('INVALID_FORMAT', 'Lesson-pack file format is missing or unsupported');
  }
  if (!Number.isInteger(value.schemaVersion)) {
    throw new BLHLessonPackError('INVALID_PACKAGE', 'Lesson-pack schemaVersion must be an integer');
  }
  if (value.schemaVersion !== BLH_LESSON_PACK_SCHEMA) {
    throw new BLHLessonPackError('UNSUPPORTED_SCHEMA', `Unsupported lesson-pack schema: ${value.schemaVersion}`, {
      supported: [BLH_LESSON_PACK_SCHEMA]
    });
  }
  if (value.kind !== BLH_LESSON_PACK_KIND) {
    throw new BLHLessonPackError('UNSUPPORTED_KIND', `Unsupported lesson-pack kind: ${String(value.kind)}`);
  }
  if (typeof value.productVersion !== 'string' || !value.productVersion.trim()) {
    throw new BLHLessonPackError('INVALID_PACKAGE', 'Lesson-pack productVersion is required');
  }
  return createLessonPackPackage(value.pack, { productVersion: value.productVersion });
}

export function serializeLessonPackPackage(input, options = {}) {
  const lessonPackage = input && input.format === BLH_LESSON_PACK_FORMAT
    ? parseLessonPackPackage(input)
    : createLessonPackPackage(input, options);
  const space = options.pretty === false ? 0 : 2;
  return `${JSON.stringify(stableSort(lessonPackage), null, space)}\n`;
}
