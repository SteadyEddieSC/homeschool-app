export const BLH_LESSON_PACK_APPLY_SCHEMA = 1;
export const BLH_LESSON_PACK_APPLY_VERSION = '10.43';
export const BLH_LESSON_PACK_APPLY_LIMIT = 50;
export const BLH_LESSON_PACK_APPLY_ROLES = Object.freeze(['parent', 'teacher', 'admin']);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const OVERLAY_STATUSES = new Set(['active', 'superseded', 'rolled-back']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export class BLHLessonPackApplyError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'BLHLessonPackApplyError';
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
      throw new BLHLessonPackApplyError('DANGEROUS_KEY', `Dangerous key rejected at ${path}.${key}`);
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
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value, path, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function requiredBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be a boolean`);
  }
  return value;
}

function optionalBoolean(value, path, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be a boolean`);
  }
  return value;
}

function normalizeId(value, path) {
  const id = requiredText(value, path, 140);
  if (!ID_PATTERN.test(id)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} contains unsupported characters`);
  }
  return id;
}

function normalizeTimestamp(value, path) {
  const timestamp = requiredText(value, path, 80);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be an ISO-compatible timestamp`);
  }
  return timestamp;
}

function normalizeRole(value, path = '$.role') {
  const role = requiredText(value, path, 30).toLowerCase();
  if (!BLH_LESSON_PACK_APPLY_ROLES.includes(role)) {
    throw new BLHLessonPackApplyError('ROLE_DENIED', `Role cannot apply lesson packs: ${role}`);
  }
  return role;
}

function normalizeStringList(value, path, limit = 30, maxLength = 1000) {
  if (!Array.isArray(value)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be an array`);
  }
  if (value.length > limit) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} exceeds ${limit} items`);
  }
  return value.map((item, index) => requiredText(item, `${path}[${index}]`, maxLength));
}

function normalizeSection(section, index = 0) {
  if (!isPlainObject(section)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `$.sections[${index}] must be an object`);
  }
  assertNoDangerousKeys(section, `$.sections[${index}]`);
  return stableSort({
    body: requiredText(section.body, `$.sections[${index}].body`, 12000),
    id: normalizeId(section.id, `$.sections[${index}].id`),
    title: requiredText(section.title, `$.sections[${index}].title`, 240)
  });
}

