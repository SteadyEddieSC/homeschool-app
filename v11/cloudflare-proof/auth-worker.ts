import appWorker from './worker';
import { createAuth } from './auth';

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}

interface LocalD1 {
  prepare(sql: string): D1Statement;
}

interface Env {
  DB: LocalD1;
  APP_ENV: string;
  BETTER_AUTH_SECRET: string;
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function ensureAdultAccount(db: LocalD1, adultId: string): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO adult_accounts (id, created_at) VALUES (?, ?)')
    .bind(adultId, new Date().toISOString())
    .run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const auth = createAuth(env, request.url);

    if (url.pathname.startsWith('/api/auth/')) {
      return auth.handler(request);
    }

    if (url.pathname === '/api/dev/adults') {
      return json(404, { error: 'Synthetic adult bootstrap is disabled by the auth adapter.' });
    }

    if (!url.pathname.startsWith('/api/')) {
      return appWorker.fetch(request, env);
    }

    const session = await auth.api.getSession({ headers: request.headers });
    const adultId = session?.user?.id;
    if (!adultId) {
      return json(401, { error: 'Authenticated adult session required.' });
    }

    await ensureAdultAccount(env.DB, adultId);

    const headers = new Headers(request.headers);
    // The accepted #61 Worker remains unchanged for this bounded proof. The adapter
    // owns the legacy header and always replaces any caller-supplied value with the
    // verified session principal before entering the educational authorization layer.
    headers.delete('x-synthetic-adult-id');
    headers.set('x-synthetic-adult-id', adultId);

    return appWorker.fetch(new Request(request, { headers }), env);
  }
};
