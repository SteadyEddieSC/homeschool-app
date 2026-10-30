export const BLH_FAMILY_PLANNER_V2_VERSION = 'v10.42';
export const BLH_FAMILY_PLANNER_V2_SCHEMA = 1;
export const BLH_FAMILY_PLANNER_TEMPLATE_FORMAT = 'beaufort-learning-harbor-family-planner-template';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const MODES = new Set(['standard', 'catch-up', 'flex', 'co-op-heavy', 'break-light']);
const STATUSES = new Set(['planned', 'ready', 'carryover', 'archived']);
const TARGET_KINDS = new Set(['all', 'student', 'track']);
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,139}$/;
const MAX_ITEMS = 200;
const MAX_TEMPLATES = 40;

type Day = (typeof DAYS)[number];
type PlannerMode = 'standard' | 'catch-up' | 'flex' | 'co-op-heavy' | 'break-light';
type PlannerStatus = 'planned' | 'ready' | 'carryover' | 'archived';
type TargetKind = 'all' | 'student' | 'track';

type JsonRecord = Record<string, unknown>;

export interface PlannerCoOp {
  arrivalNotes: string;
  enabled: boolean;
  eventName: string;
  followUpOwner: string;
  materials: string;
  role: string;
}

export interface PlannerItem {
  adultNotes: string;
  carriedFromId: string;
  coOp: PlannerCoOp;
  createdAt: string;
  day: Day;
  endTime: string;
  id: string;
  itemType: string;
  location: string;
  order: number;
  sourceId: string;
  sourceScreen: string;
  startTime: string;
  status: PlannerStatus;
  studentDirections: string;
  subject: string;
  targetId: string;
  targetKind: TargetKind;
  title: string;
  updatedAt: string;
}

export interface PlannerWeek {
  coOpNotes: string;
  familyNotes: string;
  items: PlannerItem[];
  mode: PlannerMode;
  updatedAt: string;
  weekId: string;
}

export interface PlannerTemplateItem extends PlannerItem {
  sourceItemId: string;
}

export interface PlannerTemplate {
  coOpNotes: string;
  createdAt: string;
  description: string;
  familyNotes: string;
  format: typeof BLH_FAMILY_PLANNER_TEMPLATE_FORMAT;
  id: string;
  items: PlannerTemplateItem[];
  mode: PlannerMode;
  name: string;
  schemaVersion: typeof BLH_FAMILY_PLANNER_V2_SCHEMA;
  sourceWeekId: string;
}

export interface StudentRef {
  id: string;
  name?: string;
  levelId?: string;
  track?: string;
  trackId?: string;
}

export interface LearningLevelRef {
  id: string;
  name?: string;
}

export class BLHFamilyPlannerV2Error extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'BLHFamilyPlannerV2Error';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function isPlainObject(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertSafe(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafe(entry, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) throw new BLHFamilyPlannerV2Error('DANGEROUS_KEY', `Dangerous key rejected at ${path}.${key}`);
    assertSafe(value[key], `${path}.${key}`);
  }
}

function stable<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => stable(entry)) as T;
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) as T;
}

function text(value: unknown, path: string, max = 5000, required = false): string {
  const source = value === undefined || value === null ? '' : value;
  if (typeof source !== 'string') throw new BLHFamilyPlannerV2Error('INVALID_VALUE', `${path} must be a string`);
  const normalized = source.trim();
  if (required && !normalized) throw new BLHFamilyPlannerV2Error('INVALID_VALUE', `${path} is required`);
  if (normalized.length > max) throw new BLHFamilyPlannerV2Error('INVALID_VALUE', `${path} exceeds ${max} characters`);
  return normalized;
}

function id(value: unknown, path: string): string {
  const normalized = text(value, path, 140, true);
  if (!SAFE_ID.test(normalized)) throw new BLHFamilyPlannerV2Error('INVALID_ID', `${path} contains unsupported characters`);
  return normalized;
}

