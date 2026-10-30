import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'http://local.learning-harbor.test';
const persist = await mkdtemp(join(tmpdir(), 'learning-harbor-offline-queue-'));
let miniflare;

function assert(value, message) {
  if (!value) throw new Error(`Offline-queue proof failed: ${message}`);
}

function installLocalStoragePolyfill() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; }
  };
}

async function loadSyncQueueManager() {
  const bundled = await build({
    entryPoints: ['src/services/sync-queue.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false
  });
  const encoded = Buffer.from(bundled.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
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

async function main() {
  installLocalStoragePolyfill();
  const { SyncQueueManager } = await loadSyncQueueManager();

  const workerBundle = await build({
    entryPoints: ['cloudflare-proof/worker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false
  });
  miniflare = new Miniflare({
    name: 'learning-harbor-offline-queue-proof',
    script: workerBundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: 'learning-harbor-offline-queue' },
    d1Persist: persist,
    bindings: { APP_ENV: 'local-proof' }
  });

  const db = await miniflare.getD1Database('DB');
  const migration = await readFile('cloudflare-proof/migrations/0001_household_first.sql', 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }

  const adult = await request('/api/dev/adults', { method: 'POST', body: { adultId: 'adult-offline' } });
  assert(adult.status === 201, 'synthetic adult bootstrap succeeds');

  let online = false;
  const queue = new SyncQueueManager({ mode: 'local-first', onlineProvider: () => online });
  queue.reset();

  const localMirror = {
    household: { id: 'home-offline', name: 'Synthetic Offline Family' },
    learner: { id: 'learner-offline', householdId: 'home-offline', preferredName: 'River', gradeBand: '4-6' }
  };

  const householdOperation = queue.enqueue({
    id: 'op-offline-household-0001',
    kind: 'd1-create-household',
    fingerprint: 'd1-create-household:home-offline:Synthetic Offline Family',
    payload: { id: localMirror.household.id, name: localMirror.household.name }
  });
  const duplicateHousehold = queue.enqueue({
    id: 'op-offline-household-duplicate',
    kind: 'd1-create-household',
    fingerprint: 'd1-create-household:home-offline:Synthetic Offline Family',
    payload: { id: localMirror.household.id, name: localMirror.household.name }
  });
  assert(duplicateHousehold.id === householdOperation.id, 'existing queue suppresses an active duplicate fingerprint');

  queue.enqueue({
    id: 'op-offline-learner-0001',
    kind: 'd1-create-learner',
    fingerprint: 'd1-create-learner:home-offline:learner-offline:River:4-6',
    payload: localMirror.learner
  });

  queue.setExecutor(async (operation) => {
    let response;
    if (operation.kind === 'd1-create-household') {
      response = await request('/api/households', {
        method: 'POST',
        adultId: 'adult-offline',
        body: { ...operation.payload, operationId: operation.id }
      });
    } else if (operation.kind === 'd1-create-learner') {
      response = await request(`/api/households/${operation.payload.householdId}/learners`, {
        method: 'POST',
        adultId: 'adult-offline',
        body: {
          id: operation.payload.id,
          preferredName: operation.payload.preferredName,
          gradeBand: operation.payload.gradeBand,
          operationId: operation.id
        }
      });
    } else {
      throw new Error(`Unsupported proof operation ${operation.kind}`);
    }
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`${operation.kind} failed with ${response.status}: ${JSON.stringify(response.payload)}`);
    }
  });

  await queue.process();
  let snapshot = queue.getSnapshot();
  assert(snapshot.pendingCount === 2 && snapshot.completedCount === 0, 'offline processing leaves operations queued');
  const beforeSync = await db.prepare('SELECT count(*) AS rows FROM households').first();
  assert(Number(beforeSync?.rows ?? 0) === 0, 'offline local mirror does not silently mutate D1');
  assert(localMirror.learner.householdId === localMirror.household.id, 'local mirror remains immediately usable while offline');

  online = true;
  await queue.process();
  snapshot = queue.getSnapshot();
  assert(snapshot.pendingCount === 0 && snapshot.failedCount === 0 && snapshot.completedCount === 2, 'queued operations complete after connectivity returns');

  const remoteLearners = await request('/api/households/home-offline/learners', { adultId: 'adult-offline' });
  assert(remoteLearners.status === 200, 'D1 household readback succeeds after queue flush');
  assert(remoteLearners.payload.length === 1 && remoteLearners.payload[0].id === localMirror.learner.id, 'queued local learner reaches D1 without changing local identity');

  await queue.process();
  const householdCount = await db.prepare('SELECT count(*) AS rows FROM households WHERE id = ?').bind('home-offline').first();
  const learnerCount = await db.prepare('SELECT count(*) AS rows FROM learners WHERE id = ?').bind('learner-offline').first();
  assert(Number(householdCount?.rows ?? 0) === 1 && Number(learnerCount?.rows ?? 0) === 1, 'reprocessing a completed queue does not duplicate D1 records');

  console.log('Offline-queue proof passed: local state remains usable offline, duplicate fingerprints collapse, queued operations flush to D1, and readback preserves identity.');
  console.log('No remote Cloudflare or Supabase resource was contacted.');
}

try {
  await main();
} finally {
  if (miniflare) await miniflare.dispose();
  await rm(persist, { recursive: true, force: true });
}
