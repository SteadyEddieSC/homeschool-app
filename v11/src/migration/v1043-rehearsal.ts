export const RC1_RELEASE = '11.0.0-rc.1';
export const LEGACY_RELEASE = '10.43.0';
export const LEGACY_EXPORT_SCHEMA = 'beaufort-learning-harbor-v10.43-export-v1';
export const REHEARSAL_STORE_SCHEMA = 'beaufort-learning-harbor-rc1-rehearsal-store-v1';
export const MIGRATION_PLAN_SCHEMA = 'beaufort-learning-harbor-rc1-migration-plan-v1';
export const MIGRATION_RECEIPT_SCHEMA = 'beaufort-learning-harbor-rc1-migration-receipt-v1';
export const READINESS_REPORT_SCHEMA = 'beaufort-learning-harbor-rc1-readiness-report-v1';
export const REHEARSAL_STORAGE_KEY = 'beaufortLearningHarbor.v11.rc1.migrationRehearsal';
export const REHEARSAL_ROLLBACK_KEY = 'beaufortLearningHarbor.v11.rc1.migrationRollback';
export const REHEARSAL_RECEIPT_KEY = 'beaufortLearningHarbor.v11.rc1.migrationReceipt';
export const REHEARSAL_RESTORE_KEY = 'beaufortLearningHarbor.v11.rc1.vendorExitRestore';

const ENCRYPTED_BACKUP_SCHEMA = 'beaufort-learning-harbor-encrypted-backup-v1';
const VENDOR_EXIT_PAYLOAD_SCHEMA = 'beaufort-learning-harbor-rc1-vendor-exit-v1';
const MAX_SOURCE_BYTES = 512_000;
const MAX_RECORDS = 500;
const PBKDF2_ITERATIONS = 120_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SYNTHETIC_ID_PATTERN = /^syn-[a-z0-9-]{3,80}$/;
const FORBIDDEN_KEY_PATTERN = /(password|passphrase|secret|credential|session|service.?role|access.?token|refresh.?token|client.?secret|api.?key)/i;
const CREDENTIAL_LIKE_PATTERN = /(sb_secret_|service_role|-----BEGIN .*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.)/i;

export type ActivityType = 'learn' | 'practice' | 'quiz' | 'proof';
export type LegacyAssignmentStatus = 'assigned' | 'in-progress' | 'ready-for-review' | 'returned' | 'completed';
export type MigrationAction = 'create' | 'match' | 'update-review-required' | 'conflict' | 'unsupported';
export type OwnerDecision = 'not-ready' | 'pilot-only' | 'production-ready';

interface LegacyHousehold { id: string; name: string }
interface LegacyLearner { id: string; householdId: string; preferredName: string; pronouns: string; gradeBand: string; avatar: string }
interface LegacyAssignment {
  id: string; learnerId: string; title: string; instructions: string; activityType: ActivityType; dueDate: string;
  status: LegacyAssignmentStatus; learnerNote: string; reviewFeedback: string;
}
interface LegacyQuestion {
  id: string; type: 'multiple-choice' | 'true-false'; prompt: string; options: string[]; correctOption: number; explanation: string;
}
interface LegacyKnowledgeCheck { id: string; assignmentId: string; title: string; questions: LegacyQuestion[] }
interface LegacyKnowledgeAttempt { id: string; checkId: string; answers: number[]; submittedAt: string }
interface LegacyEvidence {
  id: string; assignmentId: string; kind: 'text' | 'link'; content: string; learnerNote: string; revision: number;
  status: 'pending' | 'accepted' | 'returned'; adultFeedback: string;
}
interface LegacyWeeklyPlan { id: string; householdId: string; weekStart: string; title: string }
interface LegacyWeeklyPlanItem {
  id: string; planId: string; learnerId: string; scheduledDate: string; title: string; activityType: ActivityType; assignmentId: string | null;
}
interface UnsupportedLegacyRecord { kind: string; count: number; reason: string }

export interface LegacyV1043Export {
  schema: typeof LEGACY_EXPORT_SCHEMA;
  release: typeof LEGACY_RELEASE;
  rehearsal: true;
  synthetic: true;
  exportedAt: string;
  organization: { id: string; name: string };
  records: {
    households: LegacyHousehold[];
    learners: LegacyLearner[];
    assignments: LegacyAssignment[];
    knowledgeChecks: LegacyKnowledgeCheck[];
    knowledgeAttempts: LegacyKnowledgeAttempt[];
    evidenceSubmissions: LegacyEvidence[];
    weeklyPlans: LegacyWeeklyPlan[];
    weeklyPlanItems: LegacyWeeklyPlanItem[];
    unsupported: UnsupportedLegacyRecord[];
  };
  exclusions: string[];
}

export interface RehearsalStore {
  schema: typeof REHEARSAL_STORE_SCHEMA;
  release: typeof RC1_RELEASE;
  records: Record<string, Array<Record<string, unknown>>>;
  receipts: Record<string, { targetType: string; targetId: string; action: MigrationAction }>;
  appliedPlanDigest: string | null;
}

export interface MigrationOperation {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  action: MigrationAction;
  reason: string;
  recordDigest: string | null;
  record: Record<string, unknown> | null;
}

export interface MigrationPlan {
  schema: typeof MIGRATION_PLAN_SCHEMA;
  sourceRelease: typeof LEGACY_RELEASE;
  targetRelease: typeof RC1_RELEASE;
  generatedAt: string;
  sourceDigest: string;
  targetBeforeDigest: string;
  planDigest: string;
  dryRunOnly: true;
  operations: MigrationOperation[];
  counts: Record<MigrationAction, number>;
  warnings: string[];
  exclusions: string[];
}

export interface MigrationReceipt {
  schema: typeof MIGRATION_RECEIPT_SCHEMA;
  release: typeof RC1_RELEASE;
  appliedAt: string;
  sourceDigest: string;
  planDigest: string;
  beforeDigest: string;
  afterDigest: string;
  idempotent: boolean;
  rollbackAvailable: boolean;
  counts: Record<MigrationAction, number>;
  operationReceipts: Array<{ operationId: string; targetType: string; targetId: string; action: MigrationAction }>;
  exclusions: string[];
}

