export const BLH_DATA_FORMAT = 'beaufort-learning-harbor-data';
export const BLH_SCHEMA_VERSION = 1;
export const BLH_PRODUCT_VERSION = '10.35';
export const BLH_LEGACY_STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';

export const BLH_DATA_KINDS = Object.freeze({
  APPLICATION_STATE: 'application-state',
  DEMO_FIXTURE: 'demo-fixture'
});

// This allowlist is derived from the live v10.34.1 standalone application state,
// including current defaults, normalization paths, storage compaction, and the
// deterministic public-demo layer injected after the immutable v10.32 baseline.
export const BLH_STATE_KEYS = Object.freeze([
  'activeStudentId',
  'activity',
  'activityLog',
  'adaptiveSettings',
  'adventureCampaigns',
  'adventureMaps',
  'adventureNpcs',
  'adventureQuests',
  'adventureSettings',
  'adventureTileActions',
  'ancientCompanion',
  'appVersion',
  'assessments',
  'assignmentApprovals',
  'assignments',
  'authSettings',
  'backups',
  'battleEvents',
  'battleLogs',
  'battleMoveLibrary',
  'binderSettings',
  'biologyCompanion',
  'botanyCompanion',
  'challenges',
  'classicalSettings',
  'contentPackSettings',
  'contentPacks',
  'craftingRecipes',
  'creatureBondQuests',
  'creatureCampSettings',
  'creatureCampTasks',
  'creatureCareSettings',
  'creatureDex',
  'creatureExpeditions',
  'creatureItems',
  'creatureRewardBalanceSettings',
  'creatureTournaments',
  'creatureTraitLibrary',
  'creatureTypeChart',
  'currentClassDate',
  'currentCoachSubjectId',
  'currentExpeditionId',
  'currentGuildId',
  'currentHabitDate',
  'currentMatchupPreviewEventId',
  'currentStudyLevelId',
  'currentWeekId',
  'curriculum',
  'curriculumBooklists',
  'curriculumCoverageGaps',
  'curriculumCoverageSettings',
  'customFlashcards',
  'customResources',
  'cycleName',
  'cyclePlan',
  'demoProfile',
  'expeditionBiomes',
  'expeditionSettings',
  'familyAnnouncements',
  'flashcardProgress',
  'geographyAtlas',
  'guildMissions',
  'habitRubrics',
  'historyTimeline',
  'insightFollowUps',
  'insightSettings',
  'latinCompanion',
  'latinDeck',
  'learnerProfiles',
  'learningLevels',
  'lessonPlans',
  'lessonPlayerSettings',
  'lessonSessions',
  'literatureCompanion',
  'logicCompanion',
  'masteryArenaSettings',
  'mathLadders',
  'missionBlueprints',
  'missionPlannerSettings',
  'mockTrialCompanion',
  'navigationShellSettings',
  'pacingSettings',
  'packAudit',
  'parentControlSettings',
  'partySettings',
  'portfolioArtifacts',
  'portfolioSettings',
  'practicalCompanion',
  'practicalSettings',
  'practicalView',
  'presentationQueue',
  'programName',
  'progress',
  'publicDomainBible',
  'questJournal',
  'questionSettings',
  'questionTypes',
  'recordsSettings',
  'resources',
  'rewardPolicy',
  'romanNumerals',
  'rubricReviews',
  'rubricStudioSettings',
  'rubricTemplates',
  'schedule',
  'scriptureMemory',
  'sessionLogs',
  'skillDomains',
  'skillEvidence',
  'skillGoals',
  'spanishCompanion',
  'students',
  'studyApprovalSettings',
  'studyApprovals',
  'studyLibraryModules',
  'subjectGuilds',
  'syllabusPlan',
  'teams',
  'ui',
  'uiOverhaulSettings',
  'v10122QuizRecords',
  'v108AssessmentSubmissions',
  'v108Math',
  'worldEncounters',
  'worldSettings',
  'worldZones',
  'writingCompanion'
]);

const FIXTURE_KEYS = Object.freeze([
  'schema',
  'fixtureId',
  'description',
  'family',
  'students',
  'progress'
]);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class BLHDataError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHDataError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new BLHDataError('INVALID_VALUE', `Non-finite number at ${path}`);
    }
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') return null;
      return cloneJsonValue(item, `${path}[${index}]`);
    });
  }
  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (DANGEROUS_KEYS.has(key)) continue;
      const child = value[key];
      if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
      output[key] = cloneJsonValue(child, `${path}.${key}`);
    }
    return output;
  }
  throw new BLHDataError('INVALID_VALUE', `Unsupported value at ${path}`);
}

function pickAllowed(source, keys, path) {
  if (!isPlainObject(source)) {
    throw new BLHDataError('INVALID_STATE', `${path} must be an object`);
  }
  const output = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const child = source[key];
      if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
      output[key] = cloneJsonValue(child, `${path}.${key}`);
    }
  }
  return output;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableSort(value[key]);
  return output;
}

