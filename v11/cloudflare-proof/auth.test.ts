import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import authWorker from './auth-worker';

const origin = 'http://local.learning-harbor.test';
const secret = 'synthetic-local-proof-secret-000000000000000000000000';

class CookieJar {
  private readonly values = new Map<string, string>();

  header(): string {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  apply(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    let cookies = headers.getSetCookie?.() ?? [];
    if (cookies.length === 0) {
      const combined = response.headers.get('set-cookie');
      if (combined) cookies = [combined];
    }
    for (const cookie of cookies) {
      const first = cookie.split(';', 1)[0] ?? '';
      const separator = first.indexOf('=');
      if (separator < 1) continue;
      const name = first.slice(0, separator).trim();
      const value = first.slice(separator + 1).trim();
      if (!value || /max-age=0/i.test(cookie)) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
}

type D1Database = Awaited<ReturnType<Miniflare['getD1Database']>>;

let miniflare: Miniflare;
let db: D1Database;
let bundleBytes = 0;

const env = () => ({ DB: db, APP_ENV: 'local-proof', BETTER_AUTH_SECRET: secret });

async function request(
  path: string,
  { method = 'GET', jar, body, headers = {} }: {
    method?: string;
    jar?: CookieJar;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; payload: any; response: Response }> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('origin', origin);
  if (jar?.header()) requestHeaders.set('cookie', jar.header());
  if (body !== undefined) requestHeaders.set('content-type', 'application/json');
  const response = await authWorker.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    }),
    env() as never
  );
  jar?.apply(response);
  const text = await response.text();
  let payload: any = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }
  return { status: response.status, payload, response };
}

async function applyMigration(path: string): Promise<void> {
  const migration = await readFile(path, 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }
}

async function signUp(label: string, email: string, password: string) {
  const jar = new CookieJar();
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    jar,
    body: { name: label, email, password }
  });
  expect(response.status, JSON.stringify(response.payload)).toBeGreaterThanOrEqual(200);
  expect(response.status, JSON.stringify(response.payload)).toBeLessThan(300);
  expect(jar.header()).not.toBe('');
  const session = await request('/api/auth/get-session', { jar });
  expect(session.status).toBe(200);
  expect(session.payload?.user?.id).toBeTruthy();
  return { jar, user: session.payload.user as { id: string; email: string } };
}

async function signIn(email: string, password: string): Promise<CookieJar> {
  const jar = new CookieJar();
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    jar,
    body: { email, password, rememberMe: true }
  });
  expect(response.status, JSON.stringify(response.payload)).toBeGreaterThanOrEqual(200);
  expect(response.status, JSON.stringify(response.payload)).toBeLessThan(300);
  expect(jar.header()).not.toBe('');
  return jar;
}

beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['cloudflare-proof/auth-worker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    metafile: true
  });
  bundleBytes = Buffer.byteLength(bundle.outputFiles[0]?.text ?? '', 'utf8');

  miniflare = new Miniflare({
    name: 'learning-harbor-auth-foundation-storage',
    script: 'export default { fetch() { return new Response("ok"); } }',
    modules: true,
    compatibilityDate: '2026-07-29',
    d1Databases: { DB: 'learning-harbor-auth-foundation' }
  });
  db = await miniflare.getD1Database('DB');
  await applyMigration('cloudflare-proof/migrations/0001_household_first.sql');
  await applyMigration('cloudflare-proof/migrations/0002_better_auth.sql');
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