function time(value: unknown, path: string): string {
  const normalized = text(value, path, 5);
  if (normalized && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new BLHFamilyPlannerV2Error('INVALID_TIME', `${path} must use HH:MM`);
  }
  return normalized;
}

function normalizeItem(item: unknown, path = '$.items[0]'): PlannerItem {
  if (!isPlainObject(item)) throw new BLHFamilyPlannerV2Error('INVALID_ITEM', `${path} must be an object`);
  assertSafe(item, path);
  const day = text(item.day, `${path}.day`, 12, true);
  if (!DAYS.includes(day as Day)) throw new BLHFamilyPlannerV2Error('INVALID_ITEM', `${path}.day is unsupported`);
  const status = text(item.status || 'planned', `${path}.status`, 20, true);
  if (!STATUSES.has(status)) throw new BLHFamilyPlannerV2Error('INVALID_ITEM', `${path}.status is unsupported`);
  const targetKind = text(item.targetKind || 'all', `${path}.targetKind`, 20, true);
  if (!TARGET_KINDS.has(targetKind)) throw new BLHFamilyPlannerV2Error('INVALID_ITEM', `${path}.targetKind is unsupported`);
  const targetId = text(item.targetId, `${path}.targetId`, 160);
  if (targetKind !== 'all' && !targetId) throw new BLHFamilyPlannerV2Error('INVALID_ITEM', `${path}.targetId is required`);
  const startTime = time(item.startTime, `${path}.startTime`);
  const endTime = time(item.endTime, `${path}.endTime`);
  if (startTime && endTime && endTime < startTime) throw new BLHFamilyPlannerV2Error('INVALID_TIME', `${path}.endTime must not be earlier than startTime`);
  const coOp = isPlainObject(item.coOp) ? item.coOp : {};
  assertSafe(coOp, `${path}.coOp`);
  const numericOrder = Number(item.order);
  return stable({
    adultNotes: text(item.adultNotes, `${path}.adultNotes`, 5000),
    carriedFromId: text(item.carriedFromId, `${path}.carriedFromId`, 180),
    coOp: {
      arrivalNotes: text(coOp.arrivalNotes, `${path}.coOp.arrivalNotes`, 2000),
      enabled: coOp.enabled === true,
      eventName: text(coOp.eventName, `${path}.coOp.eventName`, 240),
      followUpOwner: text(coOp.followUpOwner, `${path}.coOp.followUpOwner`, 160),
      materials: text(coOp.materials, `${path}.coOp.materials`, 2000),
      role: text(coOp.role, `${path}.coOp.role`, 160),
    },
    createdAt: text(item.createdAt, `${path}.createdAt`, 80),
    day: day as Day,
    endTime,
    id: id(item.id, `${path}.id`),
    itemType: text(item.itemType || 'lesson', `${path}.itemType`, 40, true),
    location: text(item.location, `${path}.location`, 240),
    order: Number.isInteger(numericOrder) ? numericOrder : 0,
    sourceId: text(item.sourceId, `${path}.sourceId`, 180),
    sourceScreen: text(item.sourceScreen, `${path}.sourceScreen`, 80),
    startTime,
    status: status as PlannerStatus,
    studentDirections: text(item.studentDirections, `${path}.studentDirections`, 6000, true),
    subject: text(item.subject, `${path}.subject`, 180),
    targetId,
    targetKind: targetKind as TargetKind,
    title: text(item.title, `${path}.title`, 240, true),
    updatedAt: text(item.updatedAt, `${path}.updatedAt`, 80),
  });
}

