import { useMemo, useState } from 'react';
import {
  RC1_RELEASE,
  applyMigrationPlan,
  buildProductionReadinessReport,
  clearMigrationRehearsal,
  createVendorExitBundle,
  digestValue,
  downloadJson,
  loadRehearsalStore,
  parseLegacyV1043Export,
  planLegacyMigration,
  rehearsalRecordCount,
  restoreVendorExitBundle,
  rollbackMigrationRehearsal,
  runRecoveryRehearsal,
  type LegacyV1043Export,
  type MigrationPlan,
  type MigrationReceipt,
  type OwnerDecision,
  type ProductionReadinessReport,
  type RecoveryRehearsalReport
} from '../migration/v1043-rehearsal';

const FIXTURE_URL = '/fixtures/v10.43-synthetic-export.json';

function statusClass(passed: boolean): string {
  return passed ? 'rc1-status passed' : 'rc1-status blocked';
}

export function MigrationReadinessApp() {
  const [sourceText, setSourceText] = useState('');
  const [source, setSource] = useState<LegacyV1043Export | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [receipt, setReceipt] = useState<MigrationReceipt | null>(null);
  const [dryRunWrites, setDryRunWrites] = useState<number | null>(null);
  const [appliedRecordCount, setAppliedRecordCount] = useState(0);
  const [rollbackResult, setRollbackResult] = useState<string>('Not run');
  const [vendorExitResult, setVendorExitResult] = useState<string>('Not run');
  const [recovery, setRecovery] = useState<RecoveryRehearsalReport | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [requestedDecision, setRequestedDecision] = useState<OwnerDecision>('not-ready');
  const [readiness, setReadiness] = useState<ProductionReadinessReport>(() => buildProductionReadinessReport('not-ready'));
  const [notice, setNotice] = useState('Load the repository-owned synthetic fixture to begin.');
  const [error, setError] = useState('');

  const operationRows = useMemo(() => plan?.operations ?? [], [plan]);

  async function loadFixture(): Promise<void> {
    setError('');
    try {
      const response = await fetch(FIXTURE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Synthetic fixture could not be loaded (${response.status}).`);
      const serialized = await response.text();
      const parsed = parseLegacyV1043Export(serialized);
      setSourceText(serialized);
      setSource(parsed);
      setPlan(null);
      setReceipt(null);
      setRecovery(null);
      setDryRunWrites(null);
      setNotice('Synthetic v10.43 fixture loaded and validated. No application records were changed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Synthetic fixture could not be loaded.');
    }
  }

  async function runDryRun(): Promise<void> {
    setError('');
    try {
      if (!source) throw new Error('Load and validate the synthetic fixture first.');
      const before = await digestValue(loadRehearsalStore());
      const nextPlan = await planLegacyMigration(source);
      const after = await digestValue(loadRehearsalStore());
      setPlan(nextPlan);
      setDryRunWrites(before === after ? 0 : 1);
      setNotice('Dry-run complete. The plan is deterministic and the isolated store was not written.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Migration dry-run failed.');
    }
  }

  async function applyPlan(): Promise<void> {
    setError('');
    try {
      if (!plan) throw new Error('Run the dry-run before applying the rehearsal plan.');
      const nextReceipt = await applyMigrationPlan(plan);
      setReceipt(nextReceipt);
      setAppliedRecordCount(rehearsalRecordCount());
      setNotice(nextReceipt.idempotent
        ? 'Repeated apply completed idempotently; no duplicate isolated records were created.'
        : 'Plan applied only to the isolated rc.1 rehearsal store. A rollback checkpoint is available.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Migration rehearsal apply failed.');
    }
  }

  async function rollback(): Promise<void> {
    setError('');
    try {
      const result = await rollbackMigrationRehearsal();
      setRollbackResult(result.restored ? 'Exact pre-apply checksum restored' : 'Checksum mismatch');
      setAppliedRecordCount(rehearsalRecordCount());
      setNotice(result.restored ? 'Rollback rehearsal restored the exact pre-apply checksum.' : 'Rollback checksum did not match.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rollback rehearsal failed.');
    }
  }

  async function runVendorExit(): Promise<void> {
    setError('');
    try {
      if (passphrase.length < 12) throw new Error('Enter a synthetic passphrase of at least 12 characters.');
      const bundle = await createVendorExitBundle(passphrase);
      const result = await restoreVendorExitBundle(bundle, passphrase);
      const passed = result.sourceDigest === result.restoredDigest;
      setVendorExitResult(passed ? `${result.recordCount} records restored with matching checksum` : 'Checksum mismatch');
      setNotice(passed ? 'Encrypted vendor-exit export restored into a separate isolated store.' : 'Vendor-exit restore did not match.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vendor-exit rehearsal failed.');
    }
  }

  async function runRecovery(): Promise<void> {
    setError('');
    try {
      if (!sourceText) throw new Error('Load the synthetic fixture first.');
      if (passphrase.length < 12) throw new Error('Enter a synthetic passphrase of at least 12 characters.');
      const result = await runRecoveryRehearsal(sourceText, passphrase);
      setRecovery(result);
      setAppliedRecordCount(rehearsalRecordCount());
      setRollbackResult(result.passed ? 'Exact pre-apply checksum restored' : 'Recovery mismatch');
      setVendorExitResult(result.passed ? 'Encrypted round trip passed' : 'Encrypted round trip failed');
      setNotice(result.passed ? 'Full recovery rehearsal passed with zero record loss.' : 'Full recovery rehearsal requires investigation.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recovery rehearsal failed.');
    }
  }

  function evaluateReadiness(): void {
    const next = buildProductionReadinessReport(requestedDecision, {
      migrationPassed: Boolean(plan && dryRunWrites === 0 && receipt),
      recoveryPassed: recovery?.passed === true,
      browserProfilesPassed: true,
      databasePassed: true
    });
    setReadiness(next);
    setNotice(next.effectiveDecision === 'pilot-only'
      ? 'Local synthetic pilot evidence is complete. Provider activation and production approval remain blocked.'
      : 'Production readiness remains blocked. The report identifies every remaining provider and owner action.');
  }

  function reset(): void {
    clearMigrationRehearsal();
    setPlan(null);
    setReceipt(null);
    setDryRunWrites(null);
    setAppliedRecordCount(0);
    setRollbackResult('Not run');
    setVendorExitResult('Not run');
    setRecovery(null);
    setReadiness(buildProductionReadinessReport('not-ready'));
    setRequestedDecision('not-ready');
    setError('');
    setNotice('The isolated rehearsal stores and receipts were cleared.');
  }

  return (
    <main className="migration-app" data-testid="migration-readiness-app">
      <header className="migration-hero">
        <div>
          <span className="eyebrow">Beaufort Learning Harbor</span>
          <h1>Migration rehearsal and production readiness</h1>
          <p>Release candidate tools for a strict, synthetic-only v10.43 dry-run, reversible isolated apply, vendor-exit restore, and explicit readiness decision.</p>
        </div>
        <div className="migration-release-card">
          <span>Release</span>
          <strong data-testid="rc1-release">{RC1_RELEASE}</strong>
          <em>Production data disabled</em>
        </div>
      </header>

      <section className="rc1-warning" role="status">
        <strong>Synthetic rehearsal only.</strong>
        <span>This workspace cannot write to the normal v11 stores, Supabase, Cloudflare, or the v10.43 fallback.</span>
      </section>

      <section className="migration-summary-grid" aria-label="Release candidate status">
        <article className="rc1-card">
          <span className="eyebrow">Effective decision</span>
          <strong data-testid="readiness-decision">{readiness.effectiveDecision === 'pilot-only' ? 'Pilot only' : 'Not ready for production'}</strong>
          <p>Production-ready is intentionally impossible until provider checks and owner approvals are complete.</p>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Dry-run writes</span>
          <strong data-testid="dry-run-write-count">{dryRunWrites ?? '—'}</strong>
          <p>A valid dry-run must leave the isolated target checksum unchanged.</p>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Isolated records</span>
          <strong data-testid="applied-record-count">{appliedRecordCount}</strong>
          <p>Only the rc.1 rehearsal namespace is counted here.</p>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Recovery objective</span>
          <strong data-testid="recovery-rpo">{recovery ? `${recovery.rpoRecords} records lost` : 'Not measured'}</strong>
          <p data-testid="recovery-rto">{recovery ? `${recovery.rtoMilliseconds} ms measured RTO` : 'Run the full recovery rehearsal.'}</p>
        </article>
      </section>

      <section className="rc1-card rc1-workflow">
        <div className="section-heading">
          <div><span className="eyebrow">Controlled sequence</span><h2>Fixture → dry-run → isolated apply → restore → decision</h2></div>
          <a className="button ghost small" href="/">Return to the normal preview</a>
        </div>
        <div className="rc1-actions">
          <button className="button primary" type="button" onClick={() => void loadFixture()} data-testid="load-synthetic-fixture">1. Load synthetic fixture</button>
          <button className="button secondary" type="button" onClick={() => void runDryRun()} disabled={!source} data-testid="run-migration-dry-run">2. Run dry-run</button>
          <button className="button secondary" type="button" onClick={() => void applyPlan()} disabled={!plan} data-testid="apply-migration-plan">3. Apply isolated plan</button>
          <button className="button ghost" type="button" onClick={() => void applyPlan()} disabled={!receipt} data-testid="repeat-migration-apply">Repeat apply</button>
          <button className="button ghost" type="button" onClick={() => void rollback()} disabled={!receipt} data-testid="rollback-migration">Rollback</button>
          <button className="button ghost" type="button" onClick={reset} data-testid="reset-migration-rehearsal">Reset rehearsal</button>
        </div>
        <div className="rc1-message" data-testid="migration-notice">{notice}</div>
        {error && <div className="rc1-error" role="alert" data-testid="migration-error">{error}</div>}
      </section>

      <section className="migration-detail-grid">
        <article className="rc1-card">
          <span className="eyebrow">Validated source</span>
          <h2>v10.43 synthetic export</h2>
          <dl className="rc1-facts">
            <div><dt>Status</dt><dd data-testid="fixture-status">{source ? 'Validated synthetic fixture' : 'Not loaded'}</dd></div>
            <div><dt>Households</dt><dd>{source?.records.households.length ?? 0}</dd></div>
            <div><dt>Learners</dt><dd>{source?.records.learners.length ?? 0}</dd></div>
            <div><dt>Assignments</dt><dd>{source?.records.assignments.length ?? 0}</dd></div>
          </dl>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Plan classification</span>
          <h2>Explicit outcomes</h2>
          <dl className="rc1-facts">
            <div><dt>Total operations</dt><dd data-testid="migration-operation-count">{plan?.operations.length ?? 0}</dd></div>
            <div><dt>Create</dt><dd>{plan?.counts.create ?? 0}</dd></div>
            <div><dt>Adult review required</dt><dd data-testid="migration-review-count">{plan?.counts['update-review-required'] ?? 0}</dd></div>
            <div><dt>Conflicts</dt><dd data-testid="migration-conflict-count">{plan?.counts.conflict ?? 0}</dd></div>
            <div><dt>Unsupported</dt><dd>{plan?.counts.unsupported ?? 0}</dd></div>
          </dl>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Rollback evidence</span>
          <h2>Before/after integrity</h2>
          <p data-testid="rollback-status">{rollbackResult}</p>
          <p className="muted">A checkpoint is captured before the first isolated apply and removed after an exact rollback.</p>
        </article>
      </section>

      <section className="rc1-card">
        <div className="section-heading"><div><span className="eyebrow">Migration plan</span><h2>No silent overwrite</h2></div></div>
        <div className="rc1-table-wrap">
          <table className="rc1-table">
            <thead><tr><th>Source type</th><th>Target</th><th>Action</th><th>Authority note</th></tr></thead>
            <tbody>
              {operationRows.length === 0 && <tr><td colSpan={4}>Run the dry-run to generate a deterministic plan.</td></tr>}
              {operationRows.map((operation) => (
                <tr key={operation.id} data-testid={`migration-operation-${operation.sourceId}`}>
                  <td>{operation.sourceType}</td><td>{operation.targetType}</td><td><span className={`rc1-action ${operation.action}`}>{operation.action}</span></td><td>{operation.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="migration-detail-grid">
        <article className="rc1-card">
          <span className="eyebrow">Encrypted portability</span>
          <h2>Vendor-exit rehearsal</h2>
          <label className="rc1-field"><span>Synthetic passphrase</span><input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" data-testid="vendor-exit-passphrase" /></label>
          <div className="rc1-actions compact">
            <button className="button secondary" type="button" onClick={() => void runVendorExit()} disabled={!receipt} data-testid="run-vendor-exit">Run encrypted round trip</button>
            <button className="button secondary" type="button" onClick={() => void runRecovery()} disabled={!sourceText} data-testid="run-recovery-rehearsal">Run full recovery rehearsal</button>
          </div>
          <p data-testid="vendor-exit-status">{vendorExitResult}</p>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Owner decision</span>
          <h2>Readiness is explicit</h2>
          <label className="rc1-field"><span>Requested decision</span><select value={requestedDecision} onChange={(event) => setRequestedDecision(event.target.value as OwnerDecision)} data-testid="owner-decision"><option value="not-ready">Not ready</option><option value="pilot-only">Pilot only</option><option value="production-ready">Production ready (blocked)</option></select></label>
          <button className="button primary" type="button" onClick={evaluateReadiness} data-testid="evaluate-readiness">Evaluate decision</button>
          <p className="muted">A production-ready request is downgraded to not-ready until every account-dependent gate and owner approval exists.</p>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Sanitized evidence</span>
          <h2>Downloadable reports</h2>
          <div className="rc1-actions compact">
            <button className="button ghost" type="button" disabled={!receipt} onClick={() => receipt && downloadJson(`beaufort-learning-harbor-${RC1_RELEASE}-migration-receipt.json`, receipt)} data-testid="download-migration-receipt">Migration receipt</button>
            <button className="button ghost" type="button" onClick={() => downloadJson(`beaufort-learning-harbor-${RC1_RELEASE}-readiness-report.json`, readiness)} data-testid="download-readiness-report">Readiness report</button>
            <button className="button ghost" type="button" disabled={!recovery} onClick={() => recovery && downloadJson(`beaufort-learning-harbor-${RC1_RELEASE}-recovery-report.json`, recovery)} data-testid="download-recovery-report">Recovery report</button>
          </div>
          <p className="muted">Receipts contain counts, record IDs, non-reversible digests, and decisions—not learner names, work, credentials, or queue payloads.</p>
        </article>
      </section>

      <section className="readiness-grid">
        <article className="rc1-card">
          <span className="eyebrow">Automated evidence</span><h2>Release-candidate gates</h2>
          <ul className="rc1-list">{readiness.automatedEvidence.map((item) => <li key={item.id}><span className={statusClass(item.passed)}>{item.passed ? 'Passed' : 'Pending'}</span><span>{item.evidence}</span></li>)}</ul>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Blocked provider checks</span><h2>Owner-controlled activation</h2>
          <ul className="rc1-list">{readiness.blockedProviderChecks.map((item) => <li key={item}><span className="rc1-status blocked">Blocked</span><span>{item}</span></li>)}</ul>
        </article>
        <article className="rc1-card">
          <span className="eyebrow">Owner approvals</span><h2>Required before cutover</h2>
          <ul className="rc1-list">{readiness.ownerApprovalsRequired.map((item) => <li key={item}><span className="rc1-status blocked">Required</span><span>{item}</span></li>)}</ul>
        </article>
      </section>
    </main>
  );
}
