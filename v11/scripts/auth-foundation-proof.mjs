import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = 'http://local.learning-harbor.test';
const persist = await mkdtemp(join(tmpdir(), 'learning-harbor-auth-proof-'));
const secret = 'synthetic-local-proof-secret-000000000000000000000000';
let miniflare;

function assert(value, message) {
  if (!value) throw new Error(`Auth foundation proof failed: ${message}`);
}

class CookieJar {
  constructor() {
    this.values = new Map();
  }

  cloneHeader() {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  apply(response) {
    const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
    let cookies = getSetCookie ? getSetCookie() : [];
    if (cookies.length === 0) {
      const combined = response.headers.get('set-cookie');
      if (combined) cookies = [combined];
    }
    for (const cookie of cookies) {
      const first = cookie.split(';', 1)[0];
      const separator = first.indexOf('=');
      if (separator < 1) continue;
      const name = first.slice(0, separator).trim();
      const value = first.slice(separator + 1).trim();
      if (!value || /max-age=0/i.test(cookie)) this.values.delete(name);
      else this.values.set(name, value);
    }
  }
}

async function request(path, { method = 'GET', jar, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('origin', origin);
  if (jar?.cloneHeader()) requestHeaders.set('cookie', jar.cloneHeader());
  if (body !== undefined) requestHeaders.set('content-type', 'application/json');
  const response = await miniflare.dispatchFetch(`${origin}${path}`, {
    method,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  jar?.apply(response);
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }
  return { status: response.status, payload, headers: response.headers };
}

async function applyMigration(db, path) {
  const migration = await readFile(path, 'utf8');
  for (const sql of migration.replace(/^--.*$/gm, '').split(';').map((part) => part.trim()).filter(Boolean)) {
    await db.prepare(sql).run();
  }
}

async function signUp(label, email, password) {
  const jar = new CookieJar();
  const response = await request('/api/auth/sign-up/email', {
    method: 'POST',
    jar,
    body: { name: label, email, password }
  });
  assert(response.status >= 200 && response.status < 300, `sign-up ${email}: ${response.status} ${JSON.stringify(response.payload)}`);
  assert(jar.cloneHeader().length > 0, `sign-up ${email} creates a session cookie`);
  const session = await request('/api/auth/get-session', { jar });
  assert(session.status === 200 && session.payload?.user?.id, `sign-up ${email} resolves a session`);
  return { jar, user: session.payload.user };
}

async function signIn(email, password) {
  const jar = new CookieJar();
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    jar,
    body: { email, password, rememberMe: true }
  });
  assert(response.status >= 200 && response.status < 300, `sign-in ${email}: ${response.status} ${JSON.stringify(response.payload)}`);
  assert(jar.cloneHeader().length > 0, `sign-in ${email} creates a session cookie`);
  return jar;
}

async function main() {
  const bundle = await build({
    entryPoints: ['cloudflare-proof/auth-worker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    metafile: true
  });
  const bundleBytes = Buffer.byteLength(bundle.outputFiles[0].text, 'utf8');

  miniflare = new Miniflare({
    name: 'learning-harbor-auth-foundation-proof',
    script: bundle.outputFiles[0].text,
    modules: true,
    compatibilityDate: '2026-07-29',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'learning-harbor-auth-foundation' },
    d1Persist: persist,
    bindings: {
      APP_ENV: 'local-proof',
      BETTER_AUTH_SECRET: secret
    }
  });

  const db = await miniflare.getD1Database('DB');
  await applyMigration(db, 'cloudflare-proof/migrations/0001_household_first.sql');
  await applyMigration(db, 'cloudflare-proof/migrations/0002_better_auth.sql');

  const unauthenticated = await request('/api/households/guessed/learners', {
    headers: { 'x-synthetic-adult-id': 'forged-adult' }
  });
  assert(unauthenticated.status === 401, 'forged legacy identity header cannot authenticate without a session');

  const bootstrap = await request('/api/dev/adults', {
    method: 'POST',
    body: { adultId: 'forged-adult' }
  });
  assert(bootstrap.status === 404, 'legacy synthetic-adult bootstrap is not exposed through the auth adapter');

  const adultA = await signUp('Synthetic Adult A', 'adult-a@example.test', 'SyntheticPassphrase-A-2026');
  const adultB = await signUp('Synthetic Adult B', 'adult-b@example.test', 'SyntheticPassphrase-B-2026');

  const sessionRow = await db.prepare('SELECT "ipAddress" AS ip, "userAgent" AS agent, "userId" AS user_id FROM "session" WHERE "userId" = ?')
    .bind(adultA.user.id).first();
  assert(sessionRow?.user_id === adultA.user.id, 'session is durably stored in D1');
  assert(sessionRow.ip == null, 'Cloudflare/IP enrichment is disabled for stored sessions');

  const sessionColumns = await db.prepare('PRAGMA table_info("session")').all();
  const columnNames = sessionColumns.results.map((row) => String(row.name));
  for (const forbidden of ['city', 'country', 'region', 'timezone', 'latitude', 'longitude', 'colo']) {
    assert(!columnNames.includes(forbidden), `session schema omits Cloudflare geolocation column ${forbidden}`);
  }

  const createHome = await request('/api/households', {
    method: 'POST',
    jar: adultA.jar,
    headers: { 'x-synthetic-adult-id': adultB.user.id },
    body: { id: 'home-auth-a', name: 'Synthetic Auth Family', operationId: 'op-auth-home-a-0001' }
  });
  assert(createHome.status === 201, `authenticated adult creates household: ${JSON.stringify(createHome.payload)}`);

  const owner = await db.prepare('SELECT adult_id FROM household_adults WHERE household_id = ? AND role = ?')
    .bind('home-auth-a', 'owner').first();
  assert(owner?.adult_id === adultA.user.id, 'verified session principal overrides a forged legacy identity header');

  const learner = await request('/api/households/home-auth-a/learners', {
    method: 'POST',
    jar: adultA.jar,
    body: { id: 'learner-auth-a', preferredName: 'Synthetic Learner', gradeBand: '4-6', operationId: 'op-auth-learner-a-01' }
  });
  assert(learner.status === 201, 'household adult can create a parent-managed learner profile');

  const deniedHousehold = await request('/api/households/home-auth-a/learners', { jar: adultB.jar });
  assert(deniedHousehold.status === 404, 'authenticated adult B cannot enumerate household A by guessed ID');

  const coop = await request('/api/coops', {
    method: 'POST',
    jar: adultA.jar,
    body: { id: 'coop-auth-a', name: 'Synthetic Auth Co-op', operationId: 'op-auth-coop-a-01' }
  });
  assert(coop.status === 201, 'authenticated adult can create a co-op within existing authorization rules');

  const member = await request('/api/coops/coop-auth-a/adults', {
    method: 'POST',
    jar: adultA.jar,
    body: { adultId: adultB.user.id, role: 'member', operationId: 'op-auth-member-b-01' }
  });
  assert(member.status === 201, 'co-op admin can scope another authenticated adult as an ordinary member');

  const deniedClass = await request('/api/coops/coop-auth-a/classes', {
    method: 'POST',
    jar: adultB.jar,
    body: { id: 'class-denied', name: 'Denied Member Class', operationId: 'op-auth-class-denied-01' }
  });
  assert(deniedClass.status === 403, 'authenticated ordinary co-op member still cannot perform instructor/admin class operations');

  const allowedClass = await request('/api/coops/coop-auth-a/classes', {
    method: 'POST',
    jar: adultA.jar,
    body: { id: 'class-auth-a', name: 'Synthetic Auth Class', operationId: 'op-auth-class-a-01' }
  });
  assert(allowedClass.status === 201, 'authenticated co-op admin retains explicitly authorized class scope');

  const staleCookie = adultA.jar.cloneHeader();
  const signOut = await request('/api/auth/sign-out', { method: 'POST', jar: adultA.jar });
  assert(signOut.status >= 200 && signOut.status < 300, 'sign-out succeeds');

  const staleRequest = await miniflare.dispatchFetch(`${origin}/api/households/home-auth-a/learners`, {
    headers: { origin, cookie: staleCookie }
  });
  assert(staleRequest.status === 401, 'revoked session fails closed even if a stale cookie is replayed');

  const signedInAgain = await signIn('adult-a@example.test', 'SyntheticPassphrase-A-2026');
  const restored = await request('/api/households/home-auth-a/learners', { jar: signedInAgain });
  assert(restored.status === 200 && restored.payload?.length === 1, 'fresh sign-in restores the same AdultIdentity authorization scope');

  const adultRows = await db.prepare('SELECT count(*) AS rows FROM adult_accounts WHERE id IN (?, ?)')
    .bind(adultA.user.id, adultB.user.id).first();
  assert(Number(adultRows?.rows ?? 0) === 2, 'session principals are adapted into existing adult_accounts without child principals');

  const rateLimitTable = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rateLimit'").first();
  assert(rateLimitTable?.name === 'rateLimit', 'database-backed Better Auth rate limiting is present without KV');

  const authTables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user','session','account','verification','rateLimit') ORDER BY name").all();
  assert(authTables.results.length === 5, 'all five bounded Better Auth tables exist');

  console.log('AUTH-FOUNDATION-001 local proof passed.');
  console.log(`Better Auth bundle bytes: ${bundleBytes}`);
  console.log(`Auth tables: ${authTables.results.map((row) => row.name).join(', ')}`);
  console.log('Privacy: IP auto-detection off, IP storage disabled, geolocation tracking off.');
  console.log('Authority: Better Auth session -> existing AdultIdentity/household/co-op authorization boundary.');
  console.log('No KV/R2/Hyperdrive, remote provider, email/SMS provider, child account, or real family/student data used.');
}

try {
  await main();
} finally {
  if (miniflare) await miniflare.dispose();
  await rm(persist, { recursive: true, force: true });
}
