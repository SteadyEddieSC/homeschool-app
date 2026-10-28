import type { AdultIdentity } from './domain';
import { D1HouseholdRepository } from './repositories';

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

interface LocalD1 {
  prepare(sql: string): Statement;
  batch<T = unknown>(statements: Statement[]): Promise<T[]>;
}

interface Env {
  DB: LocalD1;
  APP_ENV: string;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly detail?: unknown) { super(message); }
}

const now = (): string => new Date().toISOString();
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const stmt = (db: LocalD1, sql: string, ...values: unknown[]): Statement => db.prepare(sql).bind(...values);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new HttpError(400, 'Expected a JSON object.'); }
}

function text(body: Record<string, unknown>, key: string, max = 240): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) throw new HttpError(400, `Invalid ${key}.`);
  return value.trim();
}

async function adult(request: Request, db: LocalD1): Promise<AdultIdentity> {
  const adultId = request.headers.get('x-synthetic-adult-id');
  if (!adultId) throw new HttpError(401, 'Synthetic adult identity required.');
  const row = await stmt(db, 'SELECT id FROM adult_accounts WHERE id = ?', adultId).first();
  if (!row) throw new HttpError(401, 'Unknown synthetic adult identity.');
  return { adultId, issuer: 'synthetic-local' };
}

async function requireHouseholdAdult(db: LocalD1, householdId: string, adultId: string): Promise<void> {
  const row = await stmt(db, 'SELECT role FROM household_adults WHERE household_id = ? AND adult_id = ?', householdId, adultId).first();
  if (!row) throw new HttpError(404, 'Household not found or adult is not a member.');
}

async function requireOrgAdult(db: LocalD1, organizationId: string, adultId: string): Promise<void> {
  const row = await stmt(db, 'SELECT role FROM organization_adults WHERE organization_id = ? AND adult_id = ?', organizationId, adultId).first();
  if (!row) throw new HttpError(404, 'Co-op not found or adult is not a member.');
}

/**
 * The receipt claim and domain writes share one D1 batch. A replay with a
 * matching operation ID/fingerprint returns the recorded result; reuse of an
 * operation ID for different content is rejected. The claim token also keeps
 * two simultaneous copies of one operation from both applying its writes.
 */
async function writeOnce<T>(db: LocalD1, operationId: string, body: unknown, result: T,
  buildWrites: (claim: string) => Statement[]): Promise<T> {
  if (operationId.length < 8 || operationId.length > 120) throw new HttpError(400, 'Invalid operationId.');
  const fingerprint = canonical(body);
  const existing = await stmt(db, 'SELECT fingerprint, response_json FROM sync_operations WHERE operation_id = ?', operationId)
    .first<{ fingerprint: string; response_json: string }>();
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new HttpError(409, 'This operation ID was already used for different content.');
    return JSON.parse(existing.response_json) as T;
  }
  const claim = crypto.randomUUID();
  const timestamp = now();
  await db.batch([
    stmt(db, 'INSERT OR IGNORE INTO sync_operations (operation_id, fingerprint, claim_token, response_json, created_at) VALUES (?, ?, ?, ?, ?)',
      operationId, fingerprint, claim, JSON.stringify(result), timestamp),
    ...buildWrites(claim)
  ]);
  const saved = await stmt(db, 'SELECT fingerprint, response_json FROM sync_operations WHERE operation_id = ?', operationId)
    .first<{ fingerprint: string; response_json: string }>();
  if (!saved) throw new HttpError(500, 'Operation receipt was not persisted.');
  if (saved.fingerprint !== fingerprint) throw new HttpError(409, 'This operation ID was already used for different content.');
  return JSON.parse(saved.response_json) as T;
}

function claimExists(claim: string): string { return `EXISTS (SELECT 1 FROM sync_operations WHERE claim_token = '${claim}')`; }
// claim is a UUID generated by this worker and never comes from request data.

async function createAdult(request: Request, db: LocalD1): Promise<Response> {
  const body = await readJson(request);
  const id = text(body, 'adultId', 100);
  await stmt(db, 'INSERT OR IGNORE INTO adult_accounts (id, created_at) VALUES (?, ?)', id, now()).run();
  return json({ adultId: id, issuer: 'synthetic-local' }, 201);
}