function requireString(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BLHDataError('INVALID_STATE', `${path} must be a non-empty string`);
  }
}

function validateStudent(student, index) {
  if (!isPlainObject(student)) {
    throw new BLHDataError('INVALID_STATE', `Application state student ${index} must be an object`);
  }
  requireString(student.id, `$.state.students[${index}].id`);
  requireString(student.name, `$.state.students[${index}].name`);
}

function validateApplicationState(state) {
  if (!isPlainObject(state)) {
    throw new BLHDataError('INVALID_STATE', 'Application state must be an object');
  }
  if (!Array.isArray(state.students)) {
    throw new BLHDataError('INVALID_STATE', 'Application state students must be an array');
  }
  state.students.forEach(validateStudent);
  if (!isPlainObject(state.curriculum) || !Array.isArray(state.curriculum.weeks)) {
    throw new BLHDataError('INVALID_STATE', 'Application state curriculum.weeks must be an array');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'progress') && !isPlainObject(state.progress)) {
    throw new BLHDataError('INVALID_STATE', 'Application state progress must be an object');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'authSettings') && !isPlainObject(state.authSettings)) {
    throw new BLHDataError('INVALID_STATE', 'Application state authSettings must be an object');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'backups') && !Array.isArray(state.backups)) {
    throw new BLHDataError('INVALID_STATE', 'Application state backups must be an array');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'appVersion') && typeof state.appVersion !== 'string') {
    throw new BLHDataError('INVALID_STATE', 'Application state appVersion must be a string');
  }
  if (Object.prototype.hasOwnProperty.call(state, 'programName') && typeof state.programName !== 'string') {
    throw new BLHDataError('INVALID_STATE', 'Application state programName must be a string');
  }
  return state;
}

function sanitizeAuthSettings(authSettings, portable) {
  const output = cloneJsonValue(authSettings, '$.state.authSettings');
  // An unlock session is never portable and should not survive an import.
  if (Object.prototype.hasOwnProperty.call(output, 'adultUnlockExpiresAt')) {
    output.adultUnlockExpiresAt = '';
  }
  if (portable) {
    if (Object.prototype.hasOwnProperty.call(output, 'adultPinHash')) output.adultPinHash = '';
    if (Object.prototype.hasOwnProperty.call(output, 'pinHint')) output.pinHint = '';
    if (Object.prototype.hasOwnProperty.call(output, 'auditLog')) output.auditLog = [];
  }
  return output;
}

function portableBackupMetadata(backup, index) {
  if (!isPlainObject(backup)) {
    throw new BLHDataError('INVALID_STATE', `Application state backup ${index} must be an object`);
  }
  const output = {};
  for (const key of ['id', 'label', 'createdAt', 'hash', 'bytes', 'note']) {
    if (!Object.prototype.hasOwnProperty.call(backup, key)) continue;
    const value = backup[key];
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') continue;
    output[key] = cloneJsonValue(value, `$.state.backups[${index}].${key}`);
  }
  output.payloadOmitted = true;
  return output;
}

function sanitizeApplicationState(source, options = {}) {
  const portable = options.portable === true;
  const state = pickAllowed(source, BLH_STATE_KEYS, '$.state');
  validateApplicationState(state);

  if (Object.prototype.hasOwnProperty.call(state, 'authSettings')) {
    state.authSettings = sanitizeAuthSettings(state.authSettings, portable);
  }
  if (portable && Object.prototype.hasOwnProperty.call(state, 'backups')) {
    state.backups = state.backups.map(portableBackupMetadata);
  }
  return stableSort(state);
}

function validateDemoFixture(state) {
  if (!isPlainObject(state)) {
    throw new BLHDataError('INVALID_STATE', 'Demo fixture must be an object');
  }
  if (state.schema !== 'beaufortLearningHarbor.demoFixture.v1') {
    throw new BLHDataError('INVALID_STATE', 'Demo fixture schema is missing or unsupported');
  }
  if (typeof state.fixtureId !== 'string' || !state.fixtureId.trim()) {
    throw new BLHDataError('INVALID_STATE', 'Demo fixture id is required');
  }
  if (!isPlainObject(state.family) || typeof state.family.id !== 'string' || typeof state.family.name !== 'string') {
    throw new BLHDataError('INVALID_STATE', 'Demo fixture family is invalid');
  }
  if (!Array.isArray(state.students)) {
    throw new BLHDataError('INVALID_STATE', 'Demo fixture students must be an array');
  }
  return state;
}

