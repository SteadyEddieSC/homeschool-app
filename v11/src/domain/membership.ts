import type { AppRole } from './roles';

export const INVITABLE_ROLES = ['student', 'parent', 'teacher', 'director', 'group-admin'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export interface CloudAccount {
  id: string;
  email: string;
  label: string;
}

export interface OrganizationMember {
  userId: string;
  displayName: string;
  role: AppRole;
  status: 'invited' | 'active' | 'suspended' | 'left';
  joinedAt: string;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  role: InvitableRole;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedInvitation extends OrganizationInvitation {
  token: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationRepository {
  createOrganization(account: CloudAccount, name: string, slug: string): Promise<OrganizationSummary>;
  redeemInvitation(account: CloudAccount, token: string): Promise<OrganizationSummary>;
  listMembers(organizationId: string): Promise<OrganizationMember[]>;
  listInvitations(organizationId: string): Promise<OrganizationInvitation[]>;
  createInvitation(organizationId: string, role: InvitableRole, expiresInHours: number): Promise<CreatedInvitation>;
  revokeInvitation(organizationId: string, invitationId: string): Promise<void>;
}

export function isInvitableRole(value: string): value is InvitableRole {
  return INVITABLE_ROLES.includes(value as InvitableRole);
}

export function normalizeOrganizationName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 160) {
    throw new Error('Organization name must be between 2 and 160 characters.');
  }
  return normalized;
}

export function normalizeOrganizationSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalized)) {
    throw new Error('Organization address must contain letters, numbers, or hyphens.');
  }
  return normalized;
}

export function roleLabel(role: AppRole): string {
  return role
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
