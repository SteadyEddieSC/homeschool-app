import { useState, type FormEvent } from 'react';

interface PasswordUpdatePanelProps {
  onUpdatePassword(password: string): Promise<void>;
  onSignOut(): Promise<void>;
}

export function PasswordUpdatePanel({ onUpdatePassword, onSignOut }: PasswordUpdatePanelProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Use at least 12 characters for the new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The password confirmation does not match.');
      return;
    }
    setBusy(true);
    try {
      await onUpdatePassword(password);
      setPassword('');
      setConfirmPassword('');
      setComplete(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin-shell">
      <section className="signin-card" data-testid="password-recovery-panel">
        <div className="brand-lockup centered">
          <span className="brand-mark" aria-hidden="true">BLH</span>
          <div><span className="eyebrow">Secure account recovery</span><h1>Choose a new password</h1></div>
        </div>
        {error && <div className="message error" role="alert">{error}</div>}
        {complete ? (
          <div className="form-stack">
            <div className="message success">Password updated. Sign in again with the new password.</div>
            <button className="button primary" type="button" onClick={() => void onSignOut()}>Return to sign in</button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <label><span>New password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} /></label>
            <label><span>Confirm new password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} /></label>
            <button className="button primary" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