export function sanitizeState(state, kind = BLH_DATA_KINDS.APPLICATION_STATE, options = {}) {
  if (kind === BLH_DATA_KINDS.APPLICATION_STATE) {
    return sanitizeApplicationState(state, options);
  }
  if (kind === BLH_DATA_KINDS.DEMO_FIXTURE) {
    return validateDemoFixture(pickAllowed(state, FIXTURE_KEYS, '$.state'));
  }
  throw new BLHDataError('UNSUPPORTED_KIND', `Unsupported data kind: ${String(kind)}`);
}

export function createEnvelope(state, options = {}) {
  const kind = options.kind || BLH_DATA_KINDS.APPLICATION_STATE;
  const productVersion = options.productVersion || BLH_PRODUCT_VERSION;
  const portable = options.portable !== false;
  if (typeof productVersion !== 'string' || !productVersion.trim()) {
    throw new BLHDataError('INVALID_ENVELOPE', 'Product version must be a non-empty string');
  }
  const envelope = {
    format: BLH_DATA_FORMAT,
    kind,
    productVersion,
    schemaVersion: BLH_SCHEMA_VERSION,
    state: sanitizeState(state, kind, { portable })
  };
  if (options.metadata !== undefined) {
    if (!isPlainObject(options.metadata)) {
      throw new BLHDataError('INVALID_ENVELOPE', 'Envelope metadata must be an object');
    }
    envelope.metadata = cloneJsonValue(options.metadata, '$.metadata');
  }
  return stableSort(envelope);
}

function migrateLegacyFixture(value) {
  return createEnvelope(value, { kind: BLH_DATA_KINDS.DEMO_FIXTURE, portable: false });
}

function migrateLegacyApplicationState(value) {
  return createEnvelope(value, { kind: BLH_DATA_KINDS.APPLICATION_STATE, portable: false });
}

export function migrateToCurrent(value) {
  if (!isPlainObject(value)) {
    throw new BLHDataError('INVALID_ENVELOPE', 'Imported data must be an object');
  }

  if (value.format === BLH_DATA_FORMAT) {
    if (!Number.isInteger(value.schemaVersion)) {
      throw new BLHDataError('INVALID_ENVELOPE', 'Schema version must be an integer');
    }
    if (value.schemaVersion !== BLH_SCHEMA_VERSION) {
      throw new BLHDataError('UNSUPPORTED_SCHEMA', `Unsupported schema version: ${value.schemaVersion}`, {
        supported: [BLH_SCHEMA_VERSION]
      });
    }
    if (typeof value.productVersion !== 'string' || !value.productVersion.trim()) {
      throw new BLHDataError('INVALID_ENVELOPE', 'Product version is required');
    }
    if (!Object.values(BLH_DATA_KINDS).includes(value.kind)) {
      throw new BLHDataError('UNSUPPORTED_KIND', `Unsupported data kind: ${String(value.kind)}`);
    }
    return createEnvelope(value.state, {
      kind: value.kind,
      productVersion: value.productVersion,
      metadata: value.metadata,
      portable: false
    });
  }

  if (value.schema === 'beaufortLearningHarbor.demoFixture.v1') {
    return migrateLegacyFixture(value);
  }

  return migrateLegacyApplicationState(value);
}

export function parseImport(input) {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (error) {
      throw new BLHDataError('MALFORMED_JSON', 'Imported file is not valid JSON', { cause: error.message });
    }
  }
  return migrateToCurrent(value);
}

export function serializeEnvelope(envelope, options = {}) {
  const normalized = migrateToCurrent(envelope);
  const portable = options.portable !== false;
  const serializedEnvelope = createEnvelope(normalized.state, {
    kind: normalized.kind,
    productVersion: normalized.productVersion,
    metadata: normalized.metadata,
    portable
  });
  const space = options.pretty === false ? 0 : 2;
  return `${JSON.stringify(stableSort(serializedEnvelope), null, space)}\n`;
}

export function exportState(state, options = {}) {
  const envelope = createEnvelope(state, { ...options, portable: true });
  return serializeEnvelope(envelope, { ...options, portable: true });
}

export function readStoredState(storage, options = {}) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new BLHDataError('INVALID_STORAGE', 'A Storage-compatible object is required');
  }
  const key = options.key || BLH_LEGACY_STORAGE_KEY;
  const raw = storage.getItem(key);
  if (raw === null || raw === '') return null;
  return parseImport(raw);
}

export function commitImportedState(storage, input, options = {}) {
  if (!storage || typeof storage.setItem !== 'function') {
    throw new BLHDataError('INVALID_STORAGE', 'A Storage-compatible object is required');
  }
  const envelope = parseImport(input);
  if (envelope.kind !== BLH_DATA_KINDS.APPLICATION_STATE) {
    throw new BLHDataError('UNSUPPORTED_KIND', 'Only application-state data can be committed to browser storage');
  }
  const key = options.key || BLH_LEGACY_STORAGE_KEY;
  const serializedState = JSON.stringify(envelope.state);
  storage.setItem(key, serializedState);
  return envelope;
}
