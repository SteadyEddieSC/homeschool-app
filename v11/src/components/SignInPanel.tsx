import { useState, type FormEvent } from 'react';

type AccessMode = 'sign-in' | 'sign-up' | 'reset';

interface SignInPanelProps {
  busy: boolean;
  error: string;
  onSignIn(email: string, password: string): Promise<void>;
  onSignUp(email: string, password: string, displayName: string): Promise<{ confirmationRequired: boolean }>;
  onRequestPasswordReset(email: string): Promise<void>;
}

export function SignInPanel({ busy, error, onSignIn, onSignUp, onRequestPasswordReset }: SignInPanelProps) {
  const [mode, setMode] = useState<AccessMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    setNotice('');
    try {
      if (mode === 'sign-in') {
        await onSignIn(email, password);
      } else if (mode === 'sign-up') {
        if (password.length < 12) throw new Error('Use at least 12 characters for the password.');
        const result = await onSignUp(email, password, displayName);
        setNotice(result.confirmationRequired
          ? 'Account created. Check your email to confirm the address before signing in.'
          : 'Account created and signed in.');
      } else {
        await onRequestPasswordReset(email);
        setNotice('If an account matches that address, a password recovery email has been sent.');
      }
    } catch (accessError) {
      setLocalError(accessError instanceof Error ? accessError.message : 'Unable to complete the account request.');
    }
  }

  function switchMode(nextMode: AccessMode) {
    setMode(nextMode);
    setLocalError('');
    setNotice('');
    setPassword('');
  }

  return (
    <main className="signin-shell">
      <section className="signin-card" data-testid="account-access-panel">
        <div className="brand-lockup centered">
          <span className="brand-mark" aria-hidden="true">BLH</span>
          <div>
            <span className="eyebrow">Beaufort Learning Harbor</span>
            <h1>{mode === 'sign-in' ? 'Sign in to your group' : mode === 'sign-up' ? 'Create your account' : 'Recover your account'}</h1>
          </div>
        </div>
        <p className="signin-intro">
          Accounts, memberships, household relationships, and permissions are validated before shared records load.
        </p>

        <div className="segmented-control" role="tablist" aria-label="Account access choice">
          <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'active' : ''} onClick={() => switchMode('sign-in')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'active' : ''} onClick={() => switchMode('sign-up')}>Create account</button>
          <button type="button" role="tab" aria-selected={mode === 'reset'} className={mode === 'reset' ? 'active' : ''} onClick={() => switchMode('reset')}>Reset password</button>
        </div>

        {(error || localError) && <div className="message error" role="alert">{localError || error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <form className="form-stack" onSubmit={submit}>
          {mode === 'sign-up' && (
            <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={120} autoComplete="name" /></label>
          )}
          <label>
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {mode !== 'reset' && (
            <label>
              <span>Password</span>
              <input type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'sign-up' ? 12 : undefined} />
            </label>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send recovery email'}
          </button>
        </form>

        <div className="privacy-callout">
          <strong>Identity bootstrap alpha</strong>
          <span>New accounts create or join an organization after email confirmation. Invitations cannot grant System Administrator access.</span>
        </div>
      </section>
    </main>
  );
}
