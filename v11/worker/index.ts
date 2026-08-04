interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
  APP_ENV?: string;
  APP_RELEASE?: string;
}

const RELEASE = '11.0.0-beta.3';
const SERVICE = 'beaufort-learning-harbor-v11-preview';

function securityHeaders(headers = new Headers()): Headers {
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('x-frame-options', 'DENY');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set(
    'content-security-policy',
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co"
  );
  return headers;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = securityHeaders(new Headers(init.headers));
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(request.method)) {
      return json({ error: 'Method not allowed' }, { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: SERVICE, release: env.APP_RELEASE ?? RELEASE, environment: env.APP_ENV ?? 'preview' });
    }
    if (url.pathname === '/api/config') {
      return json({
        release: env.APP_RELEASE ?? RELEASE,
        environment: env.APP_ENV ?? 'preview',
        productionDataEnabled: false,
        identity: {
          signup: true,
          emailConfirmation: 'provider-configured',
          passwordRecovery: true,
          organizationBootstrap: true,
          oneTimeInvitations: true,
          systemAdminInvitations: false
        },
        learning: {
          parentManagedLearners: true,
          learnerEmailRequired: false,
          parentAssistedHandoff: true,
          independentLearnerAuthentication: false,
          explicitAdultReview: true,
          objectiveKnowledgeChecks: true,
          deterministicObjectiveScoring: true,
          explicitEvidenceReview: true,
          evidenceRevisionHistory: true,
          weeklyHouseholdPlanning: true,
          automaticGrades: false,
          automaticMastery: false,
          automaticAttendance: false,
          automaticXp: false,
          automaticPortfolioApproval: false
        },
        resilience: {
          localMirror: true,
          orderedMutationQueue: true,
          idempotentOperationReceipts: true,
          retryAndCancelControls: true,
          syncDisabledWhileSignedOut: true,
          encryptedPortableBackup: true,
          beta3RecordsIncludedInBackup: true,
          beta2BackupImport: true,
          restorePreviewRequired: true,
          automaticCloudBackup: false
        },
        integrations: {
          supabase: 'optional-browser-configured',
          band: 'not-configured'
        }
      });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, { status: 404 });
    const assetResponse = await env.ASSETS.fetch(request);
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: securityHeaders(new Headers(assetResponse.headers))
    });
  }
};
