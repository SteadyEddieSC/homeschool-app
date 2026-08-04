import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RuntimeConfiguration {
  release: string;
  environment: string;
  supabaseConfigured: boolean;
  supabaseHost: string;
  mode: 'cloud' | 'local-preview';
}

function decodeJwtRole(value: string): string {
  try {
    const payload = value.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized)) as { role?: unknown };
    return typeof decoded.role === 'string' ? decoded.role : '';
  } catch {
    return '';
  }
}

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const serviceRoleDetected = decodeJwtRole(publishableKey) === 'service_role';

if (serviceRoleDetected) {
  throw new Error('A Supabase service-role key must never be exposed to the browser.');
}

const parsedSupabaseUrl = (() => {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    const hosted = parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
    const loopback = parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
    return hosted || loopback ? parsed : null;
  } catch {
    return null;
  }
})();

export const runtimeConfiguration: RuntimeConfiguration = Object.freeze({
  release: '11.0.0-beta.2',
  environment: String(import.meta.env.VITE_APP_ENV ?? 'preview'),
  supabaseConfigured: Boolean(parsedSupabaseUrl && publishableKey),
  supabaseHost: parsedSupabaseUrl?.hostname ?? '',
  mode: parsedSupabaseUrl && publishableKey ? 'cloud' : 'local-preview'
});

export const supabase: SupabaseClient | null = runtimeConfiguration.supabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'x-client-info': `beaufort-learning-harbor/${runtimeConfiguration.release}`
        }
      }
    })
  : null;
