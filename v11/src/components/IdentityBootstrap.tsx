import { useMemo, useState, type FormEvent } from 'react';
import {
  normalizeOrganizationSlug,
  type CloudAccount,
  type OrganizationRepository
} from '../domain/membership';

interface IdentityBootstrapProps {
  account: CloudAccount;
  repository: OrganizationRepository;
  onComplete(): Promise<void>;
  onSignOut(): Promise<void>;
}

type Mode = 'create' | 'join';

export function IdentityBootstrap({ account, repository, onComplete, onSignOut }: IdentityBootstrapProps) {
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const suggestedSlug = useMemo(() => {
    try {
      return normalizeOrganizationSlug(name || 'my-learning-group');
    } catch {
      return 'my-learning-group';
    }
  }, [name]);
  const [slug, setSlug] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'create') {
        await repository.createOrganization(account, name, slug || suggestedSlug);
      } else {
        await repository.redeemInvitation(account, inviteCode);
      }
      await onComplete();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to finish account setup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bootstrap-shell">
      <section className="bootstrap-card" data-testid="identity-bootstrap">
        <div className="bootstrap-heading">
          <span className="brand-mark" aria-hidden="true">BLH</span>
          <div>
            <span className="eyebrow">Account confirmed</span>
            <h1>Connect {account.label} to a learning group.</h1>
            <p>Accounts and group membership are separate. Choose the path that matches your role.</p>
          </div>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Organization setup choice">
          <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create a group</button>
          <button type="button" role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>Use invitation code</button>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}

        <form className="form-stack" onSubmit={submit}>
          {mode === 'create' ? (
            <>
              <div className="privacy-callout">
                <strong>First administrator</strong>
                <span>The account that creates the organization becomes its first Group Administrator. System Administrator access is not granted.</span>
              </div>
              <label>
                <span>Organization name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} placeholder="Beaufort Learning Harbor" data-testid="organization-name" />
              </label>
              <label>
                <span>Organization address</span>
                <input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={63} placeholder={suggestedSlug} data-testid="organization-slug" />
              </label>
              <button className="button primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create organization'}</button>
            </>
          ) : (
            <>
              <div className="privacy-callout">
                <strong>One-time invitation</strong>
                <span>The invitation decides your organization and role. A code cannot grant System Administrator access.</span>
              </div>
              <label>
                <span>Invitation code</span>
                <textarea value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required rows={3} maxLength={160} autoCapitalize="none" autoCorrect="off" data-testid="redeem-invite-code" />
              </label>
              <button className="button primary" type="submit" disabled={busy}>{busy ? 'Joining…' : 'Join organization'}</button>
            </>
          )}
        </form>

        <button className="button ghost" type="button" onClick={() => void onSignOut()}>Use a different account</button>
      </section>
    </main>
  );
}