export interface RecoveryRehearsalReport {
  schema: 'beaufort-learning-harbor-rc1-recovery-rehearsal-v1';
  release: typeof RC1_RELEASE;
  completedAt: string;
  passed: boolean;
  rtoMilliseconds: number;
  rpoRecords: number;
  sourceDigest: string;
  appliedDigest: string;
  restoredDigest: string;
  rollbackDigest: string;
  exclusions: string[];
}

export interface ProductionReadinessReport {
  schema: typeof READINESS_REPORT_SCHEMA;
  release: typeof RC1_RELEASE;
  evaluatedAt: string;
  requestedDecision: OwnerDecision;
  effectiveDecision: OwnerDecision;
  productionReady: false;
  localPilotReady: boolean;
  automatedEvidence: Array<{ id: string; passed: boolean; evidence: string }>;
  blockedProviderChecks: string[];
  ownerApprovalsRequired: string[];
  residualRisks: string[];
}

interface BackupEnvelope {
  schema: typeof ENCRYPTED_BACKUP_SCHEMA;
  release: typeof RC1_RELEASE;
  createdAt: string;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  checksum: { algorithm: 'SHA-256'; value: string };
  ciphertext: string;
}

interface VendorExitPayload {
  schema: typeof VENDOR_EXIT_PAYLOAD_SCHEMA;
  release: typeof RC1_RELEASE;
  exportedAt: string;
  storeDigest: string;
  store: RehearsalStore;
  exclusions: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} contains unsupported or missing fields.`);
}

function text(value: unknown, label: string, maximum = 5_000, allowEmpty = false): string {
  assert(typeof value === 'string', `${label} must be text.`);
  const normalized = value.trim();
  assert(allowEmpty || normalized.length > 0, `${label} is required.`);
  assert(normalized.length <= maximum, `${label} is too long.`);
  assert(!CREDENTIAL_LIKE_PATTERN.test(normalized), `${label} contains credential-like material.`);
  return normalized;
}

function syntheticText(value: unknown, label: string, maximum = 5_000, allowEmpty = false): string {
  const normalized = text(value, label, maximum, allowEmpty);
  if (!normalized) return normalized;
  assert(/synthetic/i.test(normalized), `${label} must be clearly synthetic for this rehearsal.`);
  return normalized;
}

function syntheticId(value: unknown, label: string): string {
  const normalized = text(value, label, 90);
  assert(SYNTHETIC_ID_PATTERN.test(normalized), `${label} must use a syn- synthetic identifier.`);
  return normalized;
}

function integer(value: unknown, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  assert(Number.isInteger(value), `${label} must be an integer.`);
  const numberValue = value as number;
  assert(numberValue >= minimum && numberValue <= maximum, `${label} is outside the allowed range.`);
  return numberValue;
}

function isoTimestamp(value: unknown, label: string): string {
  const normalized = text(value, label, 40);
  assert(Number.isFinite(Date.parse(normalized)), `${label} must be an ISO timestamp.`);
  return normalized;
}

function localDate(value: unknown, label: string): string {
  const normalized = text(value, label, 10);
  assert(DATE_PATTERN.test(normalized) && Number.isFinite(Date.parse(`${normalized}T00:00:00Z`)), `${label} must be YYYY-MM-DD.`);
  return normalized;
}

function stringArray(value: unknown, label: string, maximumItems = 20): string[] {
  assert(Array.isArray(value), `${label} must be a list.`);
  assert(value.length <= maximumItems, `${label} has too many items.`);
  return value.map((item, index) => text(item, `${label}[${index}]`, 500));
}

function scanForbidden(value: unknown, path = 'source'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    assert(!FORBIDDEN_KEY_PATTERN.test(key), `${path}.${key} is a forbidden credential or session field.`);
    scanForbidden(item, `${path}.${key}`);
  }
}

function parseArray<T>(value: unknown, label: string, parser: (record: Record<string, unknown>, index: number) => T): T[] {
  assert(Array.isArray(value), `${label} must be a list.`);
  return value.map((item, index) => {
    assert(isObject(item), `${label}[${index}] must be an object.`);
    return parser(item, index);
  });
}

function parseHousehold(record: Record<string, unknown>, index: number): LegacyHousehold {
  assertExactKeys(record, ['id', 'name'], `households[${index}]`);
  return { id: syntheticId(record.id, `households[${index}].id`), name: syntheticText(record.name, `households[${index}].name`, 100) };
}

function parseLearner(record: Record<string, unknown>, index: number): LegacyLearner {
  assertExactKeys(record, ['id', 'householdId', 'preferredName', 'pronouns', 'gradeBand', 'avatar'], `learners[${index}]`);
  return {
    id: syntheticId(record.id, `learners[${index}].id`), householdId: syntheticId(record.householdId, `learners[${index}].householdId`),
    preferredName: syntheticText(record.preferredName, `learners[${index}].preferredName`, 80),
    pronouns: text(record.pronouns, `learners[${index}].pronouns`, 40, true), gradeBand: text(record.gradeBand, `learners[${index}].gradeBand`, 20),
    avatar: text(record.avatar, `learners[${index}].avatar`, 40)
  };
}

function activityType(value: unknown, label: string): ActivityType {
  assert(['learn', 'practice', 'quiz', 'proof'].includes(String(value)), `${label} is unsupported.`);
  return value as ActivityType;
}

function assignmentStatus(value: unknown, label: string): LegacyAssignmentStatus {
  assert(['assigned', 'in-progress', 'ready-for-review', 'returned', 'completed'].includes(String(value)), `${label} is unsupported.`);
  return value as LegacyAssignmentStatus;
}

function parseAssignment(record: Record<string, unknown>, index: number): LegacyAssignment {
  assertExactKeys(record, ['id', 'learnerId', 'title', 'instructions', 'activityType', 'dueDate', 'status', 'learnerNote', 'reviewFeedback'], `assignments[${index}]`);
  return {
    id: syntheticId(record.id, `assignments[${index}].id`), learnerId: syntheticId(record.learnerId, `assignments[${index}].learnerId`),
    title: syntheticText(record.title, `assignments[${index}].title`, 140), instructions: syntheticText(record.instructions, `assignments[${index}].instructions`, 2_000),
    activityType: activityType(record.activityType, `assignments[${index}].activityType`), dueDate: localDate(record.dueDate, `assignments[${index}].dueDate`),
    status: assignmentStatus(record.status, `assignments[${index}].status`), learnerNote: syntheticText(record.learnerNote, `assignments[${index}].learnerNote`, 1_000, true),
    reviewFeedback: text(record.reviewFeedback, `assignments[${index}].reviewFeedback`, 1_000, true)
  };
}

function parseQuestion(record: Record<string, unknown>, label: string): LegacyQuestion {
  assertExactKeys(record, ['id', 'type', 'prompt', 'options', 'correctOption', 'explanation'], label);
  const typeValue = text(record.type, `${label}.type`, 30);
  assert(typeValue === 'multiple-choice' || typeValue === 'true-false', `${label}.type is unsupported.`);
  const options = stringArray(record.options, `${label}.options`, 6);
  assert(options.length >= 2, `${label}.options must contain at least two choices.`);
  if (typeValue === 'true-false') assert(options.length === 2, `${label}.options must contain two true/false choices.`);
  const correctOption = integer(record.correctOption, `${label}.correctOption`, 0, options.length - 1);
  return {
    id: syntheticId(record.id, `${label}.id`), type: typeValue, prompt: syntheticText(record.prompt, `${label}.prompt`, 500), options,
    correctOption, explanation: text(record.explanation, `${label}.explanation`, 500)
  };
}

function parseCheck(record: Record<string, unknown>, index: number): LegacyKnowledgeCheck {
  assertExactKeys(record, ['id', 'assignmentId', 'title', 'questions'], `knowledgeChecks[${index}]`);
  const questions = parseArray(record.questions, `knowledgeChecks[${index}].questions`, (question, questionIndex) => parseQuestion(question, `knowledgeChecks[${index}].questions[${questionIndex}]`));
  assert(questions.length > 0 && questions.length <= 20, `knowledgeChecks[${index}] must contain 1-20 questions.`);
  return {
    id: syntheticId(record.id, `knowledgeChecks[${index}].id`), assignmentId: syntheticId(record.assignmentId, `knowledgeChecks[${index}].assignmentId`),
    title: syntheticText(record.title, `knowledgeChecks[${index}].title`, 140), questions
  };
}

function parseAttempt(record: Record<string, unknown>, index: number): LegacyKnowledgeAttempt {
  assertExactKeys(record, ['id', 'checkId', 'answers', 'submittedAt'], `knowledgeAttempts[${index}]`);
  assert(Array.isArray(record.answers), `knowledgeAttempts[${index}].answers must be a list.`);
  return {
    id: syntheticId(record.id, `knowledgeAttempts[${index}].id`), checkId: syntheticId(record.checkId, `knowledgeAttempts[${index}].checkId`),
    answers: record.answers.map((answer, answerIndex) => integer(answer, `knowledgeAttempts[${index}].answers[${answerIndex}]`, 0, 10)),
    submittedAt: isoTimestamp(record.submittedAt, `knowledgeAttempts[${index}].submittedAt`)
  };
}

function parseEvidence(record: Record<string, unknown>, index: number): LegacyEvidence {
  assertExactKeys(record, ['id', 'assignmentId', 'kind', 'content', 'learnerNote', 'revision', 'status', 'adultFeedback'], `evidenceSubmissions[${index}]`);
  const kind = text(record.kind, `evidenceSubmissions[${index}].kind`, 10);
  assert(kind === 'text' || kind === 'link', `evidenceSubmissions[${index}].kind is unsupported.`);
  const status = text(record.status, `evidenceSubmissions[${index}].status`, 20);
  assert(['pending', 'accepted', 'returned'].includes(status), `evidenceSubmissions[${index}].status is unsupported.`);
  return {
    id: syntheticId(record.id, `evidenceSubmissions[${index}].id`), assignmentId: syntheticId(record.assignmentId, `evidenceSubmissions[${index}].assignmentId`),
    kind, content: syntheticText(record.content, `evidenceSubmissions[${index}].content`, 5_000),
    learnerNote: syntheticText(record.learnerNote, `evidenceSubmissions[${index}].learnerNote`, 1_000, true),
    revision: integer(record.revision, `evidenceSubmissions[${index}].revision`, 1, 100), status: status as LegacyEvidence['status'],
    adultFeedback: text(record.adultFeedback, `evidenceSubmissions[${index}].adultFeedback`, 1_000, true)
  };
}

function parsePlan(record: Record<string, unknown>, index: number): LegacyWeeklyPlan {
  assertExactKeys(record, ['id', 'householdId', 'weekStart', 'title'], `weeklyPlans[${index}]`);
  return {
    id: syntheticId(record.id, `weeklyPlans[${index}].id`), householdId: syntheticId(record.householdId, `weeklyPlans[${index}].householdId`),
    weekStart: localDate(record.weekStart, `weeklyPlans[${index}].weekStart`), title: syntheticText(record.title, `weeklyPlans[${index}].title`, 140)
  };
}

function parsePlanItem(record: Record<string, unknown>, index: number): LegacyWeeklyPlanItem {
  assertExactKeys(record, ['id', 'planId', 'learnerId', 'scheduledDate', 'title', 'activityType', 'assignmentId'], `weeklyPlanItems[${index}]`);
  return {
    id: syntheticId(record.id, `weeklyPlanItems[${index}].id`), planId: syntheticId(record.planId, `weeklyPlanItems[${index}].planId`),
    learnerId: syntheticId(record.learnerId, `weeklyPlanItems[${index}].learnerId`), scheduledDate: localDate(record.scheduledDate, `weeklyPlanItems[${index}].scheduledDate`),
    title: syntheticText(record.title, `weeklyPlanItems[${index}].title`, 140), activityType: activityType(record.activityType, `weeklyPlanItems[${index}].activityType`),
    assignmentId: record.assignmentId === null ? null : syntheticId(record.assignmentId, `weeklyPlanItems[${index}].assignmentId`)
  };
}

function parseUnsupported(record: Record<string, unknown>, index: number): UnsupportedLegacyRecord {
  assertExactKeys(record, ['kind', 'count', 'reason'], `unsupported[${index}]`);
  return { kind: text(record.kind, `unsupported[${index}].kind`, 80), count: integer(record.count, `unsupported[${index}].count`, 1, 10_000), reason: text(record.reason, `unsupported[${index}].reason`, 500) };
}

function assertRelationships(source: LegacyV1043Export): void {
  const households = new Set(source.records.households.map((record) => record.id));
  const learners = new Map(source.records.learners.map((record) => [record.id, record]));
  const assignments = new Map(source.records.assignments.map((record) => [record.id, record]));
  const checks = new Map(source.records.knowledgeChecks.map((record) => [record.id, record]));
  const plans = new Map(source.records.weeklyPlans.map((record) => [record.id, record]));
  for (const learner of learners.values()) assert(households.has(learner.householdId), `Learner ${learner.id} references an unknown household.`);
  for (const assignment of assignments.values()) assert(learners.has(assignment.learnerId), `Assignment ${assignment.id} references an unknown learner.`);
  for (const check of checks.values()) {
    const assignment = assignments.get(check.assignmentId);
    assert(assignment?.activityType === 'quiz', `Knowledge check ${check.id} must reference a quiz assignment.`);
  }
  for (const attempt of source.records.knowledgeAttempts) {
    const check = checks.get(attempt.checkId);
    assert(check, `Knowledge attempt ${attempt.id} references an unknown check.`);
    assert(attempt.answers.length === check.questions.length, `Knowledge attempt ${attempt.id} must answer every question.`);
    attempt.answers.forEach((answer, index) => assert(answer < (check.questions[index]?.options.length ?? 0), `Knowledge attempt ${attempt.id} answer ${index} is invalid.`));
  }
  for (const evidence of source.records.evidenceSubmissions) {
    const assignment = assignments.get(evidence.assignmentId);
    assert(assignment?.activityType === 'proof', `Evidence ${evidence.id} must reference a proof assignment.`);
  }
  for (const plan of plans.values()) assert(households.has(plan.householdId), `Weekly plan ${plan.id} references an unknown household.`);
  for (const item of source.records.weeklyPlanItems) {
    const plan = plans.get(item.planId);
    assert(plan, `Plan item ${item.id} references an unknown weekly plan.`);
    assert(learners.has(item.learnerId), `Plan item ${item.id} references an unknown learner.`);
    if (item.assignmentId) assert(assignments.has(item.assignmentId), `Plan item ${item.id} references an unknown assignment.`);
    const offset = Math.round((Date.parse(`${item.scheduledDate}T00:00:00Z`) - Date.parse(`${plan.weekStart}T00:00:00Z`)) / 86_400_000);
    assert(offset >= 0 && offset <= 6, `Plan item ${item.id} falls outside the seven-day plan.`);
  }
}

export function parseLegacyV1043Export(serialized: string): LegacyV1043Export {
  assert(new TextEncoder().encode(serialized).byteLength <= MAX_SOURCE_BYTES, 'Migration source exceeds the 512 KB rehearsal limit.');
  let raw: unknown;
  try { raw = JSON.parse(serialized) as unknown; } catch { throw new Error('Migration source is not valid JSON.'); }
  assert(isObject(raw), 'Migration source must be an object.');
  scanForbidden(raw);
  assertExactKeys(raw, ['schema', 'release', 'rehearsal', 'synthetic', 'exportedAt', 'organization', 'records', 'exclusions'], 'Migration source');
  assert(raw.schema === LEGACY_EXPORT_SCHEMA, 'Migration source schema is not supported.');
  assert(raw.release === LEGACY_RELEASE, 'Only the reviewed v10.43 export format is supported.');
  assert(raw.rehearsal === true && raw.synthetic === true, 'Migration source must be explicitly synthetic rehearsal data.');
  assert(isObject(raw.organization), 'Migration organization is missing.');
  assertExactKeys(raw.organization, ['id', 'name'], 'Migration organization');
  assert(isObject(raw.records), 'Migration records are missing.');
  assertExactKeys(raw.records, ['households', 'learners', 'assignments', 'knowledgeChecks', 'knowledgeAttempts', 'evidenceSubmissions', 'weeklyPlans', 'weeklyPlanItems', 'unsupported'], 'Migration records');
  const source: LegacyV1043Export = {
    schema: LEGACY_EXPORT_SCHEMA, release: LEGACY_RELEASE, rehearsal: true, synthetic: true,
    exportedAt: isoTimestamp(raw.exportedAt, 'exportedAt'),
    organization: { id: syntheticId(raw.organization.id, 'organization.id'), name: syntheticText(raw.organization.name, 'organization.name', 120) },
    records: {
      households: parseArray(raw.records.households, 'households', parseHousehold),
      learners: parseArray(raw.records.learners, 'learners', parseLearner),
      assignments: parseArray(raw.records.assignments, 'assignments', parseAssignment),
      knowledgeChecks: parseArray(raw.records.knowledgeChecks, 'knowledgeChecks', parseCheck),
      knowledgeAttempts: parseArray(raw.records.knowledgeAttempts, 'knowledgeAttempts', parseAttempt),
      evidenceSubmissions: parseArray(raw.records.evidenceSubmissions, 'evidenceSubmissions', parseEvidence),
      weeklyPlans: parseArray(raw.records.weeklyPlans, 'weeklyPlans', parsePlan),
      weeklyPlanItems: parseArray(raw.records.weeklyPlanItems, 'weeklyPlanItems', parsePlanItem),
      unsupported: parseArray(raw.records.unsupported, 'unsupported', parseUnsupported)
    },
    exclusions: stringArray(raw.exclusions, 'exclusions', 20)
  };
  const total = Object.values(source.records).reduce((sum, records) => sum + records.length, 0);
  assert(total <= MAX_RECORDS, `Migration source contains ${total} records; the rehearsal limit is ${MAX_RECORDS}.`);
  assertRelationships(source);
  return source;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function digestValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await crypto.subtle.digest('SHA-256', ownedArrayBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

async function stableUuid(kind: string, sourceId: string): Promise<string> {
  const hex = (await digestValue(`${kind}:${sourceId}`)).slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16] ?? '0', 16) % 4] ?? '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

export function emptyRehearsalStore(): RehearsalStore {
  return { schema: REHEARSAL_STORE_SCHEMA, release: RC1_RELEASE, records: {}, receipts: {}, appliedPlanDigest: null };
}

export function loadRehearsalStore(): RehearsalStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(REHEARSAL_STORAGE_KEY) ?? 'null') as unknown;
    if (isObject(parsed) && parsed.schema === REHEARSAL_STORE_SCHEMA && parsed.release === RC1_RELEASE && isObject(parsed.records) && isObject(parsed.receipts)) {
      return parsed as unknown as RehearsalStore;
    }
  } catch {
    // A damaged rehearsal store is replaced rather than merged.
  }
  return emptyRehearsalStore();
}

function saveRehearsalStore(store: RehearsalStore): void {
  localStorage.setItem(REHEARSAL_STORAGE_KEY, JSON.stringify(store));
}

function recordCount(store: RehearsalStore): number {
  return Object.values(store.records).reduce((sum, records) => sum + records.length, 0);
}

function targetRecords(store: RehearsalStore, targetType: string): Array<Record<string, unknown>> {
  const records = store.records[targetType];
  if (records) return records;
  store.records[targetType] = [];
  return store.records[targetType] as Array<Record<string, unknown>>;
}

function finalAssignmentStatus(status: LegacyAssignmentStatus): { status: string; reviewRequired: boolean } {
  if (status === 'completed') return { status: 'ready-for-review', reviewRequired: true };
  return { status, reviewRequired: false };
}

function operationCounts(operations: MigrationOperation[]): Record<MigrationAction, number> {
  return operations.reduce<Record<MigrationAction, number>>((counts, operation) => {
    counts[operation.action] += 1;
    return counts;
  }, { create: 0, match: 0, 'update-review-required': 0, conflict: 0, unsupported: 0 });
}

async function plannedOperation(
  store: RehearsalStore,
  sourceType: string,
  sourceId: string,
  targetType: string,
  record: Record<string, unknown>,
  reviewRequired: boolean,
  reason: string
): Promise<MigrationOperation> {
  const targetId = String(record.id);
  const recordDigest = await digestValue(record);
  const existing = targetRecords(store, targetType).find((candidate) => candidate.id === targetId || candidate.legacySourceId === sourceId);
  let action: MigrationAction = reviewRequired ? 'update-review-required' : 'create';
  let finalReason = reason;
  if (existing) {
    const existingDigest = await digestValue(existing);
    if (existingDigest === recordDigest) {
      action = 'match';
      finalReason = 'Existing isolated record matches the deterministic migration result.';
    } else {
      action = 'conflict';
      finalReason = 'Existing isolated record differs and will not be overwritten.';
    }
  }
  return {
    id: await stableUuid('migration-operation', `${sourceType}:${sourceId}`), sourceType, sourceId, targetType, targetId,
    action, reason: finalReason, recordDigest, record
  };
}

export async function planLegacyMigration(source: LegacyV1043Export, store = loadRehearsalStore()): Promise<MigrationPlan> {
  const organizationId = await stableUuid('organization', source.organization.id);
  const householdIds = new Map<string, string>();
  const learnerIds = new Map<string, string>();
  const assignmentIds = new Map<string, string>();
  const checkIds = new Map<string, string>();
  const planIds = new Map<string, string>();
  for (const household of source.records.households) householdIds.set(household.id, await stableUuid('household', household.id));
  for (const learner of source.records.learners) learnerIds.set(learner.id, await stableUuid('learner', learner.id));
  for (const assignment of source.records.assignments) assignmentIds.set(assignment.id, await stableUuid('today-item', assignment.id));
  for (const check of source.records.knowledgeChecks) checkIds.set(check.id, await stableUuid('knowledge-check', check.id));
  for (const plan of source.records.weeklyPlans) planIds.set(plan.id, await stableUuid('weekly-plan', plan.id));

  const operations: MigrationOperation[] = [];
  operations.push(await plannedOperation(store, 'organization', source.organization.id, 'organizations', {
    id: organizationId, legacySourceId: source.organization.id, name: source.organization.name, slug: `migration-${source.organization.id}`,
    rehearsalOnly: true, createdAt: source.exportedAt
  }, false, 'Create the isolated rehearsal organization.'));

  for (const household of source.records.households) {
    operations.push(await plannedOperation(store, 'household', household.id, 'households', {
      id: householdIds.get(household.id), legacySourceId: household.id, organizationId, name: household.name, createdAt: source.exportedAt
    }, false, 'Create the household in the isolated rehearsal store.'));
  }

  for (const learner of source.records.learners) {
    operations.push(await plannedOperation(store, 'learner', learner.id, 'learners', {
      id: learnerIds.get(learner.id), legacySourceId: learner.id, organizationId, householdId: householdIds.get(learner.householdId),
      preferredName: learner.preferredName, pronouns: learner.pronouns, gradeBand: learner.gradeBand, avatar: learner.avatar,
      accessMode: 'parent-assisted', status: 'active', createdAt: source.exportedAt, updatedAt: source.exportedAt
    }, false, 'Create a parent-managed learner without an independent login.'));
  }

  for (const assignment of source.records.assignments) {
    const learner = source.records.learners.find((candidate) => candidate.id === assignment.learnerId);
    assert(learner, `Assignment ${assignment.id} lost its learner relationship.`);
    const status = finalAssignmentStatus(assignment.status);
    operations.push(await plannedOperation(store, 'assignment', assignment.id, 'todayItems', {
      id: assignmentIds.get(assignment.id), legacySourceId: assignment.id, organizationId, householdId: householdIds.get(learner.householdId),
      learnerId: learnerIds.get(assignment.learnerId), title: assignment.title, instructions: assignment.instructions,
      activityType: assignment.activityType, dueDate: assignment.dueDate, status: status.status,
      learnerNote: assignment.learnerNote, reviewFeedback: assignment.reviewFeedback,
      assignedBy: 'migration-rehearsal', reviewedBy: null, completedAt: null, createdAt: source.exportedAt, updatedAt: source.exportedAt
    }, status.reviewRequired, status.reviewRequired
      ? 'Legacy completion is imported as awaiting adult review; completion authority is not carried forward.'
      : 'Create the Today item without manufacturing completion, grades, mastery, attendance, or XP.'));
  }

  for (const check of source.records.knowledgeChecks) {
    const assignment = source.records.assignments.find((candidate) => candidate.id === check.assignmentId);
    assert(assignment, `Knowledge check ${check.id} lost its assignment relationship.`);
    const learner = source.records.learners.find((candidate) => candidate.id === assignment.learnerId);
    assert(learner, `Knowledge check ${check.id} lost its learner relationship.`);
    operations.push(await plannedOperation(store, 'knowledge-check', check.id, 'knowledgeChecks', {
      id: checkIds.get(check.id), legacySourceId: check.id, organizationId, householdId: householdIds.get(learner.householdId),
      learnerId: learnerIds.get(learner.id), todayItemId: assignmentIds.get(check.assignmentId), title: check.title,
      questions: check.questions, createdBy: 'migration-rehearsal', createdAt: source.exportedAt
    }, false, 'Create the deterministic objective knowledge check.'));
  }

  for (const attempt of source.records.knowledgeAttempts) {
    const check = source.records.knowledgeChecks.find((candidate) => candidate.id === attempt.checkId);
    assert(check, `Knowledge attempt ${attempt.id} lost its check relationship.`);
    const assignment = source.records.assignments.find((candidate) => candidate.id === check.assignmentId);
    assert(assignment, `Knowledge attempt ${attempt.id} lost its assignment relationship.`);
    const learner = source.records.learners.find((candidate) => candidate.id === assignment.learnerId);
    assert(learner, `Knowledge attempt ${attempt.id} lost its learner relationship.`);
    const results = check.questions.map((question, index) => ({
      questionId: question.id, selectedOption: attempt.answers[index], correctOption: question.correctOption,
      correct: attempt.answers[index] === question.correctOption
    }));
    const correctCount = results.filter((result) => result.correct).length;
    operations.push(await plannedOperation(store, 'knowledge-attempt', attempt.id, 'knowledgeAttempts', {
      id: await stableUuid('knowledge-attempt', attempt.id), legacySourceId: attempt.id, organizationId,
      householdId: householdIds.get(learner.householdId), learnerId: learnerIds.get(learner.id),
      todayItemId: assignmentIds.get(assignment.id), checkId: checkIds.get(check.id), answers: attempt.answers,
      correctCount, totalQuestions: results.length, percentage: Math.round((correctCount / results.length) * 100), results,
      submittedAt: attempt.submittedAt, informationalOnly: true
    }, false, 'Preserve the deterministic tool score as informational evidence; it does not complete work.'));
  }

  for (const evidence of source.records.evidenceSubmissions) {
    const assignment = source.records.assignments.find((candidate) => candidate.id === evidence.assignmentId);
    assert(assignment, `Evidence ${evidence.id} lost its assignment relationship.`);
    const learner = source.records.learners.find((candidate) => candidate.id === assignment.learnerId);
    assert(learner, `Evidence ${evidence.id} lost its learner relationship.`);
    const requiresReview = evidence.status === 'accepted';
    operations.push(await plannedOperation(store, 'evidence-submission', evidence.id, 'evidenceSubmissions', {
      id: await stableUuid('evidence-submission', evidence.id), legacySourceId: evidence.id, organizationId,
      householdId: householdIds.get(learner.householdId), learnerId: learnerIds.get(learner.id), todayItemId: assignmentIds.get(assignment.id),
      title: assignment.title, kind: evidence.kind, content: evidence.content, learnerNote: evidence.learnerNote, revision: evidence.revision,
      previousSubmissionId: null, status: requiresReview ? 'pending' : evidence.status,
      adultFeedback: evidence.adultFeedback, submittedAt: source.exportedAt, reviewedAt: null, reviewedBy: null
    }, requiresReview, requiresReview
      ? 'Legacy proof acceptance is not authoritative in v11 and requires an explicit adult re-review.'
      : 'Preserve the proof revision while retaining explicit adult-review authority.'));
  }

  for (const plan of source.records.weeklyPlans) {
    operations.push(await plannedOperation(store, 'weekly-plan', plan.id, 'weeklyPlans', {
      id: planIds.get(plan.id), legacySourceId: plan.id, organizationId, householdId: householdIds.get(plan.householdId),
      weekStart: plan.weekStart, title: plan.title, createdBy: 'migration-rehearsal', createdAt: source.exportedAt
    }, false, 'Create the seven-day household plan.'));
  }

  for (const item of source.records.weeklyPlanItems) {
    const learner = source.records.learners.find((candidate) => candidate.id === item.learnerId);
    assert(learner, `Plan item ${item.id} lost its learner relationship.`);
    operations.push(await plannedOperation(store, 'weekly-plan-item', item.id, 'weeklyPlanItems', {
      id: await stableUuid('weekly-plan-item', item.id), legacySourceId: item.id, organizationId,
      householdId: householdIds.get(learner.householdId), planId: planIds.get(item.planId), learnerId: learnerIds.get(item.learnerId),
      scheduledDate: item.scheduledDate, title: item.title, activityType: item.activityType,
      todayItemId: item.assignmentId ? assignmentIds.get(item.assignmentId) : null, createdAt: source.exportedAt
    }, false, 'Create the plan item without creating completion or attendance.'));
  }

  for (const unsupported of source.records.unsupported) {
    operations.push({
      id: await stableUuid('unsupported', unsupported.kind), sourceType: unsupported.kind, sourceId: `unsupported-${unsupported.kind}`,
      targetType: 'unsupported', targetId: '', action: 'unsupported', reason: unsupported.reason,
      recordDigest: await digestValue({ kind: unsupported.kind, count: unsupported.count }), record: null
    });
  }

  const sourceDigest = await digestValue(source);
  const targetBeforeDigest = await digestValue(store);
  const counts = operationCounts(operations);
  const planCore = { sourceDigest, targetBeforeDigest, operations: operations.map(({ record, ...operation }) => ({ ...operation, hasRecord: Boolean(record) })), counts };
  return {
    schema: MIGRATION_PLAN_SCHEMA, sourceRelease: LEGACY_RELEASE, targetRelease: RC1_RELEASE,
    generatedAt: source.exportedAt, sourceDigest, targetBeforeDigest, planDigest: await digestValue(planCore), dryRunOnly: true,
    operations, counts,
    warnings: [
      'This plan is synthetic-only and cannot target live v11 application storage.',
      'Legacy completion and accepted proof require explicit adult re-review.',
      'Conflicts remain unresolved and are never silently overwritten.',
      'Unsupported XP and gamification records are reported but not migrated.'
    ],
    exclusions: ['record content from receipts', 'credentials and sessions', 'provider configuration', 'live application storage', 'automatic outcome authority']
  };
}

export async function applyMigrationPlan(plan: MigrationPlan): Promise<MigrationReceipt> {
  assert(plan.schema === MIGRATION_PLAN_SCHEMA && plan.targetRelease === RC1_RELEASE, 'Migration plan is not supported by rc.1.');
  const store = loadRehearsalStore();
  const beforeDigest = await digestValue(store);
  if (!localStorage.getItem(REHEARSAL_ROLLBACK_KEY)) localStorage.setItem(REHEARSAL_ROLLBACK_KEY, JSON.stringify(store));
  let idempotent = true;
  for (const operation of plan.operations) {
    if (operation.action === 'conflict' || operation.action === 'unsupported' || operation.action === 'match' || !operation.record) continue;
    if (store.receipts[operation.id]) continue;
    idempotent = false;
    const records = targetRecords(store, operation.targetType);
    if (!records.some((record) => record.id === operation.targetId)) records.push(structuredClone(operation.record));
    store.receipts[operation.id] = { targetType: operation.targetType, targetId: operation.targetId, action: operation.action };
  }
  store.appliedPlanDigest = plan.planDigest;
  saveRehearsalStore(store);
  const receipt: MigrationReceipt = {
    schema: MIGRATION_RECEIPT_SCHEMA, release: RC1_RELEASE, appliedAt: new Date().toISOString(),
    sourceDigest: plan.sourceDigest, planDigest: plan.planDigest, beforeDigest, afterDigest: await digestValue(store),
    idempotent, rollbackAvailable: Boolean(localStorage.getItem(REHEARSAL_ROLLBACK_KEY)), counts: plan.counts,
    operationReceipts: Object.entries(store.receipts).map(([operationId, value]) => ({ operationId, ...value })),
    exclusions: ['learner names and work', 'assignment and proof content', 'queue payloads', 'credentials and sessions', 'raw error text']
  };
  localStorage.setItem(REHEARSAL_RECEIPT_KEY, JSON.stringify(receipt));
  return receipt;
}

export async function rollbackMigrationRehearsal(): Promise<{ restored: boolean; expectedDigest: string; actualDigest: string }> {
  const serialized = localStorage.getItem(REHEARSAL_ROLLBACK_KEY);
  assert(serialized, 'No migration rollback checkpoint is available.');
  const snapshot = JSON.parse(serialized) as RehearsalStore;
  const expectedDigest = await digestValue(snapshot);
  saveRehearsalStore(snapshot);
  localStorage.removeItem(REHEARSAL_ROLLBACK_KEY);
  const actualDigest = await digestValue(loadRehearsalStore());
  return { restored: expectedDigest === actualDigest, expectedDigest, actualDigest };
}

export function clearMigrationRehearsal(): void {
  localStorage.removeItem(REHEARSAL_STORAGE_KEY);
  localStorage.removeItem(REHEARSAL_ROLLBACK_KEY);
  localStorage.removeItem(REHEARSAL_RECEIPT_KEY);
  localStorage.removeItem(REHEARSAL_RESTORE_KEY);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  assert(passphrase.length >= 12, 'Vendor-exit passphrase must be at least 12 characters.');
  const material = await crypto.subtle.importKey('raw', ownedArrayBuffer(new TextEncoder().encode(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: ownedArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    material, { name: 'AES-GCM', length: 256 }, false, usage
  );
}

export async function createVendorExitBundle(passphrase: string): Promise<string> {
  const store = loadRehearsalStore();
  const payload: VendorExitPayload = {
    schema: VENDOR_EXIT_PAYLOAD_SCHEMA, release: RC1_RELEASE, exportedAt: new Date().toISOString(),
    storeDigest: await digestValue(store), store,
    exclusions: ['credentials and sessions', 'provider configuration', 'rollback checkpoints', 'live application storage']
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ownedArrayBuffer(iv) }, key, ownedArrayBuffer(plaintext)));
  const envelope: BackupEnvelope = {
    schema: ENCRYPTED_BACKUP_SCHEMA, release: RC1_RELEASE, createdAt: payload.exportedAt,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) }, checksum: { algorithm: 'SHA-256', value: await digestValue(Array.from(encrypted)) },
    ciphertext: bytesToBase64(encrypted)
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export async function restoreVendorExitBundle(serialized: string, passphrase: string): Promise<{ sourceDigest: string; restoredDigest: string; recordCount: number }> {
  let envelope: BackupEnvelope;
  try { envelope = JSON.parse(serialized) as BackupEnvelope; } catch { throw new Error('Vendor-exit bundle is not valid JSON.'); }
  assert(envelope.schema === ENCRYPTED_BACKUP_SCHEMA && envelope.release === RC1_RELEASE, 'Vendor-exit bundle is not supported by rc.1.');
  assert(envelope.kdf?.name === 'PBKDF2' && envelope.kdf.hash === 'SHA-256' && envelope.kdf.iterations === PBKDF2_ITERATIONS, 'Vendor-exit key derivation is not supported.');
  assert(envelope.cipher?.name === 'AES-GCM', 'Vendor-exit cipher is not supported.');
  const encrypted = base64ToBytes(envelope.ciphertext);
  assert(await digestValue(Array.from(encrypted)) === envelope.checksum?.value, 'Vendor-exit checksum verification failed.');
  const key = await deriveKey(passphrase, base64ToBytes(envelope.kdf.salt), ['decrypt']);
  let plaintext: ArrayBuffer;
  try { plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ownedArrayBuffer(base64ToBytes(envelope.cipher.iv)) }, key, ownedArrayBuffer(encrypted)); }
  catch { throw new Error('Vendor-exit bundle could not be decrypted.'); }
  const payload = JSON.parse(new TextDecoder().decode(plaintext)) as VendorExitPayload;
  assert(payload.schema === VENDOR_EXIT_PAYLOAD_SCHEMA && payload.release === RC1_RELEASE, 'Vendor-exit payload is not supported.');
  assert(payload.store?.schema === REHEARSAL_STORE_SCHEMA, 'Vendor-exit payload does not contain an isolated rehearsal store.');
  const restoredDigest = await digestValue(payload.store);
  assert(restoredDigest === payload.storeDigest, 'Vendor-exit restored checksum does not match the source.');
  localStorage.setItem(REHEARSAL_RESTORE_KEY, JSON.stringify(payload.store));
  return { sourceDigest: payload.storeDigest, restoredDigest, recordCount: recordCount(payload.store) };
}

export async function runRecoveryRehearsal(serializedSource: string, passphrase: string): Promise<RecoveryRehearsalReport> {
  const startedAt = performance.now();
  clearMigrationRehearsal();
  const source = parseLegacyV1043Export(serializedSource);
  const initialStore = loadRehearsalStore();
  const initialDigest = await digestValue(initialStore);
  const plan = await planLegacyMigration(source, initialStore);
  const receipt = await applyMigrationPlan(plan);
  const bundle = await createVendorExitBundle(passphrase);
  const restored = await restoreVendorExitBundle(bundle, passphrase);
  const rollback = await rollbackMigrationRehearsal();
  const rtoMilliseconds = Math.round((performance.now() - startedAt) * 100) / 100;
  const rpoRecords = restored.sourceDigest === restored.restoredDigest && rollback.actualDigest === initialDigest ? 0 : recordCount(loadRehearsalStore());
  return {
    schema: 'beaufort-learning-harbor-rc1-recovery-rehearsal-v1', release: RC1_RELEASE,
    completedAt: new Date().toISOString(), passed: rpoRecords === 0 && rollback.restored,
    rtoMilliseconds, rpoRecords, sourceDigest: plan.sourceDigest, appliedDigest: receipt.afterDigest,
    restoredDigest: restored.restoredDigest, rollbackDigest: rollback.actualDigest,
    exclusions: ['record content', 'learner names', 'credentials and sessions', 'provider configuration', 'raw error text']
  };
}

export function buildProductionReadinessReport(
  requestedDecision: OwnerDecision,
  options: { migrationPassed: boolean; recoveryPassed: boolean; browserProfilesPassed: boolean; databasePassed: boolean } = {
    migrationPassed: false, recoveryPassed: false, browserProfilesPassed: false, databasePassed: false
  }
): ProductionReadinessReport {
  const automatedEvidence = [
    { id: 'synthetic-migration', passed: options.migrationPassed, evidence: 'Strict v10.43 synthetic dry-run, isolated apply, idempotency, and rollback.' },
    { id: 'vendor-exit-recovery', passed: options.recoveryPassed, evidence: 'Encrypted vendor-exit restore with matching checksums and measured RTO/RPO.' },
    { id: 'responsive-browser', passed: options.browserProfilesPassed, evidence: 'Desktop, touch-tablet, and Pixel 7 release-candidate workflows.' },
    { id: 'database-authorization', passed: options.databasePassed, evidence: 'Migrations, RLS, idempotency, audit, and explicit authority boundaries.' }
  ];
  const localPilotReady = automatedEvidence.every((item) => item.passed);
  const blockedProviderChecks = [
    'Dedicated non-production Supabase project has not been owner-linked and remotely verified.',
    'Protected Cloudflare preview environment has not been owner-authorized and deployed.',
    'Production SMTP, abuse controls, rate limits, monitoring, and alert routing are not verified.',
    'A real hosted backup and restore rehearsal has not been performed.'
  ];
  const ownerApprovalsRequired = [
    'Privacy policy, terms, parental consent, retention, export, and deletion process approval.',
    'Security and authorization review approval for a bounded pilot.',
    'Production hostname, incident owner, support owner, and rollback authority approval.',
    'Explicit written production cutover decision after pilot findings are closed.'
  ];
  const residualRisks = [
    'This release validates synthetic migration behavior only; it is not a real-family migration utility.',
    'Provider quotas, delivery behavior, regional configuration, and operational support remain unverified.',
    'v10.43 remains the stable fallback and no automatic cutover exists.'
  ];
  const effectiveDecision: OwnerDecision = requestedDecision === 'production-ready'
    ? 'not-ready'
    : requestedDecision === 'pilot-only' && localPilotReady
      ? 'pilot-only'
      : 'not-ready';
  return {
    schema: READINESS_REPORT_SCHEMA, release: RC1_RELEASE, evaluatedAt: new Date().toISOString(),
    requestedDecision, effectiveDecision, productionReady: false, localPilotReady,
    automatedEvidence, blockedProviderChecks, ownerApprovalsRequired, residualRisks
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function rehearsalRecordCount(): number {
  return recordCount(loadRehearsalStore());
}