function normalizeNoEquipment(value, path = '$.noEquipmentPath') {
  if (!isPlainObject(value)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be an object`);
  }
  assertNoDangerousKeys(value, path);
  const enabled = optionalBoolean(value.enabled, `${path}.enabled`);
  const directions = optionalText(value.directions, `${path}.directions`, 6000);
  const evidence = optionalText(value.evidence, `${path}.evidence`, 4000);
  if (enabled && (!directions || !evidence)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', 'Enabled no-equipment path requires directions and evidence expectations');
  }
  return stableSort({ enabled, directions, evidence });
}

function normalizeMediaNeeds(value, path = '$.mediaNeeds') {
  if (!isPlainObject(value)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', `${path} must be an object`);
  }
  assertNoDangerousKeys(value, path);
  return stableSort({
    altText: optionalBoolean(value.altText, `${path}.altText`),
    diagramOrMap: optionalBoolean(value.diagramOrMap, `${path}.diagramOrMap`),
    heroImage: optionalBoolean(value.heroImage, `${path}.heroImage`),
    notes: optionalText(value.notes, `${path}.notes`, 4000),
    sourceLicenseReview: optionalBoolean(value.sourceLicenseReview, `${path}.sourceLicenseReview`),
    supportingImages: optionalBoolean(value.supportingImages, `${path}.supportingImages`)
  });
}

function normalizeSourcePack(pack) {
  if (!isPlainObject(pack)) {
    throw new BLHLessonPackApplyError('INVALID_SOURCE_PACK', 'Lesson pack must be an object');
  }
  assertNoDangerousKeys(pack, '$.pack');
  const status = requiredText(pack.status, '$.pack.status', 20).toLowerCase();
  if (status !== 'ready') {
    throw new BLHLessonPackApplyError('PACK_NOT_READY', 'Lesson pack must be marked ready before controlled apply');
  }
  if (!Array.isArray(pack.sections) || pack.sections.length === 0 || pack.sections.length > 20) {
    throw new BLHLessonPackApplyError('INVALID_SOURCE_PACK', 'Lesson pack requires 1–20 sections');
  }
  const sections = pack.sections.map(normalizeSection);
  const seen = new Set();
  for (const section of sections) {
    if (seen.has(section.id)) throw new BLHLessonPackApplyError('DUPLICATE_ID', `Duplicate section id: ${section.id}`);
    seen.add(section.id);
  }
  return stableSort({
    id: normalizeId(pack.id, '$.pack.id'),
    labPrompts: normalizeStringList(pack.labPrompts || [], '$.pack.labPrompts'),
    mediaNeeds: normalizeMediaNeeds(pack.mediaNeeds || {}),
    noEquipmentPath: normalizeNoEquipment(pack.noEquipmentPath || {}),
    objective: requiredText(pack.objective, '$.pack.objective', 4000),
    practicePrompts: normalizeStringList(pack.practicePrompts || [], '$.pack.practicePrompts'),
    sections,
    status,
    subject: requiredText(pack.subject, '$.pack.subject', 160),
    targetScreen: normalizeId(pack.targetScreen, '$.pack.targetScreen'),
    targetWeekId: optionalText(pack.targetWeekId, '$.pack.targetWeekId', 100),
    title: requiredText(pack.title, '$.pack.title', 240),
    track: requiredText(pack.track, '$.pack.track', 160),
    updatedAt: optionalText(pack.updatedAt, '$.pack.updatedAt', 80)
  });
}

function normalizeSelection(value, pack) {
  const source = value === undefined || value === null ? {} : value;
  if (!isPlainObject(source)) {
    throw new BLHLessonPackApplyError('INVALID_SELECTION', '$.selection must be an object');
  }
  assertNoDangerousKeys(source, '$.selection');
  const sectionIds = normalizeStringList(source.sectionIds || [], '$.selection.sectionIds', 20, 140);
  const uniqueSectionIds = [...new Set(sectionIds)];
  if (uniqueSectionIds.length !== sectionIds.length) {
    throw new BLHLessonPackApplyError('DUPLICATE_ID', 'Section selection contains duplicate ids');
  }
  const available = new Set(pack.sections.map(section => section.id));
  for (const id of uniqueSectionIds) {
    if (!available.has(id)) throw new BLHLessonPackApplyError('UNKNOWN_SECTION', `Unknown section selected: ${id}`);
  }
  const selection = stableSort({
    includeLabs: optionalBoolean(source.includeLabs, '$.selection.includeLabs'),
    includeMediaPlan: optionalBoolean(source.includeMediaPlan, '$.selection.includeMediaPlan'),
    includeNoEquipment: optionalBoolean(source.includeNoEquipment, '$.selection.includeNoEquipment'),
    includeObjective: optionalBoolean(source.includeObjective, '$.selection.includeObjective'),
    includePractice: optionalBoolean(source.includePractice, '$.selection.includePractice'),
    sectionIds: uniqueSectionIds
  });
  const selectedCount = Number(selection.includeObjective)
    + selection.sectionIds.length
    + Number(selection.includePractice)
    + Number(selection.includeLabs)
    + Number(selection.includeNoEquipment)
    + Number(selection.includeMediaPlan);
  if (!selectedCount) {
    throw new BLHLessonPackApplyError('EMPTY_SELECTION', 'Select at least one student-facing lesson component');
  }
  if (selection.includePractice && !pack.practicePrompts.length) {
    throw new BLHLessonPackApplyError('EMPTY_COMPONENT', 'Practice was selected but the source pack has no practice prompts');
  }
  if (selection.includeLabs && !pack.labPrompts.length) {
    throw new BLHLessonPackApplyError('EMPTY_COMPONENT', 'Lab/project was selected but the source pack has no lab/project prompts');
  }
  if (selection.includeNoEquipment && !pack.noEquipmentPath.enabled) {
    throw new BLHLessonPackApplyError('EMPTY_COMPONENT', 'No-equipment path was selected but is not enabled in the source pack');
  }
  const mediaHasContent = Object.entries(pack.mediaNeeds).some(([key, item]) => key === 'notes' ? Boolean(item) : Boolean(item));
  if (selection.includeMediaPlan && !mediaHasContent) {
    throw new BLHLessonPackApplyError('EMPTY_COMPONENT', 'Media plan was selected but the source pack has no media needs');
  }
  return selection;
}

function normalizeRequest(request, pack) {
  if (!isPlainObject(request)) {
    throw new BLHLessonPackApplyError('INVALID_APPLY', 'Controlled-apply request must be an object');
  }
  assertNoDangerousKeys(request, '$.request');
  const targetScreen = optionalText(request.targetScreen, '$.request.targetScreen', 100) || pack.targetScreen;
  const targetWeekId = optionalText(request.targetWeekId, '$.request.targetWeekId', 100) || pack.targetWeekId;
  if (targetScreen !== pack.targetScreen || targetWeekId !== pack.targetWeekId) {
    throw new BLHLessonPackApplyError('TARGET_MISMATCH', 'Controlled apply must use the reviewed target screen and week from the ready source pack');
  }
  const selection = normalizeSelection(request.selection, pack);
  const contentRightsAttested = requiredBoolean(request.contentRightsAttested, '$.request.contentRightsAttested');
  if (!contentRightsAttested) {
    throw new BLHLessonPackApplyError('RIGHTS_ATTESTATION_REQUIRED', 'Confirm the content is original or approved OER/public-domain/nonprofit/government-use material');
  }
  const mediaLicenseReviewed = optionalBoolean(request.mediaLicenseReviewed, '$.request.mediaLicenseReviewed');
  const mediaProvenanceReviewed = optionalBoolean(request.mediaProvenanceReviewed, '$.request.mediaProvenanceReviewed');
  if (selection.includeMediaPlan && (!mediaLicenseReviewed || !mediaProvenanceReviewed)) {
    throw new BLHLessonPackApplyError('MEDIA_REVIEW_REQUIRED', 'Selected media plans require explicit license and provenance review');
  }
  return stableSort({
    auditNote: requiredText(request.auditNote, '$.request.auditNote', 1000),
    contentRightsAttested,
    mediaLicenseReviewed,
    mediaProvenanceReviewed,
    selection,
    targetScreen: normalizeId(targetScreen, '$.request.targetScreen'),
    targetWeekId
  });
}

function fnv1a32(text, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function fingerprintLessonPackOverlayPlan(value) {
  assertNoDangerousKeys(value, '$.fingerprint');
  const canonical = JSON.stringify(stableSort(value));
  const first = fnv1a32(canonical, 0x811c9dc5).toString(16).padStart(8, '0');
  const second = fnv1a32(canonical, 0x9e3779b9).toString(16).padStart(8, '0');
  return `lpov1_${first}${second}`;
}

function selectedContent(pack, selection) {
  const selectedSections = pack.sections.filter(section => selection.sectionIds.includes(section.id));
  return stableSort({
    labPrompts: selection.includeLabs ? pack.labPrompts : [],
    mediaPlan: selection.includeMediaPlan ? pack.mediaNeeds : null,
    noEquipmentPath: selection.includeNoEquipment ? pack.noEquipmentPath : null,
    objective: selection.includeObjective ? pack.objective : '',
    practicePrompts: selection.includePractice ? pack.practicePrompts : [],
    sections: selectedSections
  });
}

function destinationKey(targetScreen, targetWeekId) {
  return `${targetScreen}::${targetWeekId || ''}`;
}

function normalizeOverlay(value, index = 0) {
  if (!isPlainObject(value)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', `$.overlays[${index}] must be an object`);
  assertNoDangerousKeys(value, `$.overlays[${index}]`);
  const status = requiredText(value.status, `$.overlays[${index}].status`, 30);
  if (!OVERLAY_STATUSES.has(status)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', `Unsupported overlay status: ${status}`);
  const content = value.content;
  if (!isPlainObject(content)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', `$.overlays[${index}].content must be an object`);
  const sections = Array.isArray(content.sections) ? content.sections.map(normalizeSection) : [];
  const mediaPlan = content.mediaPlan === null || content.mediaPlan === undefined ? null : normalizeMediaNeeds(content.mediaPlan, `$.overlays[${index}].content.mediaPlan`);
  const noEquipmentPath = content.noEquipmentPath === null || content.noEquipmentPath === undefined ? null : normalizeNoEquipment(content.noEquipmentPath, `$.overlays[${index}].content.noEquipmentPath`);
  return stableSort({
    appliedAt: normalizeTimestamp(value.appliedAt, `$.overlays[${index}].appliedAt`),
    appliedByRole: normalizeRole(value.appliedByRole, `$.overlays[${index}].appliedByRole`),
    auditNote: requiredText(value.auditNote, `$.overlays[${index}].auditNote`, 1000),
    content: stableSort({
      labPrompts: normalizeStringList(content.labPrompts || [], `$.overlays[${index}].content.labPrompts`),
      mediaPlan,
      noEquipmentPath,
      objective: optionalText(content.objective, `$.overlays[${index}].content.objective`, 4000),
      practicePrompts: normalizeStringList(content.practicePrompts || [], `$.overlays[${index}].content.practicePrompts`),
      sections
    }),
    fingerprint: requiredText(value.fingerprint, `$.overlays[${index}].fingerprint`, 80),
    id: normalizeId(value.id, `$.overlays[${index}].id`),
    mediaReview: stableSort({
      licenseReviewed: optionalBoolean(value.mediaReview?.licenseReviewed, `$.overlays[${index}].mediaReview.licenseReviewed`),
      provenanceReviewed: optionalBoolean(value.mediaReview?.provenanceReviewed, `$.overlays[${index}].mediaReview.provenanceReviewed`)
    }),
    replacedOverlayIds: normalizeStringList(value.replacedOverlayIds || [], `$.overlays[${index}].replacedOverlayIds`, BLH_LESSON_PACK_APPLY_LIMIT, 140),
    rightsAttested: requiredBoolean(value.rightsAttested, `$.overlays[${index}].rightsAttested`),
    rolledBackAt: optionalText(value.rolledBackAt, `$.overlays[${index}].rolledBackAt`, 80),
    rolledBackByRole: optionalText(value.rolledBackByRole, `$.overlays[${index}].rolledBackByRole`, 30),
    rollbackNote: optionalText(value.rollbackNote, `$.overlays[${index}].rollbackNote`, 1000),
    selection: stableSort({
      includeLabs: optionalBoolean(value.selection?.includeLabs, `$.overlays[${index}].selection.includeLabs`),
      includeMediaPlan: optionalBoolean(value.selection?.includeMediaPlan, `$.overlays[${index}].selection.includeMediaPlan`),
      includeNoEquipment: optionalBoolean(value.selection?.includeNoEquipment, `$.overlays[${index}].selection.includeNoEquipment`),
      includeObjective: optionalBoolean(value.selection?.includeObjective, `$.overlays[${index}].selection.includeObjective`),
      includePractice: optionalBoolean(value.selection?.includePractice, `$.overlays[${index}].selection.includePractice`),
      sectionIds: normalizeStringList(value.selection?.sectionIds || [], `$.overlays[${index}].selection.sectionIds`, 20, 140)
    }),
    sourcePack: stableSort({
      id: normalizeId(value.sourcePack?.id, `$.overlays[${index}].sourcePack.id`),
      subject: requiredText(value.sourcePack?.subject, `$.overlays[${index}].sourcePack.subject`, 160),
      title: requiredText(value.sourcePack?.title, `$.overlays[${index}].sourcePack.title`, 240),
      track: requiredText(value.sourcePack?.track, `$.overlays[${index}].sourcePack.track`, 160),
      updatedAt: optionalText(value.sourcePack?.updatedAt, `$.overlays[${index}].sourcePack.updatedAt`, 80)
    }),
    status,
    targetScreen: normalizeId(value.targetScreen, `$.overlays[${index}].targetScreen`),
    targetWeekId: optionalText(value.targetWeekId, `$.overlays[${index}].targetWeekId`, 100)
  });
}

function normalizeAuditEntry(value, index = 0) {
  if (!isPlainObject(value)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', `$.audit[${index}] must be an object`);
  assertNoDangerousKeys(value, `$.audit[${index}]`);
  const action = requiredText(value.action, `$.audit[${index}].action`, 30);
  if (!['apply', 'rollback'].includes(action)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', `Unsupported audit action: ${action}`);
  return stableSort({
    action,
    at: normalizeTimestamp(value.at, `$.audit[${index}].at`),
    id: normalizeId(value.id, `$.audit[${index}].id`),
    note: requiredText(value.note, `$.audit[${index}].note`, 1000),
    overlayId: normalizeId(value.overlayId, `$.audit[${index}].overlayId`),
    role: normalizeRole(value.role, `$.audit[${index}].role`),
    sourcePackId: normalizeId(value.sourcePackId, `$.audit[${index}].sourcePackId`),
    targetScreen: normalizeId(value.targetScreen, `$.audit[${index}].targetScreen`),
    targetWeekId: optionalText(value.targetWeekId, `$.audit[${index}].targetWeekId`, 100)
  });
}

export function normalizeLessonPackControlledApplyWorkspace(input = {}) {
  const source = input === undefined || input === null ? {} : input;
  if (!isPlainObject(source)) throw new BLHLessonPackApplyError('INVALID_WORKSPACE', 'Controlled-apply workspace must be an object');
  assertNoDangerousKeys(source, '$.workspace');
  const overlays = (Array.isArray(source.overlays) ? source.overlays : []).map(normalizeOverlay);
  const audit = (Array.isArray(source.audit) ? source.audit : []).map(normalizeAuditEntry);
  const ids = new Set();
  for (const overlay of overlays) {
    if (ids.has(overlay.id)) throw new BLHLessonPackApplyError('DUPLICATE_ID', `Duplicate overlay id: ${overlay.id}`);
    ids.add(overlay.id);
  }
  return stableSort({
    audit: audit.slice(-BLH_LESSON_PACK_APPLY_LIMIT),
    overlays: overlays.slice(-BLH_LESSON_PACK_APPLY_LIMIT),
    schemaVersion: BLH_LESSON_PACK_APPLY_SCHEMA,
    version: BLH_LESSON_PACK_APPLY_VERSION
  });
}

export function listActiveLessonPackOverlays(workspace, filters = {}) {
  const normalized = normalizeLessonPackControlledApplyWorkspace(workspace);
  if (!isPlainObject(filters)) throw new BLHLessonPackApplyError('INVALID_APPLY', 'Overlay filters must be an object');
  assertNoDangerousKeys(filters, '$.filters');
  const targetScreen = optionalText(filters.targetScreen, '$.filters.targetScreen', 100);
  const targetWeekId = optionalText(filters.targetWeekId, '$.filters.targetWeekId', 100);
  return normalized.overlays.filter(overlay => overlay.status === 'active'
    && (!targetScreen || overlay.targetScreen === targetScreen)
    && (!targetWeekId || overlay.targetWeekId === targetWeekId));
}

export function createLessonPackApplyPlan(workspace, sourcePack, request) {
  const normalizedWorkspace = normalizeLessonPackControlledApplyWorkspace(workspace);
  const pack = normalizeSourcePack(sourcePack);
  const normalizedRequest = normalizeRequest(request, pack);
  const content = selectedContent(pack, normalizedRequest.selection);
  const fingerprintInput = stableSort({
    content,
    selection: normalizedRequest.selection,
    sourcePack: {
      id: pack.id,
      subject: pack.subject,
      targetScreen: normalizedRequest.targetScreen,
      targetWeekId: normalizedRequest.targetWeekId,
      title: pack.title,
      track: pack.track,
      updatedAt: pack.updatedAt
    }
  });
  const fingerprint = fingerprintLessonPackOverlayPlan(fingerprintInput);
  const activeAtDestination = normalizedWorkspace.overlays.filter(overlay => overlay.status === 'active'
    && destinationKey(overlay.targetScreen, overlay.targetWeekId) === destinationKey(normalizedRequest.targetScreen, normalizedRequest.targetWeekId));
  const duplicate = activeAtDestination.find(overlay => overlay.fingerprint === fingerprint);
  return stableSort({
    after: {
      componentCount: Number(Boolean(content.objective)) + content.sections.length + Number(Boolean(content.practicePrompts.length))
        + Number(Boolean(content.labPrompts.length)) + Number(Boolean(content.noEquipmentPath)) + Number(Boolean(content.mediaPlan)),
      content,
      fingerprint,
      title: pack.title
    },
    before: {
      activeOverlayCount: activeAtDestination.length,
      activeOverlayIds: activeAtDestination.map(overlay => overlay.id),
      activeOverlayTitles: activeAtDestination.map(overlay => overlay.sourcePack.title)
    },
    duplicateActiveOverlayId: duplicate?.id || '',
    request: normalizedRequest,
    sourcePack: {
      id: pack.id,
      subject: pack.subject,
      title: pack.title,
      track: pack.track,
      updatedAt: pack.updatedAt
    }
  });
}

function operationIdentity(prefix, fingerprint, now, requestedId) {
  if (requestedId !== undefined && requestedId !== null && requestedId !== '') return normalizeId(requestedId, '$.options.id');
  const stamp = now.replace(/[^0-9]/g, '').slice(0, 17) || 'time';
  return `${prefix}_${fingerprint.slice(-12)}_${stamp}`;
}

function trimWorkspace(workspace) {
  const protectedIds = new Set();
  for (const overlay of workspace.overlays) {
    if (overlay.status === 'active') {
      protectedIds.add(overlay.id);
      overlay.replacedOverlayIds.forEach(id => protectedIds.add(id));
    }
  }
  const removable = workspace.overlays.filter(overlay => !protectedIds.has(overlay.id));
  const keep = new Set(workspace.overlays.map(overlay => overlay.id));
  while (keep.size > BLH_LESSON_PACK_APPLY_LIMIT && removable.length) keep.delete(removable.shift().id);
  workspace.overlays = workspace.overlays.filter(overlay => keep.has(overlay.id));
  workspace.audit = workspace.audit.slice(-BLH_LESSON_PACK_APPLY_LIMIT);
  return workspace;
}

export function applyLessonPackOverlay(workspace, sourcePack, request, options = {}) {
  if (!isPlainObject(options)) throw new BLHLessonPackApplyError('INVALID_APPLY', 'Apply options must be an object');
  assertNoDangerousKeys(options, '$.options');
  const role = normalizeRole(options.role || 'parent', '$.options.role');
  const now = normalizeTimestamp(options.now || new Date().toISOString(), '$.options.now');
  const normalizedWorkspace = normalizeLessonPackControlledApplyWorkspace(workspace);
  const plan = createLessonPackApplyPlan(normalizedWorkspace, sourcePack, request);
  if (plan.duplicateActiveOverlayId) {
    throw new BLHLessonPackApplyError('DUPLICATE_ACTIVE_OVERLAY', 'An identical overlay is already active at this destination', {
      overlayId: plan.duplicateActiveOverlayId
    });
  }
  const replacedOverlayIds = [];
  const overlays = normalizedWorkspace.overlays.map(overlay => {
    if (overlay.status === 'active'
      && destinationKey(overlay.targetScreen, overlay.targetWeekId) === destinationKey(plan.request.targetScreen, plan.request.targetWeekId)) {
      replacedOverlayIds.push(overlay.id);
      return stableSort({ ...overlay, status: 'superseded' });
    }
    return overlay;
  });
  const id = operationIdentity('overlay', plan.after.fingerprint, now, options.id);
  if (overlays.some(overlay => overlay.id === id)) throw new BLHLessonPackApplyError('DUPLICATE_ID', `Overlay id already exists: ${id}`);
  const overlay = normalizeOverlay({
    appliedAt: now,
    appliedByRole: role,
    auditNote: plan.request.auditNote,
    content: plan.after.content,
    fingerprint: plan.after.fingerprint,
    id,
    mediaReview: {
      licenseReviewed: plan.request.mediaLicenseReviewed,
      provenanceReviewed: plan.request.mediaProvenanceReviewed
    },
    replacedOverlayIds,
    rightsAttested: plan.request.contentRightsAttested,
    rolledBackAt: '',
    rolledBackByRole: '',
    rollbackNote: '',
    selection: plan.request.selection,
    sourcePack: plan.sourcePack,
    status: 'active',
    targetScreen: plan.request.targetScreen,
    targetWeekId: plan.request.targetWeekId
  }, overlays.length);
  const auditId = operationIdentity('audit_apply', plan.after.fingerprint, now, options.auditId);
  const auditEntry = normalizeAuditEntry({
    action: 'apply',
    at: now,
    id: auditId,
    note: plan.request.auditNote,
    overlayId: id,
    role,
    sourcePackId: plan.sourcePack.id,
    targetScreen: plan.request.targetScreen,
    targetWeekId: plan.request.targetWeekId
  }, normalizedWorkspace.audit.length);
  const next = trimWorkspace({
    audit: [...normalizedWorkspace.audit, auditEntry],
    overlays: [...overlays, overlay],
    schemaVersion: BLH_LESSON_PACK_APPLY_SCHEMA,
    version: BLH_LESSON_PACK_APPLY_VERSION
  });
  return stableSort({ overlay, plan, workspace: next });
}

export function rollbackLessonPackOverlay(workspace, overlayId, request = {}, options = {}) {
  if (!isPlainObject(request) || !isPlainObject(options)) {
    throw new BLHLessonPackApplyError('INVALID_ROLLBACK', 'Rollback request and options must be objects');
  }
  assertNoDangerousKeys(request, '$.rollback');
  assertNoDangerousKeys(options, '$.options');
  const role = normalizeRole(options.role || 'parent', '$.options.role');
  const now = normalizeTimestamp(options.now || new Date().toISOString(), '$.options.now');
  const id = normalizeId(overlayId, '$.overlayId');
  const note = requiredText(request.auditNote, '$.rollback.auditNote', 1000);
  const normalizedWorkspace = normalizeLessonPackControlledApplyWorkspace(workspace);
  const target = normalizedWorkspace.overlays.find(overlay => overlay.id === id);
  if (!target) throw new BLHLessonPackApplyError('OVERLAY_NOT_FOUND', `Overlay not found: ${id}`);
  if (target.status !== 'active') throw new BLHLessonPackApplyError('OVERLAY_NOT_ACTIVE', 'Only the currently active overlay can be rolled back');
  const restoreIds = new Set(target.replacedOverlayIds);
  const overlays = normalizedWorkspace.overlays.map(overlay => {
    if (overlay.id === id) {
      return normalizeOverlay({
        ...overlay,
        rolledBackAt: now,
        rolledBackByRole: role,
        rollbackNote: note,
        status: 'rolled-back'
      });
    }
    if (restoreIds.has(overlay.id) && overlay.status === 'superseded') {
      return normalizeOverlay({ ...overlay, status: 'active' });
    }
    return overlay;
  });
  const auditId = operationIdentity('audit_rollback', target.fingerprint, now, options.auditId);
  const auditEntry = normalizeAuditEntry({
    action: 'rollback',
    at: now,
    id: auditId,
    note,
    overlayId: id,
    role,
    sourcePackId: target.sourcePack.id,
    targetScreen: target.targetScreen,
    targetWeekId: target.targetWeekId
  }, normalizedWorkspace.audit.length);
  const next = trimWorkspace({
    audit: [...normalizedWorkspace.audit, auditEntry],
    overlays,
    schemaVersion: BLH_LESSON_PACK_APPLY_SCHEMA,
    version: BLH_LESSON_PACK_APPLY_VERSION
  });
  return stableSort({ restoredOverlayIds: [...restoreIds], rolledBackOverlayId: id, workspace: next });
}

export function createStudentSafeLessonPackOverlay(input) {
  const overlay = normalizeOverlay(input);
  if (overlay.status !== 'active') {
    throw new BLHLessonPackApplyError('OVERLAY_NOT_ACTIVE', 'Only active overlays may render in student-safe destinations');
  }
  return stableSort({
    content: overlay.content,
    source: {
      subject: overlay.sourcePack.subject,
      title: overlay.sourcePack.title,
      track: overlay.sourcePack.track
    },
    targetScreen: overlay.targetScreen,
    targetWeekId: overlay.targetWeekId
  });
}