test('authenticates adults while preserving existing household/co-op authorization', async () => {
  const unauthenticated = await request('/api/households/guessed/learners', {
    headers: { 'x-synthetic-adult-id': 'forged-adult' }
  });
  expect(unauthenticated.status).toBe(401);

  const bootstrap = await request('/api/dev/adults', {
    method: 'POST',
    body: { adultId: 'forged-adult' }
  });
  expect(bootstrap.status).toBe(404);

  const adultA = await signUp('Synthetic Adult A', 'adult-a@example.test', 'SyntheticPassphrase-A-2026');
  const adultB = await signUp('Synthetic Adult B', 'adult-b@example.test', 'SyntheticPassphrase-B-2026');

  const sessionRow = await db
    .prepare('SELECT "ipAddress" AS ip, "userAgent" AS agent, "userId" AS user_id FROM "session" WHERE "userId" = ?')
    .bind(adultA.user.id)
    .first<Record<string, unknown>>();
  expect(sessionRow?.user_id).toBe(adultA.user.id);
  expect(sessionRow?.ip ?? null).toBeNull();

  const sessionColumns = await db.prepare('PRAGMA table_info("session")').all<Record<string, unknown>>();
  const columnNames = sessionColumns.results.map((row) => String(row.name));
  for (const forbidden of ['city', 'country', 'region', 'timezone', 'latitude', 'longitude', 'colo']) {
    expect(columnNames).not.toContain(forbidden);
  }

  const createHome = await request('/api/households', {
    method: 'POST',
    jar: adultA.jar,
    headers: { 'x-synthetic-adult-id': adultB.user.id },
    body: { id: 'home-auth-a', name: 'Synthetic Auth Family', operationId: 'op-auth-home-a-0001' }
  });
  expect(createHome.status, JSON.stringify(createHome.payload)).toBe(201);

  const owner = await db
    .prepare('SELECT adult_id FROM household_adults WHERE household_id = ? AND role = ?')
    .bind('home-auth-a', 'owner')
    .first<Record<string, unknown>>();
  expect(owner?.adult_id).toBe(adultA.user.id);

  const learner = await request('/api/households/home-auth-a/learners', {
    method: 'POST',
    jar: adultA.jar,
    body: {
      id: 'learner-auth-a',
      preferredName: 'Synthetic Learner',
      gradeBand: '4-6',
      operationId: 'op-auth-learner-a-01'
    }
  });
  expect(learner.status, JSON.stringify(learner.payload)).toBe(201);

  const deniedHousehold = await request('/api/households/home-auth-a/learners', { jar: adultB.jar });
  expect(deniedHousehold.status).toBe(404);

  const coop = await request('/api/coops', {
    method: 'POST',
    jar: adultA.jar,
    body: { id: 'coop-auth-a', name: 'Synthetic Auth Co-op', operationId: 'op-auth-coop-a-01' }
  });
  expect(coop.status, JSON.stringify(coop.payload)).toBe(201);

  const member = await request('/api/coops/coop-auth-a/adults', {
    method: 'POST',
    jar: adultA.jar,
    body: { adultId: adultB.user.id, role: 'member', operationId: 'op-auth-member-b-01' }
  });
  expect(member.status, JSON.stringify(member.payload)).toBe(201);

  const deniedClass = await request('/api/coops/coop-auth-a/classes', {
    method: 'POST',
    jar: adultB.jar,
    body: { id: 'class-denied', name: 'Denied Member Class', operationId: 'op-auth-class-denied-01' }
  });
  expect(deniedClass.status).toBe(403);

  const allowedClass = await request('/api/coops/coop-auth-a/classes', {
    method: 'POST',
    jar: adultA.jar,
    body: { id: 'class-auth-a', name: 'Synthetic Auth Class', operationId: 'op-auth-class-a-01' }
  });
  expect(allowedClass.status, JSON.stringify(allowedClass.payload)).toBe(201);

  const staleCookie = adultA.jar.header();
  const signOut = await request('/api/auth/sign-out', { method: 'POST', jar: adultA.jar });
  expect(signOut.status).toBeGreaterThanOrEqual(200);
  expect(signOut.status).toBeLessThan(300);

  const stale = await request('/api/households/home-auth-a/learners', {
    headers: { cookie: staleCookie }
  });
  expect(stale.status).toBe(401);

  const signedInAgain = await signIn('adult-a@example.test', 'SyntheticPassphrase-A-2026');
  const restored = await request('/api/households/home-auth-a/learners', { jar: signedInAgain });
  expect(restored.status).toBe(200);
  expect(restored.payload).toHaveLength(1);

  const adultRows = await db
    .prepare('SELECT count(*) AS rows FROM adult_accounts WHERE id IN (?, ?)')
    .bind(adultA.user.id, adultB.user.id)
    .first<Record<string, unknown>>();
  expect(Number(adultRows?.rows ?? 0)).toBe(2);

  const rateLimitTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rateLimit'")
    .first<Record<string, unknown>>();
  expect(rateLimitTable?.name).toBe('rateLimit');

  const authTables = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user','session','account','verification','rateLimit') ORDER BY name")
    .all<Record<string, unknown>>();
  expect(authTables.results).toHaveLength(5);

  console.log(`AUTH-FOUNDATION-001 Better Auth bundle bytes: ${bundleBytes}`);
  console.log(`AUTH-FOUNDATION-001 auth tables: ${authTables.results.map((row) => row.name).join(', ')}`);
  console.log('AUTH-FOUNDATION-001 privacy: IP tracking disabled; no geolocation plugin or columns.');
  console.log('AUTH-FOUNDATION-001 authority: verified session -> existing AdultIdentity/household/co-op rules.');
}, 60_000);
