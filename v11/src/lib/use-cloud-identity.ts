import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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
  identity: CloudIdentity | null;
  error: string;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

function organizationName(value: MembershipRow['organizations']): string {
  if (Array.isArray(value)) return value[0]?.name ?? 'Homeschool Group';
  return value?.name ?? 'Homeschool Group';
}

export function useCloudIdentity(): CloudIdentityState {
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<CloudIdentity | null>(null);
  const [error, setError] = useState('');

  const resolveIdentity = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
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

    const membership = membershipResult.data as MembershipRow | null;
    const profile = profileResult.data as ProfileRow | null;
    if (!membership || !isAppRole(membership.role)) {
      setError('This account does not have an active Beaufort Learning Harbor group membership.');
      setLoading(false);
      return;
    }

    setIdentity({
      userId: user.id,
      email: user.email ?? '',
      label: profile?.display_name?.trim() || user.email?.split('@')[0] || 'Member',
      role: membership.role,
      organizationId: membership.organization_id,
      organizationName: organizationName(membership.organizations)
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    void supabase.auth.getSession().then(({ data }) => resolveIdentity(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveIdentity(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [resolveIdentity]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured in local preview mode.');
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) throw result.error;
    await resolveIdentity(result.data.session);
  }, [resolveIdentity]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.auth.signOut();
    if (result.error) throw result.error;
    await resolveIdentity(null);
  }, [resolveIdentity]);

  return { loading, session, identity, error, signIn, signOut };
}
