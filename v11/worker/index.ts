interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
  APP_ENV?: string;
  APP_RELEASE?: string;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'beaufort-learning-harbor-v11-preview',
        release: env.APP_RELEASE ?? '11.0.0-alpha.1',
        environment: env.APP_ENV ?? 'preview'
      });
    }

    if (url.pathname === '/api/config') {
      return json({
        release: env.APP_RELEASE ?? '11.0.0-alpha.1',
        environment: env.APP_ENV ?? 'preview',
        productionDataEnabled: false,
        integrations: {
          supabase: 'browser-configured',
          band: 'not-configured'
        }
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