function normalizeWeek(week: unknown, path = '$.week'): PlannerWeek {
  if (!isPlainObject(week)) throw new BLHFamilyPlannerV2Error('INVALID_WEEK', `${path} must be an object`);
  assertSafe(week, path);
  if (!Array.isArray(week.items) || week.items.length > MAX_ITEMS) throw new BLHFamilyPlannerV2Error('INVALID_WEEK', `${path}.items must contain at most ${MAX_ITEMS} entries`);
  const mode = text(week.mode || 'standard', `${path}.mode`, 40, true);
  if (!MODES.has(mode)) throw new BLHFamilyPlannerV2Error('INVALID_WEEK', `${path}.mode is unsupported`);
  const items = week.items.map((entry, index) => normalizeItem(entry, `${path}.items[${index}]`));
  const ids = new Set<string>();
  for (const entry of items) {
    if (ids.has(entry.id)) throw new BLHFamilyPlannerV2Error('DUPLICATE_ID', `Duplicate item id: ${entry.id}`);
    ids.add(entry.id);
  }
  return stable({
    coOpNotes: text(week.coOpNotes, `${path}.coOpNotes`, 5000),
    familyNotes: text(week.familyNotes, `${path}.familyNotes`, 5000),
    items,
    mode: mode as PlannerMode,
    updatedAt: text(week.updatedAt, `${path}.updatedAt`, 80),
    weekId: id(week.weekId, `${path}.weekId`),
  });
}

