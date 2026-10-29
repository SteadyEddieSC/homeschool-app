import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'http://local.learning-harbor.test';
const persist = await mkdtemp(join(tmpdir(), 'learning-harbor-share-revocation-'));
let miniflare;

function assert(value, message) {
  if (!value) throw new Error(`Share-revocation proof failed: ${message}`);
}

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

async function write(path, adultId, body) {
  const response = await request(path, { method: 'POST', adultId, body });
  assert(response.status === 200 || response.status === 201, `${path}: ${JSON.stringify(response.payload)}`);
  return response.payload;
}

async function main() {
  const bundle = await build({
    entryPoints: ['cloudflare-proof/worker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false
  });

  miniflare = new Miniflare({
    name: 'learning-harbor-share-revocation-proof',
    script: bundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: 'learning-harbor-share-revocation' },
    d1Persist: persist,
    bindings: { APP_ENV: 'local-proof' }
  });

  const db = await miniflare.getD1Database('DB');
  const migration = await readFile('cloudflare-proof/migrations/0001_household_first.sql', 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }

  await write('/api/dev/adults', undefined, { adultId: 'adult-parent' });
  await write('/api/households', 'adult-parent', {
    id: 'home-a', name: 'Synthetic Harbor Family', operationId: 'op-home-a-revoke'
  });
  await write('/api/households/home-a/learners', 'adult-parent', {
    id: 'learner-a', preferredName: 'Jordan', gradeBand: '4-6', operationId: 'op-learner-a-revoke'
  });
  await write('/api/households/home-a/work-items', 'adult-parent', {
    id: 'family-work-a', learnerId: 'learner-a', title: 'Private family work',
    instructions: 'Synthetic household-authoritative work.', dueOn: '2026-10-28', operationId: 'op-family-work-revoke'
  });

  await write('/api/coops', 'adult-parent', {
    id: 'coop-a', name: 'Synthetic Co-op', operationId: 'op-coop-a-revoke'
  });
  await write('/api/coops/coop-a/classes', 'adult-parent', {
    id: 'class-a', name: 'Nature Studies', operationId: 'op-class-a-revoke'
  });
  await write('/api/coops/classes/class-a/enrollments', 'adult-parent', {
    id: 'share-a', learnerId: 'learner-a', householdId: 'home-a', operationId: 'op-share-a-revoke'
  });
  await write('/api/coops/coop-a/assignments', 'adult-parent', {
    id: 'assignment-a', classId: 'class-a', title: 'Observe a local plant',
    dueOn: '2026-10-28', operationId: 'op-assignment-a-revoke'
  });
  await write('/api/coops/assignments/assignment-a/submissions', 'adult-parent', {
    id: 'submission-a', learnerId: 'learner-a', result: 'Synthetic class result only.',
    operationId: 'op-submission-a-revoke'
  });

  const before = await request('/api/households/home-a/today?date=2026-10-28', { adultId: 'adult-parent' });
  assert(before.status === 200, 'Today is readable before revocation');
  assert(before.payload.some((item) => item.id === 'family-work-a' && item.source === 'family'), 'private family work exists before revocation');
  assert(before.payload.some((item) => item.id === 'assignment-a' && item.source === 'co-op'), 'shared class assignment projects before revocation');

  const revoked = await db.prepare("UPDATE class_enrollments SET status = 'revoked' WHERE id = ? AND household_id = ?")
    .bind('share-a', 'home-a').run();
  assert((revoked.meta?.changes ?? 0) === 1, 'exactly one explicit class share is revoked');

  const after = await request('/api/households/home-a/today?date=2026-10-28', { adultId: 'adult-parent' });
  assert(after.status === 200, 'Today remains readable after revocation');
  assert(after.payload.some((item) => item.id === 'family-work-a' && item.source === 'family'), 'revocation preserves household-authoritative work');
  assert(!after.payload.some((item) => item.id === 'assignment-a' && item.source === 'co-op'), 'revoked class assignment no longer projects into household Today');

  const householdWork = await db.prepare('SELECT count(*) AS rows FROM work_items WHERE household_id = ? AND id = ?')
    .bind('home-a', 'family-work-a').first();
  assert(Number(householdWork?.rows ?? 0) === 1, 'household work remains stored after class-share revocation');

  const historicalSubmission = await db.prepare('SELECT count(*) AS rows FROM class_submissions WHERE id = ? AND enrollment_id = ?')
    .bind('submission-a', 'share-a').first();
  assert(Number(historicalSubmission?.rows ?? 0) === 1, 'historical class submission remains auditable after revocation');

  const classRecords = await request('/api/coops/classes/class-a/records', { adultId: 'adult-parent' });
  assert(classRecords.status === 200, 'authorized co-op adult can still inspect class history');
  assert(classRecords.payload.some((row) => row.assignmentId === 'assignment-a' && row.result === 'Synthetic class result only.'),
    'revocation does not erase already-submitted class evidence');
  assert(!JSON.stringify(classRecords.payload).includes('Private family work'), 'class history still excludes unrelated household work');

  console.log('Share-revocation proof passed: revocation removes future class projection without deleting household records or historical class submissions.');
  console.log('No remote Cloudflare or Supabase resource was contacted.');
}

try {
  await main();
} finally {
  if (miniflare) await miniflare.dispose();
  await rm(persist, { recursive: true, force: true });
}
