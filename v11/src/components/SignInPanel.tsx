import { useState, type FormEvent } from 'react';

interface SignInPanelProps {
  busy: boolean;
  error: string;
  onSignIn(email: string, password: string): Promise<void>;
}

export function SignInPanel({ busy, error, onSignIn }: SignInPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    try {
      await onSignIn(email, password);
    } catch (signInError) {
      setLocalError(signInError instanceof Error ? signInError.message : 'Unable to sign in.');
    }
  }

  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-lockup centered">
          <span className="brand-mark" aria-hidden="true">BLH</span>
          <div>
            <span className="eyebrow">Beaufort Learning Harbor</span>
            <h1>Sign in to your group</h1>
          </div>
        </div>
        <p className="signin-intro">
          Accounts, group memberships, household relationships, and permissions are validated before any shared records load.
        </p>
        {(error || localError) && <div className="message error" role="alert">{localError || error}</div>}
        <form className="form-stack" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="privacy-callout">
          <strong>Foundation alpha</strong>
          <span>Invitations, password recovery, MFA enrollment, and parent-managed student accounts are configured in later releases.</span>
        </div>
      </section>
    </main>
  );
}