function safeFragment(value: unknown): string {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return normalized || 'item';
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base.slice(0, 130);
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base.slice(0, 120)}_${suffix++}`;
  used.add(candidate);
  return candidate;
}

function itemTargetKey(item: PlannerItem): string {
  return item.targetKind === 'all' ? 'all:' : `${item.targetKind}:${item.targetId}`;
}

function targetLabel(item: PlannerItem, context: { students?: readonly StudentRef[]; learningLevels?: readonly LearningLevelRef[] } = {}): string {
  if (item.targetKind === 'student') return context.students?.find((student) => student.id === item.targetId)?.name || item.targetId;
  if (item.targetKind === 'track') return context.learningLevels?.find((level) => level.id === item.targetId)?.name || item.targetId;
  return 'Family / all learners';
}

function targetsOverlap(left: PlannerItem, right: PlannerItem, students: readonly StudentRef[] = []): boolean {
  if (left.targetKind === 'all' || right.targetKind === 'all') return true;
  if (left.targetKind === right.targetKind) return left.targetId === right.targetId;
  const studentItem = left.targetKind === 'student' ? left : right;
  const trackItem = left.targetKind === 'track' ? left : right;
  const student = students.find((entry) => entry.id === studentItem.targetId);
  return !!student && [student.levelId, student.track, student.trackId].filter(Boolean).includes(trackItem.targetId);
}

function overlaps(left: PlannerItem, right: PlannerItem): boolean {
  return !!left.startTime && !!left.endTime && !!right.startTime && !!right.endTime && left.startTime < right.endTime && right.startTime < left.endTime;
}

export function normalizeWeekTemplate(template: unknown, path = '$.template'): PlannerTemplate {
  if (!isPlainObject(template)) throw new BLHFamilyPlannerV2Error('INVALID_TEMPLATE', `${path} must be an object`);
  assertSafe(template, path);
  if (!Array.isArray(template.items) || template.items.length > MAX_ITEMS) throw new BLHFamilyPlannerV2Error('INVALID_TEMPLATE', `${path}.items must contain at most ${MAX_ITEMS} entries`);
  const mode = text(template.mode || 'standard', `${path}.mode`, 40, true);
  if (!MODES.has(mode)) throw new BLHFamilyPlannerV2Error('INVALID_TEMPLATE', `${path}.mode is unsupported`);
  const items = template.items.map((entry, index): PlannerTemplateItem => {
    if (!isPlainObject(entry)) throw new BLHFamilyPlannerV2Error('INVALID_TEMPLATE', `${path}.items[${index}] must be an object`);
    const sourceItemId = id(entry.sourceItemId || entry.id || `item_${index + 1}`, `${path}.items[${index}].sourceItemId`);
    const normalized = normalizeItem({ ...entry, id: sourceItemId }, `${path}.items[${index}]`);
    return stable({ ...normalized, sourceItemId });
  });
  return stable({
    createdAt: text(template.createdAt, `${path}.createdAt`, 80),
    description: text(template.description, `${path}.description`, 1000),
    familyNotes: text(template.familyNotes, `${path}.familyNotes`, 5000),
    coOpNotes: text(template.coOpNotes, `${path}.coOpNotes`, 5000),
    format: BLH_FAMILY_PLANNER_TEMPLATE_FORMAT,
    id: id(template.id, `${path}.id`),
    items,
    mode: mode as PlannerMode,
    name: text(template.name, `${path}.name`, 160, true),
    schemaVersion: BLH_FAMILY_PLANNER_V2_SCHEMA,
    sourceWeekId: text(template.sourceWeekId, `${path}.sourceWeekId`, 140),
  });
}

export function createWeekTemplate(input: { week: unknown; id: string; name: string; description?: string; createdAt?: string }): PlannerTemplate {
  const source = normalizeWeek(input.week, '$.week');
  return normalizeWeekTemplate({
    id: input.id,
    name: input.name,
    description: input.description ?? '',
    createdAt: input.createdAt ?? '',
    sourceWeekId: source.weekId,
    mode: source.mode,
    familyNotes: source.familyNotes,
    coOpNotes: source.coOpNotes,
    items: source.items.filter((item) => item.status !== 'archived').map((item) => ({ ...item, sourceItemId: item.id })),
  });
}

export function normalizeTemplateLibrary(templates: unknown): PlannerTemplate[] {
  if (!Array.isArray(templates) || templates.length > MAX_TEMPLATES) throw new BLHFamilyPlannerV2Error('INVALID_TEMPLATE_LIBRARY', `Template library must contain at most ${MAX_TEMPLATES} entries`);
  const normalized = templates.map((entry, index) => normalizeWeekTemplate(entry, `$.templates[${index}]`));
  const ids = new Set<string>();
  for (const entry of normalized) {
    if (ids.has(entry.id)) throw new BLHFamilyPlannerV2Error('DUPLICATE_ID', `Duplicate template id: ${entry.id}`);
    ids.add(entry.id);
  }
  return normalized;
}

function copyItems(input: {
  sourceItems: readonly unknown[];
  sourceKey: string;
  targetWeek: unknown;
  operation: string;
  now?: string;
  statusMode?: 'preserve' | 'carryover';
}): { target: PlannerWeek; added: PlannerItem[]; skipped: string[] } {
  const target = normalizeWeek(input.targetWeek, '$.targetWeek');
  const used = new Set(target.items.map((item) => item.id));
  const existingLinks = new Set(target.items.map((item) => item.carriedFromId).filter(Boolean));
  const added: PlannerItem[] = [];
  const skipped: string[] = [];
  const now = input.now ?? '';
  const statusMode = input.statusMode ?? 'preserve';
  input.sourceItems.forEach((raw, index) => {
    const item = normalizeItem(raw, `$.sourceItems[${index}]`);
    const sourceItemId = isPlainObject(raw) && typeof raw.sourceItemId === 'string' ? raw.sourceItemId : item.id;
    const link = `${input.operation}:${input.sourceKey}:${sourceItemId}`;
    if (existingLinks.has(link)) {
      skipped.push(sourceItemId);
      return;
    }
    const base = `fp_${input.operation}_${safeFragment(input.sourceKey)}_${safeFragment(sourceItemId)}`;
    const copied = stable({
      ...item,
      id: uniqueId(base, used),
      carriedFromId: link,
      status: statusMode === 'carryover' ? 'carryover' : item.status === 'archived' ? 'planned' : item.status,
      createdAt: now,
      updatedAt: now,
      order: target.items.filter((entry) => entry.day === item.day).length + added.filter((entry) => entry.day === item.day).length,
    } satisfies PlannerItem);
    added.push(copied);
    existingLinks.add(link);
  });
  return { target, added, skipped };
}

export function applyWeekTemplate(input: { template: unknown; targetWeek: unknown; now?: string }): { added: number; skipped: string[]; templateId: string; week: PlannerWeek } {
  const normalizedTemplate = normalizeWeekTemplate(input.template);
  const copied = copyItems({
    sourceItems: normalizedTemplate.items,
    sourceKey: normalizedTemplate.id,
    targetWeek: input.targetWeek,
    operation: 'template',
    now: input.now,
    statusMode: 'preserve',
  });
  const week = stable({
    ...copied.target,
    items: [...copied.target.items, ...copied.added],
    mode: copied.target.items.length ? copied.target.mode : normalizedTemplate.mode,
    familyNotes: copied.target.familyNotes || normalizedTemplate.familyNotes,
    coOpNotes: copied.target.coOpNotes || normalizedTemplate.coOpNotes,
    updatedAt: input.now || copied.target.updatedAt,
  });
  return stable({ added: copied.added.length, skipped: copied.skipped, templateId: normalizedTemplate.id, week });
}

export function copyWeek(input: { sourceWeek: unknown; targetWeek: unknown; operation?: string; now?: string }): { added: number; operation: string; skipped: string[]; sourceWeekId: string; week: PlannerWeek } {
  const operation = input.operation ?? 'duplicate';
  if (!['duplicate', 'roll-forward'].includes(operation)) throw new BLHFamilyPlannerV2Error('INVALID_OPERATION', `Unsupported copy operation: ${operation}`);
  const source = normalizeWeek(input.sourceWeek, '$.sourceWeek');
  const target = normalizeWeek(input.targetWeek, '$.targetWeek');
  if (source.weekId === target.weekId) throw new BLHFamilyPlannerV2Error('SAME_WEEK', 'Source and target week must be different');
  const sourceItems = source.items.filter((item) => item.status !== 'archived');
  const copied = copyItems({
    sourceItems,
    sourceKey: source.weekId,
    targetWeek: target,
    operation,
    now: input.now,
    statusMode: operation === 'roll-forward' ? 'carryover' : 'preserve',
  });
  const week = stable({
    ...copied.target,
    items: [...copied.target.items, ...copied.added],
    mode: copied.target.items.length ? copied.target.mode : source.mode,
    familyNotes: copied.target.familyNotes || (operation === 'duplicate' ? source.familyNotes : ''),
    coOpNotes: copied.target.coOpNotes || (operation === 'duplicate' ? source.coOpNotes : ''),
    updatedAt: input.now || copied.target.updatedAt,
  });
  return stable({ added: copied.added.length, operation, skipped: copied.skipped, sourceWeekId: source.weekId, week });
}

export function analyzeWeek(input: {
  week: unknown;
  students?: readonly StudentRef[];
  learningLevels?: readonly LearningLevelRef[];
  maxItemsPerDay?: number;
  maxItemsPerTarget?: number;
}) {
  const normalized = normalizeWeek(input.week);
  const students = input.students ?? [];
  const learningLevels = input.learningLevels ?? [];
  const maxItemsPerDay = input.maxItemsPerDay ?? 6;
  const maxItemsPerTarget = input.maxItemsPerTarget ?? 8;
  const active = normalized.items.filter((item) => item.status !== 'archived');
  const byDay = Object.fromEntries(DAYS.map((day) => [day, active.filter((item) => item.day === day).length]));
  const targetCounts = new Map<string, { key: string; label: string; count: number }>();
  for (const item of active) {
    const key = itemTargetKey(item);
    const current = targetCounts.get(key) ?? { key, label: targetLabel(item, { students, learningLevels }), count: 0 };
    current.count += 1;
    targetCounts.set(key, current);
  }
  const workloadWarnings: Array<Record<string, string | number>> = [];
  for (const [day, count] of Object.entries(byDay)) {
    if (count > maxItemsPerDay) workloadWarnings.push({ code: 'DAY_OVERLOAD', count, day, limit: maxItemsPerDay });
  }
  for (const entry of targetCounts.values()) {
    if (entry.count > maxItemsPerTarget) workloadWarnings.push({ code: 'TARGET_OVERLOAD', count: entry.count, key: entry.key, label: entry.label, limit: maxItemsPerTarget });
  }
  const conflicts: Array<Record<string, string>> = [];
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
      const left = active[leftIndex];
      const right = active[rightIndex];
      if (!left || !right || left.day !== right.day || !overlaps(left, right) || !targetsOverlap(left, right, students)) continue;
      conflicts.push(stable({
        code: 'TIME_OVERLAP',
        day: left.day,
        leftId: left.id,
        leftTitle: left.title,
        rightId: right.id,
        rightTitle: right.title,
        target: left.targetKind === 'all' ? targetLabel(right, { students, learningLevels }) : targetLabel(left, { students, learningLevels }),
        window: `${left.startTime}-${left.endTime} / ${right.startTime}-${right.endTime}`,
      }));
    }
  }
  const responsibilityGaps = active
    .filter((item) => item.coOp.enabled && (!item.coOp.role || !item.coOp.followUpOwner))
    .map((item) => stable({
      code: 'COOP_RESPONSIBILITY_GAP',
      day: item.day,
      eventName: item.coOp.eventName || item.title,
      itemId: item.id,
      missing: [!item.coOp.role ? 'role' : '', !item.coOp.followUpOwner ? 'follow-up owner' : ''].filter(Boolean),
    }));
  return stable({
    activeItems: active.length,
    byDay,
    conflicts,
    responsibilityGaps,
    targets: [...targetCounts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    version: BLH_FAMILY_PLANNER_V2_VERSION,
    workloadWarnings,
  });
}

export function createLearnerSafePrintModel(input: { week: unknown; students?: readonly StudentRef[]; learningLevels?: readonly LearningLevelRef[] }) {
  const normalized = normalizeWeek(input.week);
  const students = input.students ?? [];
  const learningLevels = input.learningLevels ?? [];
  const items = normalized.items.filter((item) => item.status !== 'archived').map((item) => stable({
    coOpEvent: item.coOp.enabled ? item.coOp.eventName : '',
    coOpMaterials: item.coOp.enabled ? item.coOp.materials : '',
    coOpRole: item.coOp.enabled ? item.coOp.role : '',
    day: item.day,
    directions: item.studentDirections,
    endTime: item.endTime,
    itemType: item.itemType,
    location: item.location,
    startTime: item.startTime,
    status: item.status,
    subject: item.subject,
    target: targetLabel(item, { students, learningLevels }),
    title: item.title,
  }));
  return stable({
    coOpNotes: '',
    familyNotes: normalized.familyNotes,
    items,
    mode: normalized.mode,
    version: BLH_FAMILY_PLANNER_V2_VERSION,
    weekId: normalized.weekId,
  });
}

function csvCell(value: unknown): string {
  const textValue = String(value ?? '');
  return `"${textValue.replaceAll('"', '""')}"`;
}

export function createLearnerSafeCsv(input: { week: unknown; students?: readonly StudentRef[]; learningLevels?: readonly LearningLevelRef[] }): string {
  const model = createLearnerSafePrintModel(input);
  const headers = ['Day', 'Start', 'End', 'Title', 'Target', 'Subject', 'Type', 'Status', 'Location', 'Directions', 'Co-op event', 'Co-op role', 'Materials'];
  const rows = model.items.map((item) => [item.day, item.startTime, item.endTime, item.title, item.target, item.subject, item.itemType, item.status, item.location, item.directions, item.coOpEvent, item.coOpRole, item.coOpMaterials]);
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}
