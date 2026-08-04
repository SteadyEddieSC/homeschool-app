import { useEffect, useState } from 'react';
import type { HostedPilotOperationalSnapshot } from '../domain/pilot';
import type { SyncQueueSnapshot } from '../domain/sync';
import { runtimeConfiguration } from '../lib/supabase';
import { StudioConflictStore } from '../services/studio-conflicts';

interface HostedPilotWorkspaceProps {
  organizationId: string;
  identityActive: boolean;
  syncSnapshot: SyncQueueSnapshot;
  conflictStore: StudioConflictStore;
}

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not yet';
}

export function HostedPilotWorkspace({
  organizationId,
  identityActive,
  syncSnapshot,
  conflictStore
}: HostedPilotWorkspaceProps) {
  const [snapshot, setSnapshot] = useState<HostedPilotOperationalSnapshot>(() => conflictStore.getSnapshot(organizationId));

  useEffect(() => {
    conflictStore.setActiveOrganization(organizationId);
    setSnapshot(conflictStore.getSnapshot(organizationId));
    return conflictStore.subscribe(setSnapshot);
  }, [conflictStore, organizationId]);

  function downloadDiagnostics(): void {
    const report = {
      schema: 'beaufort-learning-harbor-hosted-pilot-diagnostics-v1',
      release: runtimeConfiguration.release,
      createdAt: new Date().toISOString(),
      environment: runtimeConfiguration.environment,
      provider: {
        mode: runtimeConfiguration.mode,
        configured: runtimeConfiguration.supabaseConfigured,
        host: runtimeConfiguration.supabaseHost || null,
        identityActive
      },
      queue: {
        mode: syncSnapshot.mode,
        online: syncSnapshot.online,
        processing: syncSnapshot.processing,
        pendingCount: syncSnapshot.pendingCount,
        failedCount: syncSnapshot.failedCount,
        completedCount: syncSnapshot.completedCount,
        lastSuccessfulSyncAt: syncSnapshot.lastSuccessfulSyncAt,
        operations: syncSnapshot.operations.map((operation) => ({
          id: operation.id,
          kind: operation.kind,
          status: operation.status,
          attempts: operation.attempts,
          createdAt: operation.createdAt,
          updatedAt: operation.updatedAt,
          completedAt: operation.completedAt,
          hasError: operation.lastError.length > 0
        }))
      },
      reconciliation: {
        openConflictCount: snapshot.openConflictCount,
        lastRemoteRefreshAt: snapshot.lastRemoteRefreshAt,
        hasRemoteRefreshError: snapshot.lastRemoteRefreshError.length > 0,
        conflicts: snapshot.conflicts.map((conflict) => ({
          id: conflict.id,
          entityType: conflict.entityType,
          recordId: conflict.recordId,
          summary: conflict.summary,
          localDigest: conflict.localDigest,
          remoteDigest: conflict.remoteDigest,
          detectedAt: conflict.detectedAt,
          status: conflict.status
        }))
      },
      exclusions: [
        'record content and learner work',
        'passwords and sessions',
        'browser keys and provider credentials',
        'OAuth and BAND tokens',
        'queue payloads',
        'raw synchronization error text'
      ]
    };
    const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `beaufort-learning-harbor-${runtimeConfiguration.release}-pilot-diagnostics.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const providerReady = runtimeConfiguration.supabaseConfigured && identityActive;
  const queueHealthy = syncSnapshot.failedCount === 0;
  const reconciliationHealthy = snapshot.openConflictCount === 0 && !snapshot.lastRemoteRefreshError;

  return (
    <section className="panel hosted-pilot-panel" data-testid="hosted-pilot-workspace">
      <div className="section-heading">
        <div><span className="eyebrow">Hosted pilot operations</span><h2>Readiness, reconciliation, and safe diagnostics</h2></div>
        <span className={`status-chip ${providerReady && queueHealthy && reconciliationHealthy ? 'resolved' : 'neutral'}`} data-testid="pilot-overall-status">
          {providerReady && queueHealthy && reconciliationHealthy ? 'Pilot ready' : runtimeConfiguration.supabaseConfigured ? 'Needs attention' : 'Activation deferred'}
        </span>
      </div>
      <p className="muted">This panel never exposes provider secrets or learner record contents. It reports only configuration state, queue metadata, and non-reversible reconciliation digests.</p>

      <div className="pilot-metric-grid">
        <article className="metric-card"><span>Hosted provider</span><strong data-testid="pilot-provider-status">{runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Not configured'}</strong><p>{runtimeConfiguration.supabaseHost || 'No hosted project has been activated.'}</p></article>
        <article className="metric-card"><span>Authenticated identity</span><strong>{identityActive ? 'Active' : 'Not active'}</strong><p>Cloud-bound processing remains disabled while signed out.</p></article>
        <article className="metric-card"><span>Open conflicts</span><strong data-testid="pilot-conflict-count">{snapshot.openConflictCount}</strong><p>Divergent local and hosted records are never silently overwritten.</p></article>
        <article className="metric-card"><span>Last hosted refresh</span><strong>{formatTime(snapshot.lastRemoteRefreshAt)}</strong><p>{snapshot.lastRemoteRefreshError || 'No remote refresh error is recorded.'}</p></article>
      </div>

      <div className="button-row">
        <button className="button secondary" type="button" onClick={downloadDiagnostics} data-testid="download-pilot-diagnostics">Download sanitized diagnostics</button>
      </div>

      <div className="pilot-conflict-list" data-testid="pilot-conflict-list">
        {snapshot.conflicts.length === 0 ? <p className="empty-state">No hosted/local studio conflict is recorded.</p> : snapshot.conflicts.map((conflict) => (
          <article className="pilot-conflict" key={conflict.id} data-testid={`pilot-conflict-${conflict.id}`}>
            <div><strong>{conflict.summary}</strong><span>{conflict.entityType} · detected {new Date(conflict.detectedAt).toLocaleString()}</span></div>
            <code>local {conflict.localDigest} / hosted {conflict.remoteDigest}</code>
            <span className={`status-chip ${conflict.status === 'acknowledged' ? 'neutral' : 'failed'}`}>{conflict.status}</span>
            {conflict.status === 'open' && <button className="button ghost small" type="button" onClick={() => conflictStore.acknowledge(conflict.id)} data-testid={`acknowledge-conflict-${conflict.id}`}>Acknowledge</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
