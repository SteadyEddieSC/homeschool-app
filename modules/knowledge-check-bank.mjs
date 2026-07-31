export const BLH_KNOWLEDGE_CHECK_FORMAT = 'beaufort-learning-harbor-knowledge-check-bank';
export const BLH_KNOWLEDGE_CHECK_SCHEMA = 1;
export const BLH_KNOWLEDGE_CHECK_KIND = 'knowledge-check-bank';
export const BLH_KNOWLEDGE_CHECK_PRODUCT_VERSION = '10.36';
export const BLH_KNOWLEDGE_CHECK_TYPES = Object.freeze([
  'recitation',
  'discussion',
  'notebook',
  'project',
  'oral-tell-back',
  'mastery-proof'
]);

const ALLOWED_STATUSES = new Set(['draft', 'ready', 'archived']);
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_PROMPTS = 500;
const MAX_CRITERIA = 12;

export class BLHKnowledgeCheckError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHKnowledgeCheckError';
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
      throw new BLHKnowledgeCheckError('DANGEROUS_KEY', `Dangerous key rejected at ${path}.${key}`);
    }
    assertNoDangerousKeys(value[key], `${path}.${key}`);
  }
}

function requiredText(value, path, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value, path, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function normalizeCriteria(criteria, path) {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} must contain at least one criterion`);
  }
  if (criteria.length > MAX_CRITERIA) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `${path} exceeds ${MAX_CRITERIA} criteria`);
  }
  return criteria.map((criterion, index) => requiredText(criterion, `${path}[${index}]`, 240));
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableSort(value[key]);
  return output;
}

export function normalizeKnowledgeCheckPrompt(prompt, index = 0) {
  if (!isPlainObject(prompt)) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `Prompt ${index + 1} must be an object`);
  }
  assertNoDangerousKeys(prompt, `$.prompts[${index}]`);

  const id = requiredText(prompt.id, `$.prompts[${index}].id`, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `$.prompts[${index}].id contains unsupported characters`);
  }
  const type = requiredText(prompt.type, `$.prompts[${index}].type`, 40);
  if (!BLH_KNOWLEDGE_CHECK_TYPES.includes(type)) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `Unsupported knowledge-check type: ${type}`);
  }
  const status = optionalText(prompt.status, `$.prompts[${index}].status`, 20) || 'draft';
  if (!ALLOWED_STATUSES.has(status)) {
    throw new BLHKnowledgeCheckError('INVALID_PROMPT', `Unsupported knowledge-check status: ${status}`);
  }

  return stableSort({
    adultNotes: optionalText(prompt.adultNotes, `$.prompts[${index}].adultNotes`, 4000),
    approvalLanguage: optionalText(prompt.approvalLanguage, `$.prompts[${index}].approvalLanguage`, 2000),
    createdAt: optionalText(prompt.createdAt, `$.prompts[${index}].createdAt`, 80),
    criteria: normalizeCriteria(prompt.criteria, `$.prompts[${index}].criteria`),
    evidenceExpectations: requiredText(prompt.evidenceExpectations, `$.prompts[${index}].evidenceExpectations`, 4000),
    id,
    returnLanguage: optionalText(prompt.returnLanguage, `$.prompts[${index}].returnLanguage`, 2000),
    status,
    studentDirections: requiredText(prompt.studentDirections, `$.prompts[${index}].studentDirections`, 6000),
    subject: requiredText(prompt.subject, `$.prompts[${index}].subject`, 160),
    title: requiredText(prompt.title, `$.prompts[${index}].title`, 240),
    track: requiredText(prompt.track, `$.prompts[${index}].track`, 160),
    type,
    updatedAt: optionalText(prompt.updatedAt, `$.prompts[${index}].updatedAt`, 80)
  });
}

export function normalizeKnowledgeCheckPrompts(prompts) {
  if (!Array.isArray(prompts)) {
    throw new BLHKnowledgeCheckError('INVALID_BANK', 'Knowledge-check prompts must be an array');
  }
  if (prompts.length > MAX_PROMPTS) {
    throw new BLHKnowledgeCheckError('INVALID_BANK', `Knowledge-check bank exceeds ${MAX_PROMPTS} prompts`);
  }
  const normalized = prompts.map(normalizeKnowledgeCheckPrompt);
  const seen = new Set();
  for (const prompt of normalized) {
    if (seen.has(prompt.id)) {
      throw new BLHKnowledgeCheckError('DUPLICATE_ID', `Duplicate knowledge-check prompt id: ${prompt.id}`);
    }
    seen.add(prompt.id);
  }
  return normalized.sort((a, b) => a.id.localeCompare(b.id));
}

export function createKnowledgeCheckBank(prompts, options = {}) {
  const productVersion = typeof options.productVersion === 'string' && options.productVersion.trim()
    ? options.productVersion.trim()
    : BLH_KNOWLEDGE_CHECK_PRODUCT_VERSION;
  return stableSort({
    format: BLH_KNOWLEDGE_CHECK_FORMAT,
    kind: BLH_KNOWLEDGE_CHECK_KIND,
    productVersion,
    prompts: normalizeKnowledgeCheckPrompts(prompts),
    schemaVersion: BLH_KNOWLEDGE_CHECK_SCHEMA
  });
}

export function parseKnowledgeCheckBank(input) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new BLHKnowledgeCheckError('MALFORMED_JSON', 'Knowledge-check file is not valid JSON', { cause: error.message });
    }
  }
  if (!isPlainObject(value)) {
    throw new BLHKnowledgeCheckError('INVALID_BANK', 'Knowledge-check file must be an object');
  }
  assertNoDangerousKeys(value);
  if (value.format !== BLH_KNOWLEDGE_CHECK_FORMAT) {
    throw new BLHKnowledgeCheckError('INVALID_FORMAT', 'Knowledge-check file format is missing or unsupported');
  }
  if (!Number.isInteger(value.schemaVersion)) {
    throw new BLHKnowledgeCheckError('INVALID_BANK', 'Knowledge-check schemaVersion must be an integer');
  }
  if (value.schemaVersion !== BLH_KNOWLEDGE_CHECK_SCHEMA) {
    throw new BLHKnowledgeCheckError('UNSUPPORTED_SCHEMA', `Unsupported knowledge-check schema: ${value.schemaVersion}`, {
      supported: [BLH_KNOWLEDGE_CHECK_SCHEMA]
    });
  }
  if (value.kind !== BLH_KNOWLEDGE_CHECK_KIND) {
    throw new BLHKnowledgeCheckError('UNSUPPORTED_KIND', `Unsupported knowledge-check kind: ${String(value.kind)}`);
  }
  if (typeof value.productVersion !== 'string' || !value.productVersion.trim()) {
    throw new BLHKnowledgeCheckError('INVALID_BANK', 'Knowledge-check productVersion is required');
  }
  return createKnowledgeCheckBank(value.prompts, { productVersion: value.productVersion });
}

export function serializeKnowledgeCheckBank(input, options = {}) {
  const bank = Array.isArray(input)
    ? createKnowledgeCheckBank(input, options)
    : parseKnowledgeCheckBank(input);
  const space = options.pretty === false ? 0 : 2;
  return `${JSON.stringify(stableSort(bank), null, space)}\n`;
}
