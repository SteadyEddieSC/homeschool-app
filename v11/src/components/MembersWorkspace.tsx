import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  INVITABLE_ROLES,
  roleLabel,
  type CreatedInvitation,
  type InvitableRole,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationRepository
} from '../domain/membership';

interface MembersWorkspaceProps {
  organizationId: string;
  organizationName: string;
  repository: OrganizationRepository;
}

function invitationState(invitation: OrganizationInvitation): string {
  if (invitation.acceptedAt) return 'Accepted';
  if (invitation.revokedAt) return 'Revoked';
  if (invitation.expiresAt <= new Date().toISOString()) return 'Expired';
  return 'Active';
}

export function MembersWorkspace({ organizationId, organizationName, repository }: MembersWorkspaceProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [role, setRole] = useState<InvitableRole>('parent');
  const [expiresInHours, setExpiresInHours] = useState(168);
  const [createdInvitation, setCreatedInvitation] = useState<CreatedInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        repository.listMembers(organizationId),
        repository.listInvitations(organizationId)
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load membership records.');
    }
  }, [organizationId, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setCreatedInvitation(null);
    try {
      const invitation = await repository.createInvitation(organizationId, role, expiresInHours);
      setCreatedInvitation(invitation);
      setNotice('Invitation created. Copy the one-time code before leaving this page.');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await repository.revokeInvitation(organizationId, invitationId);
      setNotice('Invitation revoked.');
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    if (!createdInvitation) return;
    try {
      await navigator.clipboard.writeText(createdInvitation.token);
      setNotice('Invitation code copied.');
    } catch {
      setNotice('Select and copy the invitation code manually.');
    }
  }

  return (
    <div className="page-stack" data-testid="members-workspace">
      <section className="page-heading">
        <span className="eyebrow">Membership administration</span>
        <h1>Invite people without sharing administrator credentials.</h1>
        <p>
          {organizationName} uses one-time, expiring invitation codes. Codes can create ordinary group roles only; System Administrator access is never available through an invitation.
        </p>
      </section>

      {(error || notice) && <div className={error ? 'message error' : 'message success'} role="status">{error || notice}</div>}

      <section className="members-grid">
        <article className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">Active directory</span><h2>Members</h2></div>
            <span className="count-badge">{members.length}</span>
          </div>
          <div className="member-list" role="list" aria-label="Organization members">
            {members.map((member) => (
              <article className="member-row" role="listitem" key={member.userId}>
                <div className="member-avatar" aria-hidden="true">{member.displayName.slice(0, 2).toUpperCase()}</div>
                <div><strong>{member.displayName}</strong><span>{roleLabel(member.role)}</span></div>
                <span className={`status-chip ${member.status === 'active' ? 'resolved' : 'neutral'}`}>{member.status}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="panel invite-panel">
          <div className="section-heading">
            <div><span className="eyebrow">Controlled access</span><h2>Create invitation</h2></div>
            <span className="status-chip neutral">One-time code</span>
          </div>
          <form className="form-stack" onSubmit={createInvitation}>
            <label>
              <span>Role</span>
              <select value={role} onChange={(event) => setRole(event.target.value as InvitableRole)} data-testid="invite-role">
                {INVITABLE_ROLES.map((option) => <option key={option} value={option}>{roleLabel(option)}</option>)}
              </select>
            </label>
            <label>
              <span>Expires in</span>
              <select value={expiresInHours} onChange={(event) => setExpiresInHours(Number(event.target.value))}>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
                <option value={336}>14 days</option>
                <option value={720}>30 days</option>
              </select>
            </label>
            <button className="button primary" type="submit" disabled={busy} data-testid="create-invite">
              {busy ? 'Creating…' : 'Create invitation'}
            </button>
          </form>

          {createdInvitation && (
            <div className="one-time-secret" data-testid="one-time-invite">
              <span className="eyebrow">Shown once</span>
              <code>{createdInvitation.token}</code>
              <button className="button secondary" type="button" onClick={() => void copyInvitation()}>Copy code</button>
              <p>Do not post this code publicly. Send it directly to the intended member.</p>
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div><span className="eyebrow">Invitation ledger</span><h2>Recent invitations</h2></div>
          <span className="count-badge">{invitations.length}</span>
        </div>
        {invitations.length === 0 ? (
          <div className="empty-state"><strong>No invitations yet</strong><span>New invitations will appear here without exposing their one-time code.</span></div>
        ) : (
          <div className="invitation-table" role="table" aria-label="Organization invitations">
            <div className="invitation-header" role="row"><span>Role</span><span>Status</span><span>Expires</span><span>Action</span></div>
            {invitations.map((invitation) => {
              const state = invitationState(invitation);
              const active = state === 'Active';
              return (
                <div className="invitation-row" role="row" key={invitation.id}>
                  <strong>{roleLabel(invitation.role)}</strong>
                  <span>{state}</span>
                  <span>{new Date(invitation.expiresAt).toLocaleString()}</span>
                  <span>{active ? <button className="button ghost small" type="button" disabled={busy} onClick={() => void revokeInvitation(invitation.id)}>Revoke</button> : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
