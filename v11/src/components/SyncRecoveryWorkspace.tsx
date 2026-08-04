import { useState, type ChangeEvent } from 'react';
import { operationKindLabel, syncStatusLabel, type SyncQueueSnapshot } from '../domain/sync';
import {
  applyBackupPreview,
  createEncryptedBackup,
  downloadBackup,
  inspectEncryptedBackup,
  type BackupPreview
} from '../services/local-backup-beta3';
import { SyncQueueManager } from '../services/sync-queue';

interface SyncRecoveryWorkspaceProps {
  manager: SyncQueueManager;
  snapshot: SyncQueueSnapshot;
  simulationEnabled: boolean;
  onSimulationChange(enabled: boolean): void;
  onRestoreApplied(): void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

function modeLabel(snapshot: SyncQueueSnapshot): string {
  if (!snapshot.online) return 'Offline';
  if (snapshot.mode === 'local-only') return 'Local only';
  if (snapshot.mode === 'cloud-simulation') return 'Cloud simulation';
  if (snapshot.mode === 'cloud-connected') return 'Cloud connected';
  return 'Cloud ready';
}

export function SyncRecoveryWorkspace({ manager, snapshot, simulationEnabled, onSimulationChange, onRestoreApplied }: SyncRecoveryWorkspaceProps) {
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreFileText, setRestoreFileText] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function exportBackup(): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const serialized = await createEncryptedBackup(exportPassphrase);
      downloadBackup(serialized);
      setMessage('Encrypted backup created. Keep the file and passphrase separately.');
      setExportPassphrase('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the backup.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseRestoreFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    setPreview(null);
    setConfirmRestore(false);
    setError('');
    setMessage('');
    if (!file) {
      setRestoreFileText('');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Backup file is larger than the 10 MB preview limit.');
      event.target.value = '';
      return;
    }
    setRestoreFileText(await file.text());
    setMessage(`${file.name} is ready for integrity and decryption checks.`);
  }

