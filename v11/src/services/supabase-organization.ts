import type { SupabaseClient } from '@supabase/supabase-js';
import { isAppRole } from '../domain/roles';
import {
  isInvitableRole,
  normalizeOrganizationName,
  normalizeOrganizationSlug,
  type CloudAccount,
  type CreatedInvitation,
  type InvitableRole,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationRepository,
  type OrganizationSummary
} from '../domain/membership';

interface MembershipRow {
  user_id: string;
  role: string;
  status: OrganizationMember['status'];
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
}

interface InvitationRow {
  id: string;
  organization_id: string;
  role: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface OrganizationRpcRow {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
}

interface CreatedInviteRpcRow extends InvitationRow {
  invite_token: string;
}

function organizationFromRow(row: OrganizationRpcRow): OrganizationSummary {
  return {
    id: row.organization_id,
    name: row.organization_name,
    slug: row.organization_slug
  };
}

function invitationFromRow(row: InvitationRow): OrganizationInvitation {
  if (!isInvitableRole(row.role)) throw new Error('Invitation contains an unsupported role.');
  return {
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at
  };
}

export class SupabaseOrganizationRepository implements OrganizationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createOrganization(_account: CloudAccount, name: string, slug: string): Promise<OrganizationSummary> {
    const result = await this.client.rpc('bootstrap_organization', {
      organization_name: normalizeOrganizationName(name),
      organization_slug: normalizeOrganizationSlug(slug)
    });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error('Organization bootstrap did not return a result.');
    return organizationFromRow(row as OrganizationRpcRow);
  }

  async redeemInvitation(_account: CloudAccount, token: string): Promise<OrganizationSummary> {
    const normalized = token.trim();
    if (normalized.length < 32 || normalized.length > 160) throw new Error('Enter a valid invitation code.');
    const result = await this.client.rpc('redeem_organization_invite', { invite_token: normalized });
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) throw new Error('Invitation redemption did not return an organization.');
    return organizationFromRow(row as OrganizationRpcRow);
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const membershipResult = await this.client
      .from('organization_memberships')
      .select('user_id, role, status, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });
    if (membershipResult.error) throw membershipResult.error;

    const rows = membershipResult.data as MembershipRow[];
    const userIds = rows.map((row) => row.user_id);
    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const profilesResult = await this.client.from('profiles').select('id, display_name').in('id', userIds);
      if (profilesResult.error) throw profilesResult.error;
      for (const profile of profilesResult.data as ProfileRow[]) profileMap.set(profile.id, profile.display_name);
    }

    return rows.map((row) => {
      if (!isAppRole(row.role)) throw new Error('Membership contains an unsupported role.');
      return {
        userId: row.user_id,
        displayName: profileMap.get(row.user_id) ?? 'Member',
        role: row.role,
        status: row.status,
        joinedAt: row.created_at
      };
    });
  }

  async listInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    const result = await this.client
      .from('organization_invites')
      .select('id, organization_id, role, invited_by, expires_at, accepted_at, revoked_at, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    return (result.data as InvitationRow[]).map(invitationFromRow);
  }

  async createInvitation(organizationId: string, role: InvitableRole, expiresInHours: number): Promise<CreatedInvitation> {
    const hours = Math.min(720, Math.max(1, Math.trunc(expiresInHours)));
    const result = await this.client.rpc('create_organization_invite', {
      target_organization: organizationId,
      target_role: role,
      expires_in_hours: hours
    });
    if (result.error) throw result.error;
    const row = (Array.isArray(result.data) ? result.data[0] : result.data) as CreatedInviteRpcRow | null;
    if (!row || !row.invite_token) throw new Error('Invitation creation did not return a one-time code.');
    return { ...invitationFromRow(row), token: row.invite_token };
  }

  async revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
    const result = await this.client.rpc('revoke_organization_invite', {
      target_organization: organizationId,
      target_invitation: invitationId
    });
    if (result.error) throw result.error;
  }
}
