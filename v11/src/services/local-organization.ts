import {
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

interface LocalOrganizationState {
  organization: OrganizationSummary;
  members: OrganizationMember[];
  invitations: CreatedInvitation[];
}

const STORAGE_KEY = 'beaufortLearningHarbor.v11.alpha2.organization';

function now(): string {
  return new Date().toISOString();
}

function defaultState(): LocalOrganizationState {
  return {
    organization: {
      id: 'preview-organization',
      name: 'Beaufort Learning Harbor Preview',
      slug: 'beaufort-learning-harbor-preview'
    },
    members: [
      { userId: 'preview-student', displayName: 'Preview Student', role: 'student', status: 'active', joinedAt: now() },
      { userId: 'preview-parent', displayName: 'Preview Parent / Guardian', role: 'parent', status: 'active', joinedAt: now() },
      { userId: 'preview-teacher', displayName: 'Preview Teacher / Facilitator', role: 'teacher', status: 'active', joinedAt: now() },
      { userId: 'preview-director', displayName: 'Preview Director', role: 'director', status: 'active', joinedAt: now() },
      { userId: 'preview-group-admin', displayName: 'Preview Group Administrator', role: 'group-admin', status: 'active', joinedAt: now() },
      { userId: 'preview-system-admin', displayName: 'Preview System Administrator', role: 'system-admin', status: 'active', joinedAt: now() }
    ],
    invitations: []
  };
}

function loadState(): LocalOrganizationState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as LocalOrganizationState | null;
    if (parsed?.organization?.id && Array.isArray(parsed.members) && Array.isArray(parsed.invitations)) return parsed;
  } catch {
    // A damaged preview record is replaced with deterministic synthetic state.
  }
  const state = defaultState();
  saveState(state);
  return state;
}

function saveState(state: LocalOrganizationState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function inviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export class LocalOrganizationRepository implements OrganizationRepository {
  async createOrganization(account: CloudAccount, name: string, slug: string): Promise<OrganizationSummary> {
    const state: LocalOrganizationState = {
      organization: {
        id: crypto.randomUUID(),
        name: normalizeOrganizationName(name),
        slug: normalizeOrganizationSlug(slug)
      },
      members: [{
        userId: account.id,
        displayName: account.label,
        role: 'group-admin',
        status: 'active',
        joinedAt: now()
      }],
      invitations: []
    };
    saveState(state);
    return state.organization;
  }

  async redeemInvitation(account: CloudAccount, token: string): Promise<OrganizationSummary> {
    const state = loadState();
    const invitation = state.invitations.find((item) => item.token === token.trim());
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= now()) {
      throw new Error('Invitation is invalid, expired, revoked, or already used.');
    }
    invitation.acceptedAt = now();
    state.members.push({
      userId: account.id,
      displayName: account.label,
      role: invitation.role,
      status: 'active',
      joinedAt: now()
    });
    saveState(state);
    return state.organization;
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const state = loadState();
    if (state.organization.id !== organizationId) return [];
    return structuredClone(state.members);
  }

  async listInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    const state = loadState();
    if (state.organization.id !== organizationId) return [];
    return state.invitations.map(({ token: _token, ...invitation }) => structuredClone(invitation));
  }

  async createInvitation(organizationId: string, role: InvitableRole, expiresInHours: number): Promise<CreatedInvitation> {
    const state = loadState();
    if (state.organization.id !== organizationId) throw new Error('Organization not found.');
    const createdAt = now();
    const invitation: CreatedInvitation = {
      id: crypto.randomUUID(),
      organizationId,
      role,
      invitedBy: 'preview-group-admin',
      expiresAt: new Date(Date.now() + Math.min(720, Math.max(1, expiresInHours)) * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      createdAt,
      token: inviteToken()
    };
    state.invitations.unshift(invitation);
    saveState(state);
    return structuredClone(invitation);
  }

  async revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
    const state = loadState();
    if (state.organization.id !== organizationId) throw new Error('Organization not found.');
    const invitation = state.invitations.find((item) => item.id === invitationId);
    if (!invitation) throw new Error('Invitation not found.');
    if (!invitation.acceptedAt) invitation.revokedAt = now();
    saveState(state);
  }
}