  async function inspectRestore(): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const nextPreview = await inspectEncryptedBackup(restoreFileText, restorePassphrase);
      setPreview(nextPreview);
      setConfirmRestore(false);
      setMessage('Backup verified. Review the counts before confirming restore.');
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : 'Unable to inspect the backup.');
    } finally {
      setBusy(false);
    }
  }

  function applyRestore(): void {
    if (!preview || !confirmRestore) return;
    applyBackupPreview(preview);
    setMessage('Restore applied. Reloading the local preview state.');
    onRestoreApplied();
  }

  return (
    <div className="page-stack" data-testid="sync-recovery-workspace">
      <section className="page-heading"><span className="eyebrow">Sync &amp; recovery</span><h1>See what is saved, what is waiting, and how to recover it.</h1><p>Beta 3 keeps knowledge checks, proof revisions, and weekly plans inside the same visible local queue and encrypted recovery boundary.</p></section>
      {message && <p className="message success" role="status">{message}</p>}
      {error && <p className="message error" role="alert">{error}</p>}

      <section className="sync-summary-grid" aria-label="Synchronization status">
        <article className="metric-card"><span>Current state</span><strong data-testid="sync-mode">{modeLabel(snapshot)}</strong><p>{snapshot.online ? 'The browser reports a network connection.' : 'Changes remain safely in the local mirror.'}</p></article>
        <article className="metric-card"><span>Pending</span><strong data-testid="sync-pending-count">{snapshot.pendingCount}</strong><p>Operations waiting for a remote acknowledgement.</p></article>
        <article className="metric-card"><span>Failed</span><strong data-testid="sync-failed-count">{snapshot.failedCount}</strong><p>Operations requiring an explicit retry or cancellation.</p></article>
        <article className="metric-card"><span>Last successful sync</span><strong>{formatTimestamp(snapshot.lastSuccessfulSyncAt)}</strong><p>Local-only saves do not pretend to be cloud synchronization.</p></article>
      </section>

      <section className="panel sync-controls">
        <div className="section-heading"><div><span className="eyebrow">Preview testing</span><h2>Cloud queue simulation</h2></div><span className={`status-chip ${simulationEnabled ? 'acknowledged' : 'neutral'}`}>{simulationEnabled ? 'Enabled' : 'Disabled'}</span></div>
        <p className="muted">Simulation acknowledges queued operations without sending data anywhere. It is intended for local testing and browser validation.</p>
        <label className="toggle-row"><input type="checkbox" checked={simulationEnabled} onChange={(event) => onSimulationChange(event.target.checked)} data-testid="sync-simulation-toggle" /><span>Enable local cloud simulation after reload</span></label>
        <div className="button-row"><button className="button primary" type="button" onClick={() => void manager.process()} disabled={!snapshot.online || snapshot.processing || snapshot.pendingCount + snapshot.failedCount === 0} data-testid="sync-retry-all">{snapshot.processing ? 'Synchronizing…' : 'Retry waiting operations'}</button><button className="button secondary" type="button" onClick={() => manager.clearCompleted()} disabled={snapshot.completedCount === 0}>Clear completed</button></div>
      </section>

      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Operation ledger</span><h2>Queued and completed actions</h2></div><span className="status-chip neutral">{snapshot.operations.length} retained</span></div>
        {snapshot.operations.length === 0 ? <p className="empty-state">No cloud-bound operations have been queued.</p> : <div className="sync-operation-list">{snapshot.operations.map((operation) => <article className="sync-operation" key={operation.id} data-testid={`sync-operation-${operation.id}`}><div><strong>{operationKindLabel(operation.kind)}</strong><span>{operation.id.slice(0, 8)} · {new Date(operation.createdAt).toLocaleString()}</span></div><span className={`status-chip status-${operation.status}`}>{syncStatusLabel(operation.status)}</span><p>Attempts: {operation.attempts}{operation.lastError ? ` · ${operation.lastError}` : ''}</p>{(operation.status === 'failed' || operation.status === 'pending') && <div className="button-row">{operation.status === 'failed' && <button className="button secondary small" type="button" onClick={() => manager.retry(operation.id)}>Retry</button>}<button className="button ghost small" type="button" onClick={() => manager.cancel(operation.id)} data-testid={`cancel-operation-${operation.id}`}>Cancel</button></div>}</article>)}</div>}
      </section>

      <section className="beta-grid two-column">
        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Portable backup</span><h2>Download encrypted backup</h2></div><span className="status-chip resolved">AES-256-GCM</span></div>
          <p>The backup includes application-owned local learning, check, proof, planning, support, and queue records. Sessions, credentials, deployment secrets, BAND tokens, and active invitation tokens are excluded.</p>
          <label className="field"><span>Backup passphrase</span><input type="password" autoComplete="new-password" value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} minLength={12} data-testid="backup-export-passphrase" /></label>
          <button className="button primary" type="button" disabled={busy || exportPassphrase.length < 12} onClick={() => void exportBackup()} data-testid="backup-export">Create encrypted backup</button>
        </article>

        <article className="panel beta-form-card">
          <div className="section-heading"><div><span className="eyebrow">Controlled restore</span><h2>Inspect before replacing data</h2></div><span className="status-chip neutral">No silent overwrite</span></div>
          <label className="field"><span>Encrypted backup file</span><input type="file" accept="application/json,.json" onChange={(event) => void chooseRestoreFile(event)} data-testid="backup-restore-file" /></label>
          <label className="field"><span>Backup passphrase</span><input type="password" autoComplete="current-password" value={restorePassphrase} onChange={(event) => setRestorePassphrase(event.target.value)} data-testid="backup-restore-passphrase" /></label>
          <button className="button secondary" type="button" disabled={busy || !restoreFileText || restorePassphrase.length < 12} onClick={() => void inspectRestore()} data-testid="backup-inspect">Verify and preview</button>
          {preview && <div className="restore-preview" data-testid="restore-preview"><strong>{preview.sourceRelease} backup from {new Date(preview.exportedAt).toLocaleString()}</strong><dl><div><dt>Households</dt><dd>{preview.counts.households}</dd></div><div><dt>Learners</dt><dd>{preview.counts.learners}</dd></div><div><dt>Today items</dt><dd>{preview.counts.todayItems}</dd></div><div><dt>Knowledge checks</dt><dd>{preview.counts.knowledgeChecks}</dd></div><div><dt>Check attempts</dt><dd>{preview.counts.knowledgeAttempts}</dd></div><div><dt>Proof revisions</dt><dd>{preview.counts.evidenceSubmissions}</dd></div><div><dt>Weekly plans</dt><dd>{preview.counts.weeklyPlans}</dd></div><div><dt>Plan items</dt><dd>{preview.counts.weeklyPlanItems}</dd></div><div><dt>Support tickets</dt><dd>{preview.counts.supportTickets}</dd></div><div><dt>Queued operations</dt><dd>{preview.counts.queuedOperations}</dd></div></dl><label className="toggle-row"><input type="checkbox" checked={confirmRestore} onChange={(event) => setConfirmRestore(event.target.checked)} data-testid="backup-confirm" /><span>I understand this replaces the current local preview records after making an emergency rollback snapshot.</span></label><button className="button primary" type="button" disabled={!confirmRestore} onClick={applyRestore} data-testid="backup-apply">Apply verified restore</button></div>}
        </article>
      </section>
    </div>
  );
}
