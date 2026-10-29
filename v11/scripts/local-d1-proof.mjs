import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'http://local.learning-harbor.test';
const persist = await mkdtemp(join(tmpdir(), 'learning-harbor-d1-proof-'));
const dbName = 'learning-harbor-local-proof';
let miniflare;

async function request(path, { method = 'GET', adultId, body } = {}) {
  const response = await miniflare.dispatchFetch(`${origin}${path}`, {
    method,
    headers: {
      ...(adultId ? { 'x-synthetic-adult-id': adultId } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, payload: await response.json() };
}

function assert(value, message) { if (!value) throw new Error(`Proof failed: ${message}`); }

async function main() {
  const bundle = await build({ entryPoints: ['cloudflare-proof/worker.ts'], bundle: true, format: 'esm', platform: 'browser', write: false });
  miniflare = new Miniflare({
    name: 'learning-harbor-local-d1-proof',
    script: bundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: dbName },
    d1Persist: persist,
    bindings: { APP_ENV: 'local-proof' }
  });
  const db = await miniflare.getD1Database('DB');
  const migration = await readFile('cloudflare-proof/migrations/0001_household_first.sql', 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }

  const createAdult = async (adultId) => {
    const res = await request('/api/dev/adults', { method: 'POST', body: { adultId } });
    assert(res.status === 201, `create synthetic adult ${adultId}: ${JSON.stringify(res.payload)}`);
  };
  const write = async (path, adultId, body) => {
    const res = await request(path, { method: 'POST', adultId, body });
    assert(res.status === 201 || res.status === 200, `${path}: ${JSON.stringify(res.payload)}`);
    return res.payload;
  };
  await createAdult('adult-family-a');
  await createAdult('adult-family-b');

  const home = await write('/api/households', 'adult-family-a', { id: 'home-a', name: 'Synthetic Harbor Family', operationId: 'op-home-a-0001' });
  const replay = await write('/api/households', 'adult-family-a', { id: 'home-a', name: 'Synthetic Harbor Family', operationId: 'op-home-a-0001' });
  assert(JSON.stringify(home) === JSON.stringify(replay), 'idempotent household replay returns the first receipt');
  const reusedOperation = await request('/api/households', { method: 'POST', adultId: 'adult-family-a', body: { id: 'home-a', name: 'Changed content', operationId: 'op-home-a-0001' } });
  assert(reusedOperation.status === 409, 'operation ID reuse with a different fingerprint is rejected');
  await write('/api/households', 'adult-family-b', { id: 'home-b', name: 'Synthetic Other Family', operationId: 'op-home-b-0001' });
  const learner = await write('/api/households/home-a/learners', 'adult-family-a', { id: 'learner-a', preferredName: 'Jordan', gradeBand: '4-6', operationId: 'op-learner-a-01' });
  await write('/api/households/home-b/learners', 'adult-family-b', { id: 'learner-b', preferredName: 'Avery', gradeBand: '7-9', operationId: 'op-learner-b-01' });

  const deniedOtherHousehold = await request('/api/households/home-b/learners', { adultId: 'adult-family-a' });
  assert(deniedOtherHousehold.status === 404, 'adult cannot enumerate another household');
  await write('/api/academic-years', 'adult-family-a', { id: 'year-a', householdId: 'home-a', label: '2026–27', startsOn: '2026-08-01', endsOn: '2027-06-30', operationId: 'op-year-a-01' });

  const workItem = await write('/api/households/home-a/work-items', 'adult-family-a', { id: 'work-a', learnerId: learner.id, title: 'Read and narrate', instructions: 'Synthetic family work.', dueOn: '2026-10-28', operationId: 'op-work-a-01' });
  await write('/api/households/home-a/work-items', 'adult-family-a', { id: 'work-a', learnerId: learner.id, title: 'Read and narrate', instructions: 'Synthetic family work.', dueOn: '2026-10-28', operationId: 'op-work-a-01' });
  const todayAfterReplay = await request('/api/households/home-a/today?date=2026-10-28', { adultId: 'adult-family-a' });
  assert(todayAfterReplay.payload.filter((item) => item.id === workItem.id).length === 1, 'replayed create did not duplicate family work');
  await write('/api/households/home-a/work-items/work-a/logs', 'adult-family-a', { id: 'log-a', status: 'ready-for-review', note: 'Narration recorded locally.', operationId: 'op-log-a-01' });
  await write('/api/households/home-a/attendance', 'adult-family-a', { id: 'att-a', learnerId: learner.id, date: '2026-10-28', minutes: 210, operationId: 'op-att-a-01' });
  const evidence = await write('/api/households/home-a/evidence', 'adult-family-a', { id: 'evidence-a', learnerId: learner.id, workItemId: workItem.id, label: 'Narration notes', reference: 'Synthetic text evidence only.', operationId: 'op-evidence-a-01' });
  await write('/api/households/home-a/evidence/evidence-a/review', 'adult-family-a', { id: 'review-a', decision: 'accepted', feedback: 'Adult-reviewed synthetic evidence.', operationId: 'op-review-a-01' });
  assert(evidence.reviewStatus === 'awaiting-adult-review', 'evidence starts in the explicit adult-review state');

  await write('/api/coops', 'adult-family-a', { id: 'coop-a', name: 'Synthetic Co-op', operationId: 'op-coop-a-01' });
  await write('/api/coops/coop-a/adults', 'adult-family-a', { adultId: 'adult-instructor', role: 'instructor', operationId: 'op-instructor-01' });
  await write('/api/coops/coop-a/adults', 'adult-family-a', { adultId: 'adult-member', role: 'member', operationId: 'op-member-01' });
  const deniedMemberClassCreate = await request('/api/coops/coop-a/classes', { method: 'POST', adultId: 'adult-member', body: { id: 'class-member-denied', name: 'Denied Member Class', operationId: 'op-member-class-01' } });
  assert(deniedMemberClassCreate.status === 403, 'ordinary co-op member cannot create a class');
  const classroom = await write('/api/coops/coop-a/classes', 'adult-family-a', { id: 'class-a', name: 'Nature Studies', operationId: 'op-class-a-01' });
  const deniedShare = await request('/api/coops/classes/class-a/enrollments', { method: 'POST', adultId: 'adult-family-a', body: { id: 'share-b', learnerId: 'learner-b', householdId: 'home-b', operationId: 'op-share-b-01' } });
  assert(deniedShare.status === 404, 'a parent cannot grant co-op access to a learner in another household');
  await write('/api/coops/classes/class-a/enrollments', 'adult-family-a', { id: 'share-a', learnerId: learner.id, householdId: 'home-a', operationId: 'op-share-a-01' });
  const deniedMemberAssignment = await request('/api/coops/coop-a/assignments', { method: 'POST', adultId: 'adult-member', body: { id: 'assignment-member-denied', classId: classroom.id, title: 'Denied member assignment', dueOn: '2026-10-28', operationId: 'op-member-assignment-01' } });
  assert(deniedMemberAssignment.status === 403, 'ordinary co-op member cannot create a class assignment');
  const assignment = await write('/api/coops/coop-a/assignments', 'adult-family-a', { id: 'assignment-a', classId: classroom.id, title: 'Observe a local plant', dueOn: '2026-10-28', operationId: 'op-assignment-a-01' });
  const householdToday = await request('/api/households/home-a/today?date=2026-10-28', { adultId: 'adult-family-a' });
  assert(householdToday.payload.some((item) => item.id === assignment.id && item.source === 'co-op'), 'shared class assignment projects into household Today');
  await write('/api/coops/assignments/assignment-a/submissions', 'adult-family-a', { id: 'submission-a', learnerId: learner.id, result: 'Synthetic class result only.', operationId: 'op-submission-a-01' });

  const deniedMemberClassView = await request('/api/coops/classes/class-a/records', { adultId: 'adult-member' });
  assert(deniedMemberClassView.status === 403, 'ordinary co-op member cannot read class submissions/results');
  const classView = await request('/api/coops/classes/class-a/records', { adultId: 'adult-instructor' });
  assert(classView.status === 200 && classView.payload.length === 1, 'instructor sees the class-scoped submission');
  assert(classView.payload[0].result === 'Synthetic class result only.', 'only deliberately shared class result is returned');
  assert(!JSON.stringify(classView.payload).includes('family work') && !JSON.stringify(classView.payload).includes('Narration notes'), 'class view excludes unrelated household work and evidence');
  const instructorHouseholdProbe = await request('/api/households/home-a/today', { adultId: 'adult-instructor' });
  assert(instructorHouseholdProbe.status === 404, 'co-op instructor cannot query a household without membership');

  const update = await request('/api/work-items/work-a', { method: 'PATCH', adultId: 'adult-family-a', body: { baseVersion: 2, title: 'Read, narrate, and discuss', operationId: 'op-edit-a-01' } });
  assert(update.status === 200 && update.payload.version === 3, 'versioned work update succeeds');
  const conflict = await request('/api/work-items/work-a', { method: 'PATCH', adultId: 'adult-family-a', body: { baseVersion: 2, title: 'Stale edit', operationId: 'op-edit-stale-01' } });
  assert(conflict.status === 409 && conflict.payload.detail.current.version === 3, 'divergent edit returns current version instead of last-write-wins');

  const counts = {};
  for (const table of ['households', 'learners', 'work_items', 'attendance_records', 'evidence_metadata', 'adult_reviews', 'class_submissions']) {
    const count = await db.prepare(`SELECT count(*) AS rows FROM ${table}`).first();
    counts[table] = count.rows;
  }
  console.log('Local D1 architecture proof passed: household isolation, explicit co-op sharing, class-role authorization, adult review, idempotent replay, and conflict visibility.');
  console.log(`Synthetic row counts: ${JSON.stringify(counts)}`);
  console.log('No remote Cloudflare or Supabase resource was contacted.');
}

try { await main(); }
finally {
  if (miniflare) await miniflare.dispose();
  await rm(persist, { recursive: true, force: true });
}