async function route(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV !== 'local-proof') return json({ error: 'Local proof routes are disabled.' }, 404);
  const { pathname } = new URL(request.url);
  const db = env.DB;
  const households = new D1HouseholdRepository(db, { writeOnce, requireHouseholdAdult, claimExists, now, statement: (sql, ...values) => stmt(db, sql, ...values) });
  if (pathname === '/api/dev/adults' && request.method === 'POST') return createAdult(request, db);
  if (!pathname.startsWith('/api/')) return json({ ok: true, service: 'learning-harbor-local-d1-proof' });
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  const identity = await adult(request, db);
  const body = request.method === 'POST' || request.method === 'PATCH' ? await readJson(request) : {};

  if (pathname === '/api/households' && request.method === 'POST') {
    const id = text(body, 'id', 100); const name = text(body, 'name', 160); const operationId = text(body, 'operationId', 120);
    return json(await households.createHousehold(identity, { id, name, operationId }), 201);
  }

  const householdLearners = pathname.match(/^\/api\/households\/([^/]+)\/learners$/);
  if (householdLearners && request.method === 'GET') {
    const householdId = decodeURIComponent(householdLearners[1]);
    return json(await households.listLearners(identity, householdId));
  }
  if (householdLearners && request.method === 'POST') {
    const householdId = decodeURIComponent(householdLearners[1]);
    const id = text(body, 'id', 100); const preferredName = text(body, 'preferredName', 120); const gradeBand = text(body, 'gradeBand', 20); const operationId = text(body, 'operationId', 120);
    return json(await households.createLearner(identity, { id, householdId, preferredName, gradeBand, operationId }), 201);
  }

  if (pathname === '/api/coops' && request.method === 'POST') {
    const id = text(body, 'id', 100); const name = text(body, 'name', 160); const operationId = text(body, 'operationId', 120); const createdAt = now();
    const result = { id, name, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'create-coop', id, name, adultId: identity.adultId }, result, (claim) => [
      stmt(db, `INSERT INTO organizations (id, name, created_at) SELECT ?, ?, ? WHERE ${claimExists(claim)}`, id, name, createdAt),
      stmt(db, `INSERT INTO organization_adults (organization_id, adult_id, role, created_at) SELECT ?, ?, 'admin', ? WHERE ${claimExists(claim)}`, id, identity.adultId, createdAt)
    ]);
    return json(saved, 201);
  }

  const coopAdults = pathname.match(/^\/api\/coops\/([^/]+)\/adults$/);
  if (coopAdults && request.method === 'POST') {
    const organizationId = decodeURIComponent(coopAdults[1]); await requireOrgAdult(db, organizationId, identity.adultId);
    const admin = await stmt(db, 'SELECT role FROM organization_adults WHERE organization_id = ? AND adult_id = ?', organizationId, identity.adultId).first<{ role: string }>();
    if (admin?.role !== 'admin') throw new HttpError(403, 'Only co-op admins can add adult members.');
    const adultId = text(body, 'adultId', 100); const role = text(body, 'role', 20); if (!['member', 'instructor', 'admin'].includes(role)) throw new HttpError(400, 'Invalid co-op adult role.'); const operationId = text(body, 'operationId', 120); const createdAt = now(); const result = { organizationId, adultId, role, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'add-coop-adult', organizationId, adultId, role }, result, (claim) => [
      stmt(db, `INSERT OR IGNORE INTO adult_accounts (id, created_at) SELECT ?, ? WHERE ${claimExists(claim)}`, adultId, createdAt),
      stmt(db, `INSERT INTO organization_adults (organization_id, adult_id, role, created_at) SELECT ?, ?, ?, ? WHERE ${claimExists(claim)}`, organizationId, adultId, role, createdAt)
    ]);
    return json(saved, 201);
  }

  if (pathname === '/api/academic-years' && request.method === 'POST') {
    const id = text(body, 'id', 100); const householdId = text(body, 'householdId', 100); await requireHouseholdAdult(db, householdId, identity.adultId);
    const label = text(body, 'label', 80); const operationId = text(body, 'operationId', 120); const startsOn = text(body, 'startsOn', 10); const endsOn = text(body, 'endsOn', 10);
    const result = { id, householdId, label, instructionalDayTarget: 180, recordPack: 'SC-home-study' }; const createdAt = now();
    const saved = await writeOnce(db, operationId, { kind: 'create-academic-year', id, householdId, label, startsOn, endsOn }, result, (claim) => [
      stmt(db, `INSERT INTO academic_years (id, household_id, label, starts_on, ends_on, instructional_day_target, record_pack, created_at) SELECT ?, ?, ?, ?, ?, 180, 'SC-home-study', ? WHERE ${claimExists(claim)}`, id, householdId, label, startsOn, endsOn, createdAt),
      stmt(db, `INSERT INTO record_pack_profiles (id, household_id, jurisdiction, instructional_day_target, tracks_subject_activities, tracks_portfolio_references, tracks_attendance, tracks_individual_progress, created_at) SELECT ?, ?, 'SC', 180, 1, 1, 1, 1, ? WHERE ${claimExists(claim)}`, `pack-${id}`, householdId, createdAt)
    ]);
    return json(saved, 201);
  }

  const workItems = pathname.match(/^\/api\/households\/([^/]+)\/work-items$/);
  if (workItems && request.method === 'POST') {
    const householdId = decodeURIComponent(workItems[1]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const id = text(body, 'id', 100); const learnerId = text(body, 'learnerId', 100); const title = text(body, 'title', 180); const instructions = typeof body.instructions === 'string' ? body.instructions.slice(0, 3000) : ''; const dueOn = typeof body.dueOn === 'string' ? body.dueOn : null; const operationId = text(body, 'operationId', 120); const createdAt = now();
    const learner = await stmt(db, 'SELECT id FROM learners WHERE id = ? AND household_id = ?', learnerId, householdId).first();
    if (!learner) throw new HttpError(404, 'Learner is not in this household.');
    const result = { id, householdId, learnerId, title, instructions, dueOn, status: 'assigned', version: 1, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'create-work-item', id, householdId, learnerId, title, instructions, dueOn }, result, (claim) => [
      stmt(db, `INSERT INTO work_items (id, household_id, learner_id, title, instructions, due_on, status, version, assigned_by_adult_id, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'assigned', 1, ?, ?, ? WHERE ${claimExists(claim)}`, id, householdId, learnerId, title, instructions, dueOn, identity.adultId, createdAt, createdAt)
    ]);
    return json(saved, 201);
  }

  const conflictPath = pathname.match(/^\/api\/work-items\/([^/]+)$/);
  if (conflictPath && request.method === 'PATCH') {
    const itemId = decodeURIComponent(conflictPath[1]); const baseVersion = Number(body.baseVersion); const title = text(body, 'title', 180); const operationId = text(body, 'operationId', 120);
    const current = await stmt(db, 'SELECT id, household_id, title, version, updated_at FROM work_items WHERE id = ?', itemId).first<{ id: string; household_id: string; title: string; version: number; updated_at: string }>();
    if (!current) throw new HttpError(404, 'Work item not found.'); await requireHouseholdAdult(db, current.household_id, identity.adultId);
    if (baseVersion !== current.version) throw new HttpError(409, 'Work item changed since it was read.', { current: { id: current.id, title: current.title, version: current.version, updatedAt: current.updated_at } });
    const result = { id: itemId, title, version: current.version + 1, updatedAt: now() };
    const saved = await writeOnce(db, operationId, { kind: 'update-work-item', itemId, baseVersion, title }, result, (claim) => [
      stmt(db, `UPDATE work_items SET title = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ? AND ${claimExists(claim)}`, title, result.updatedAt, itemId, baseVersion)
    ]);
    return json(saved);
  }

  const completion = pathname.match(/^\/api\/households\/([^/]+)\/work-items\/([^/]+)\/logs$/);
  if (completion && request.method === 'POST') {
    const householdId = decodeURIComponent(completion[1]); const itemId = decodeURIComponent(completion[2]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const work = await stmt(db, 'SELECT learner_id FROM work_items WHERE id = ? AND household_id = ?', itemId, householdId).first<{ learner_id: string }>(); if (!work) throw new HttpError(404, 'Work item not found.');
    const id = text(body, 'id', 100); const status = text(body, 'status', 40); if (!['in-progress', 'ready-for-review', 'completed', 'returned'].includes(status)) throw new HttpError(400, 'Invalid work status.');
    const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : ''; const operationId = text(body, 'operationId', 120); const occurredAt = now(); const result = { id, itemId, learnerId: work.learner_id, status, occurredAt };
    const saved = await writeOnce(db, operationId, { kind: 'record-work-log', householdId, itemId, status, note }, result, (claim) => [
      stmt(db, `INSERT INTO work_logs (id, household_id, work_item_id, learner_id, status, note, recorded_by_adult_id, occurred_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, householdId, itemId, work.learner_id, status, note, identity.adultId, occurredAt),
      stmt(db, `UPDATE work_items SET status = ?, updated_at = ?, version = version + 1 WHERE id = ? AND ${claimExists(claim)}`, status, occurredAt, itemId)
    ]);
    return json(saved, 201);
  }

  const attendance = pathname.match(/^\/api\/households\/([^/]+)\/attendance$/);
  if (attendance && request.method === 'POST') {
    const householdId = decodeURIComponent(attendance[1]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const id = text(body, 'id', 100); const learnerId = text(body, 'learnerId', 100); const date = text(body, 'date', 10); const minutes = Number(body.minutes ?? 0); if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new HttpError(400, 'Invalid minutes.'); const operationId = text(body, 'operationId', 120);
    const learner = await stmt(db, 'SELECT id FROM learners WHERE id = ? AND household_id = ?', learnerId, householdId).first(); if (!learner) throw new HttpError(404, 'Learner is not in this household.');
    const createdAt = now(); const result = { id, householdId, learnerId, date, minutes, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'record-attendance', householdId, id, learnerId, date, minutes }, result, (claim) => [
      stmt(db, `INSERT INTO attendance_records (id, household_id, learner_id, attended_on, minutes, recorded_by_adult_id, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, householdId, learnerId, date, minutes, identity.adultId, createdAt)
    ]);
    return json(saved, 201);
  }

  const evidence = pathname.match(/^\/api\/households\/([^/]+)\/evidence$/);
  if (evidence && request.method === 'POST') {
    const householdId = decodeURIComponent(evidence[1]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const id = text(body, 'id', 100); const learnerId = text(body, 'learnerId', 100); const workItemId = text(body, 'workItemId', 100); const label = text(body, 'label', 180); const reference = text(body, 'reference', 2000); const operationId = text(body, 'operationId', 120);
    const work = await stmt(db, 'SELECT id FROM work_items WHERE id = ? AND learner_id = ? AND household_id = ?', workItemId, learnerId, householdId).first(); if (!work) throw new HttpError(404, 'Work item not found for this learner.');
    const createdAt = now(); const result = { id, householdId, learnerId, workItemId, label, reviewStatus: 'awaiting-adult-review', createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'submit-evidence', householdId, id, learnerId, workItemId, label, reference }, result, (claim) => [
      stmt(db, `INSERT INTO evidence_metadata (id, household_id, learner_id, work_item_id, evidence_kind, label, reference, submitted_by_adult_id, created_at) SELECT ?, ?, ?, ?, 'text', ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, householdId, learnerId, workItemId, label, reference, identity.adultId, createdAt)
    ]);
    return json(saved, 201);
  }

  const review = pathname.match(/^\/api\/households\/([^/]+)\/evidence\/([^/]+)\/review$/);
  if (review && request.method === 'POST') {
    const householdId = decodeURIComponent(review[1]); const evidenceId = decodeURIComponent(review[2]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const decision = text(body, 'decision', 20); if (!['accepted', 'returned'].includes(decision)) throw new HttpError(400, 'Invalid review decision.');
    const feedback = typeof body.feedback === 'string' ? body.feedback.slice(0, 2000) : ''; const id = text(body, 'id', 100); const operationId = text(body, 'operationId', 120);
    const evidenceRow = await stmt(db, 'SELECT id FROM evidence_metadata WHERE id = ? AND household_id = ?', evidenceId, householdId).first(); if (!evidenceRow) throw new HttpError(404, 'Evidence not found.');
    const createdAt = now(); const result = { id, evidenceId, decision, feedback, reviewerAdultId: identity.adultId, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'review-evidence', householdId, evidenceId, decision, feedback }, result, (claim) => [
      stmt(db, `INSERT INTO adult_reviews (id, household_id, evidence_id, reviewer_adult_id, decision, feedback, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, householdId, evidenceId, identity.adultId, decision, feedback, createdAt)
    ]);
    return json(saved, 201);
  }

  const classes = pathname.match(/^\/api\/coops\/([^/]+)\/classes$/);
  if (classes && request.method === 'POST') {
    const organizationId = decodeURIComponent(classes[1]); await requireOrgAdult(db, organizationId, identity.adultId);
    const id = text(body, 'id', 100); const name = text(body, 'name', 160); const operationId = text(body, 'operationId', 120); const createdAt = now(); const result = { id, organizationId, name, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'create-class', id, organizationId, name }, result, (claim) => [
      stmt(db, `INSERT INTO class_sections (id, organization_id, name, created_at) SELECT ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, organizationId, name, createdAt)
    ]);
    return json(saved, 201);
  }

  const enrollmentPath = pathname.match(/^\/api\/coops\/classes\/([^/]+)\/enrollments$/);
  if (enrollmentPath && request.method === 'POST') {
    const classId = decodeURIComponent(enrollmentPath[1]); const classRow = await stmt(db, 'SELECT organization_id FROM class_sections WHERE id = ?', classId).first<{ organization_id: string }>(); if (!classRow) throw new HttpError(404, 'Class not found.'); await requireOrgAdult(db, classRow.organization_id, identity.adultId);
    const id = text(body, 'id', 100); const learnerId = text(body, 'learnerId', 100); const householdId = text(body, 'householdId', 100); const operationId = text(body, 'operationId', 120); await requireHouseholdAdult(db, householdId, identity.adultId);
    const learner = await stmt(db, 'SELECT id FROM learners WHERE id = ? AND household_id = ?', learnerId, householdId).first(); if (!learner) throw new HttpError(403, 'Learner does not belong to the authorized household.');
    const createdAt = now(); const result = { id, classId, learnerId, householdId, grantedByAdultId: identity.adultId, status: 'active' };
    const saved = await writeOnce(db, operationId, { kind: 'grant-class-share', id, classId, learnerId, householdId }, result, (claim) => [
      stmt(db, `INSERT INTO class_enrollments (id, class_id, learner_id, household_id, granted_by_adult_id, status, created_at) SELECT ?, ?, ?, ?, ?, 'active', ? WHERE ${claimExists(claim)}`, id, classId, learnerId, householdId, identity.adultId, createdAt)
    ]);
    return json(saved, 201);
  }

  const assignments = pathname.match(/^\/api\/coops\/([^/]+)\/assignments$/);
  if (assignments && request.method === 'POST') {
    const organizationId = decodeURIComponent(assignments[1]); await requireOrgAdult(db, organizationId, identity.adultId);
    const id = text(body, 'id', 100); const classId = text(body, 'classId', 100); const title = text(body, 'title', 180); const dueOn = typeof body.dueOn === 'string' ? body.dueOn : null; const operationId = text(body, 'operationId', 120); const classRow = await stmt(db, 'SELECT id FROM class_sections WHERE id = ? AND organization_id = ?', classId, organizationId).first(); if (!classRow) throw new HttpError(404, 'Class not found in this co-op.');
    const createdAt = now(); const result = { id, organizationId, classId, title, dueOn, createdAt };
    const saved = await writeOnce(db, operationId, { kind: 'create-class-assignment', id, organizationId, classId, title, dueOn }, result, (claim) => [
      stmt(db, `INSERT INTO class_assignments (id, organization_id, class_id, title, due_on, assigned_by_adult_id, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, organizationId, classId, title, dueOn, identity.adultId, createdAt)
    ]);
    return json(saved, 201);
  }

  const submit = pathname.match(/^\/api\/coops\/assignments\/([^/]+)\/submissions$/);
  if (submit && request.method === 'POST') {
    const assignmentId = decodeURIComponent(submit[1]); const learnerId = text(body, 'learnerId', 100); const resultText = text(body, 'result', 3000); const id = text(body, 'id', 100); const operationId = text(body, 'operationId', 120);
    const assignment = await stmt(db, 'SELECT a.id, a.class_id, a.organization_id FROM class_assignments a WHERE a.id = ?', assignmentId).first<{ id: string; class_id: string; organization_id: string }>(); if (!assignment) throw new HttpError(404, 'Assignment not found.'); await requireOrgAdult(db, assignment.organization_id, identity.adultId);
    const enrollment = await stmt(db, `SELECT e.id, e.household_id FROM class_enrollments e JOIN learners l ON l.id = e.learner_id WHERE e.class_id = ? AND e.learner_id = ? AND e.status = 'active' AND l.household_id = e.household_id`, assignment.class_id, learnerId).first<{ id: string; household_id: string }>();
    if (!enrollment) throw new HttpError(404, 'No active explicit share grant for this learner and class.'); await requireHouseholdAdult(db, enrollment.household_id, identity.adultId);
    const submittedAt = now(); const result = { id, assignmentId, classId: assignment.class_id, learnerId, submittedAt };
    const saved = await writeOnce(db, operationId, { kind: 'submit-class-result', assignmentId, learnerId, result: resultText }, result, (claim) => [
      stmt(db, `INSERT INTO class_submissions (id, assignment_id, class_id, learner_id, enrollment_id, result, submitted_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists(claim)}`, id, assignmentId, assignment.class_id, learnerId, enrollment.id, resultText, submittedAt)
    ]);
    return json(saved, 201);
  }

  const classRecords = pathname.match(/^\/api\/coops\/classes\/([^/]+)\/records$/);
  if (classRecords && request.method === 'GET') {
    const classId = decodeURIComponent(classRecords[1]); const classRow = await stmt(db, 'SELECT organization_id FROM class_sections WHERE id = ?', classId).first<{ organization_id: string }>(); if (!classRow) throw new HttpError(404, 'Class not found.'); await requireOrgAdult(db, classRow.organization_id, identity.adultId);
    const rows = await stmt(db, `SELECT a.id AS assignmentId, a.title, s.learner_id AS learnerId, s.result, s.submitted_at AS submittedAt FROM class_assignments a LEFT JOIN class_submissions s ON s.assignment_id = a.id WHERE a.class_id = ? ORDER BY a.id, s.learner_id`, classId).all();
    return json(rows.results);
  }

  const today = pathname.match(/^\/api\/households\/([^/]+)\/today$/);
  if (today && request.method === 'GET') {
    const householdId = decodeURIComponent(today[1]); await requireHouseholdAdult(db, householdId, identity.adultId);
    const date = new URL(request.url).searchParams.get('date') ?? now().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must use YYYY-MM-DD.');
    const own = await stmt(db, `SELECT id, learner_id AS learnerId, title, status, due_on AS dueOn, 'family' AS source FROM work_items WHERE household_id = ? AND due_on = ? AND status != 'completed' ORDER BY learner_id, id`, householdId, date).all();
    const shared = await stmt(db, `SELECT a.id AS id, e.learner_id AS learnerId, a.title, 'assigned' AS status, a.due_on AS dueOn, 'co-op' AS source FROM class_enrollments e JOIN class_assignments a ON a.class_id = e.class_id WHERE e.household_id = ? AND e.status = 'active' AND a.due_on = ? ORDER BY a.class_id, a.id`, householdId, date).all();
    return json([...own.results, ...shared.results]);
  }

  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await route(request, env); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message, detail: error.detail }, error.status);
      return json({ error: 'Local proof request failed.' }, 500);
    }
  }
};
