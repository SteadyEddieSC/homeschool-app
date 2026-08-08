import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CloudAccount } from '../domain/membership';
import { isAppRole, type AppRole } from '../domain/roles';
import { supabase } from './supabase';

export interface CloudIdentity {
  userId: string;
  email: string;
  label: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
}

interface MembershipRow {
  organization_id: string;
  role: string;
  organizations: { name?: string } | { name?: string }[] | null;
}

interface ProfileRow {
  display_name?: string;
}

export interface CloudIdentityState {
  loading: boolean;
  session: Session | null;
  account: CloudAccount | null;
  identity: CloudIdentity | null;
  recoveryMode: boolean;
  error: string;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<{ confirmationRequired: boolean }>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  refreshIdentity(): Promise<void>;
  signOut(): Promise<void>;
}

function organizationName(value: MembershipRow['organizations']): string {
  if (Array.isArray(value)) return value[0]?.name ?? 'Homeschool Group';
  return value?.name ?? 'Homeschool Group';
}

export function useCloudIdentity(): CloudIdentityState {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CloudAccount | null>(null);
  const [identity, setIdentity] = useState<CloudIdentity | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState('');

  const resolveIdentity = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAccount(null);
    setIdentity(null);
    setError('');
    if (!supabase || !nextSession?.user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const user = nextSession.user;
    const [membershipResult, profileResult] = await Promise.all([
      supabase
        .from('organization_memberships')
        .select('organization_id, role, organizations(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    ]);

    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setLoading(false);
      return;
    }

    const profile = profileResult.data as ProfileRow | null;
    const label = profile?.display_name?.trim()
      || String(user.user_metadata?.display_name ?? '').trim()
      || user.email?.split('@')[0]
      || 'Member';
    const nextAccount: CloudAccount = {
      id: user.id,
      email: user.email ?? '',
      label
    };
    setAccount(nextAccount);

    const membership = membershipResult.data as MembershipRow | null;
    if (membership && isAppRole(membership.role)) {
      setIdentity({
        userId: user.id,
        email: user.email ?? '',
        label,
        role: membership.role,
        organizationId: membership.organization_id,
        organizationName: organizationName(membership.organizations)
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    void supabase.auth.getSession().then(({ data }) => resolveIdentity(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
      window.setTimeout(() => void resolveIdentity(nextSession), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [resolveIdentity]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured in local preview mode.');
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) {
      setLoading(false);
      throw result.error;
    }
    await resolveIdentity(result.data.session);
  }, [resolveIdentity]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error('Supabase is not configured in local preview mode.');
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error('Display name is required.');
    const result = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: normalizedName },
        emailRedirectTo: window.location.origin
      }
    });
    if (result.error) throw result.error;
    if (result.data.session) await resolveIdentity(result.data.session);
    return { confirmationRequired: !result.data.session };
  }, [resolveIdentity]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured in local preview mode.');
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    });
    if (result.error) throw result.error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('Supabase is not configured in local preview mode.');
    const result = await supabase.auth.updateUser({ password });
    if (result.error) throw result.error;
    setRecoveryMode(false);
  }, []);

  const refreshIdentity = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.auth.getSession();
    if (result.error) throw result.error;
    await resolveIdentity(result.data.session);
  }, [resolveIdentity]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.auth.signOut();
    if (result.error) throw result.error;
    setRecoveryMode(false);
    await resolveIdentity(null);
  }, [resolveIdentity]);

  return {
    loading,
    session,
    account,
    identity,
    recoveryMode,
    error,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    refreshIdentity,
    signOut
  };
}
