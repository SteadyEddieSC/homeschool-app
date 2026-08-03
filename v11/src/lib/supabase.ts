import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RuntimeConfiguration {
  release: string;
  environment: string;
  supabaseConfigured: boolean;
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

const urlIsValid = (() => {
  if (!supabaseUrl) return false;
  try {
    const parsed = new URL(supabaseUrl);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
})();

export const runtimeConfiguration: RuntimeConfiguration = Object.freeze({
  release: '11.0.0-alpha.1',
  environment: String(import.meta.env.VITE_APP_ENV ?? 'preview'),
  supabaseConfigured: Boolean(urlIsValid && publishableKey),
  mode: urlIsValid && publishableKey ? 'cloud' : 'local-preview'
});

export const supabase: SupabaseClient | null = runtimeConfiguration.supabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
