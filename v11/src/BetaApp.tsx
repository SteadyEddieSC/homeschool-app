import { useEffect, useState } from 'react';
import { HostedPilotWorkspace } from './components/HostedPilotWorkspace';
import { IdentityBootstrap } from './components/IdentityBootstrap';
import { LearnersWorkspace } from './components/LearnersWorkspace';
import { LearningStudioWorkspace } from './components/LearningStudioWorkspace';
import { MembersWorkspace } from './components/MembersWorkspace';
import { PasswordUpdatePanel } from './components/PasswordUpdatePanel';
import { SignInPanel } from './components/SignInPanel';
import { SupportWorkspace } from './components/SupportWorkspace';
import { SyncRecoveryWorkspace } from './components/SyncRecoveryWorkspace';
import { TodayWorkspace } from './components/TodayWorkspace';
import type { LearningRepository } from './domain/learning';
import type { OrganizationRepository } from './domain/membership';
import { APP_ROLES, getRoleDefinition, hasCapability, type AppRole } from './domain/roles';
import type { SupportActor, SupportRepository } from './domain/support';
import { runtimeConfiguration, supabase } from './lib/supabase';
import { useCloudIdentity } from './lib/use-cloud-identity';
import { useSyncQueue } from './lib/use-sync-queue';
import { LocalLearningRepository } from './services/local-learning';
import { LocalOrganizationRepository } from './services/local-organization';
import { LocalLearningStudioRepository } from './services/local-studio';
import { LocalSupportRepository } from './services/local-support';
import { ResilientLearningRepository } from './services/resilient-learning';
import { ResilientLearningStudioRepository } from './services/resilient-studio';
import { StudioConflictStore } from './services/studio-conflicts';
import { SupabaseLearningRepository } from './services/supabase-learning';
import { SupabaseOrganizationRepository } from './services/supabase-organization';
import { SupabaseLearningStudioRepository } from './services/supabase-studio';
import { SupabaseSupportRepository } from './services/supabase-support';
import { SyncQueueManager } from './services/sync-queue';

const SCREENS = ['today', 'studio', 'group', 'learners', 'members', 'support', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

const localSupportRepository = new LocalSupportRepository();
const localOrganizationRepository = new LocalOrganizationRepository();
const localLearningRepository = new LocalLearningRepository();
const cloudSupportRepository = supabase ? new SupabaseSupportRepository(supabase) : null;
const cloudOrganizationRepository = supabase ? new SupabaseOrganizationRepository(supabase) : null;
const cloudLearningRepository = supabase ? new SupabaseLearningRepository(supabase) : null;
const cloudStudioRepository = supabase ? new SupabaseLearningStudioRepository(supabase) : null;
const simulationEnabledAtBoot = runtimeConfiguration.mode === 'local-preview'
  && new URLSearchParams(window.location.search).get('sync-sim') === '1';
const syncQueueManager = new SyncQueueManager({
  mode: runtimeConfiguration.mode === 'cloud'
    ? 'cloud-connected'
    : simulationEnabledAtBoot
      ? 'cloud-simulation'
      : 'local-only'
});
const studioConflictStore = new StudioConflictStore();
const localStudioRepository = new LocalLearningStudioRepository(syncQueueManager);
const resilientLearningRepository = new ResilientLearningRepository({
  local: localLearningRepository,
  remote: cloudLearningRepository,
  studioRemote: cloudStudioRepository,
  queue: syncQueueManager,
  simulateRemote: simulationEnabledAtBoot
});
const learningStudioRepository = new ResilientLearningStudioRepository({
  local: localStudioRepository,
  remote: cloudStudioRepository,
  queue: syncQueueManager,
  conflicts: studioConflictStore
});

const NAV_ITEMS = [
  { id: 'today', label: 'Today', description: 'Assign, learn, and review', icon: '◉' },
  { id: 'studio', label: 'Plan', description: 'Checks, proof, and the week', icon: '▦' },
  { id: 'group', label: 'Group', description: 'Households and coordination', icon: '⌂' },
  { id: 'learners', label: 'Learners', description: 'Profiles and handoff', icon: '◇' },
  { id: 'members', label: 'Members', description: 'Roles and invitations', icon: '◎' },
  { id: 'support', label: 'Help', description: 'Feedback and support', icon: '?' },
  { id: 'settings', label: 'Sync', description: 'Queue, backup, and recovery', icon: '↻' }
] as const;

function screenFromHash(): Screen {
  const value = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.includes(value as Screen) ? value as Screen : 'today';
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function GroupScreen({ role }: { role: AppRole }) {
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Hosted pilot authority</span><h1>Shared records can synchronize without changing who is allowed to decide.</h1><p>Beta 4 adds hosted repositories and conflict-aware reconciliation while preserving deterministic scoring, adult-reviewed proof, and planning-only boundaries.</p></section>
      <section className="model-grid">
        <article className="panel model-card"><span className="model-number">01</span><h2>Local first</h2><p>Authorized work is saved to the application-owned local mirror before a queued hosted acknowledgement is attempted.</p></article>
        <article className="panel model-card"><span className="model-number">02</span><h2>No silent conflict</h2><p>Divergent local and hosted studio records remain local and are surfaced through non-reversible diagnostic digests.</p></article>
        <article className="panel model-card"><span className="model-number">03</span><h2>Authority preserved</h2><p>Objective scores remain informational, subjective proof remains adult-reviewed, and plans never create completion.</p></article>
      </section>
      <section className="panel boundary-list"><div className="section-heading"><div><span className="eyebrow">Current role</span><h2>{getRoleDefinition(role).label}</h2></div></div><ul><li>Cloud processing is disabled while signed out.</li><li>Stable operation IDs prevent duplicate hosted writes.</li><li>Director and System Administrator roles do not automatically reveal household records.</li><li>Provider secrets and learner record contents are excluded from diagnostics.</li></ul></section>
    </div>
  );
}

function SettingsOverview({ role }: { role: AppRole }) {
  const definition = getRoleDefinition(role);
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Beta 4 hosted pilot readiness</span><h1>The application is ready for an owner-controlled non-production Supabase pilot.</h1><p>Hosted repositories, stable queue execution, conflict visibility, schema verification, and sanitized operational diagnostics are available without embedding provider credentials.</p></section>
      <section className="settings-grid">
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">S</span><div><h2>Supabase</h2><p>Optional hosted identity and database target.</p></div></div><span className={`status-chip ${runtimeConfiguration.supabaseConfigured ? 'resolved' : 'neutral'}`}>{runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Activation deferred'}</span><p className="muted">Configured host: {runtimeConfiguration.supabaseHost || 'none'}. Local beta.4 workflows remain available.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">Q</span><div><h2>Queue &amp; reconciliation</h2><p>Ordered hosted writes and visible conflict digests.</p></div></div><span className="status-chip acknowledged">Ready</span><p className="muted">Hosted retries preserve local record IDs and never silently overwrite divergent studio records.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">R</span><div><h2>Operational recovery</h2><p>Encrypted portable backup, restore preview, and sanitized pilot diagnostics.</p></div></div><span className="status-chip resolved">Available</span><p className="muted">Provider credentials, sessions, queue payloads, and learner content remain excluded from diagnostics.</p></article>
      </section>
      <section className="panel permission-summary"><h2>Current access</h2><p>{definition.description}</p><div className="permission-chips">{definition.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></section>
    </div>
  );
}

export default function BetaApp() {
  const online = useOnlineStatus();
  const cloud = useCloudIdentity();
  const syncSnapshot = useSyncQueue(syncQueueManager);
  const [previewRole, setPreviewRole] = useState<AppRole>('parent');
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  const [handoffLearnerId, setHandoffLearnerId] = useState<string | null>(null);
  const effectiveRole = cloud.identity?.role ?? previewRole;

  useEffect(() => {
    const update = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    if (screen === 'members' && !hasCapability(effectiveRole, 'manage-group-settings')) {
      window.location.hash = '/today';
      setScreen('today');
    }
    if (screen === 'learners' && !hasCapability(effectiveRole, 'manage-household-learners')) {
      window.location.hash = '/today';
      setScreen('today');
    }
    if (screen === 'studio' && !['parent', 'group-admin'].includes(effectiveRole)) {
      window.location.hash = '/today';
      setScreen('today');
    }
  }, [effectiveRole, screen]);

  useEffect(() => {
    const allowed = runtimeConfiguration.mode === 'local-preview'
      ? simulationEnabledAtBoot
      : Boolean(cloud.identity);
    syncQueueManager.setEnabled(allowed);
  }, [cloud.identity]);

  const organizationRepository: OrganizationRepository = cloud.identity && cloudOrganizationRepository ? cloudOrganizationRepository : localOrganizationRepository;
  const learningRepository: LearningRepository = resilientLearningRepository;

  if (runtimeConfiguration.mode === 'cloud') {
    if (cloud.loading) return <div className="loading-screen">Loading secure group access…</div>;
    if (cloud.recoveryMode && cloud.session) return <PasswordUpdatePanel onUpdatePassword={cloud.updatePassword} onSignOut={cloud.signOut} />;
    if (!cloud.session) return <SignInPanel busy={cloud.loading} error={cloud.error} onSignIn={cloud.signIn} onSignUp={cloud.signUp} onRequestPasswordReset={cloud.requestPasswordReset} />;
    if (cloud.account && !cloud.identity) return <IdentityBootstrap account={cloud.account} repository={cloudOrganizationRepository ?? localOrganizationRepository} onComplete={cloud.refreshIdentity} onSignOut={cloud.signOut} />;
  }

  const role = effectiveRole;
  const organizationId = cloud.identity?.organizationId ?? 'preview-organization';
  const organizationName = cloud.identity?.organizationName ?? 'Beaufort Learning Harbor Preview';
  const actorId = cloud.identity?.userId ?? `preview-${role}`;
  const actor: SupportActor = cloud.identity
    ? { id: cloud.identity.userId, label: cloud.identity.label, role, organizationId }
    : { id: actorId, label: `Preview ${getRoleDefinition(role).label}`, role, organizationId };
  const supportRepository: SupportRepository = cloud.identity && cloudSupportRepository ? cloudSupportRepository : localSupportRepository;

  if (handoffLearnerId) {
    return <TodayWorkspace
      organizationId={organizationId}
      actorId={actorId}
      role={role}
      repository={learningRepository}
      handoffLearnerId={handoffLearnerId}
      onBeginHandoff={setHandoffLearnerId}
      onEndHandoff={() => setHandoffLearnerId(null)}
      renderLearnerSupplement={(version, onLearningChanged) => <LearningStudioWorkspace key={version} organizationId={organizationId} actorId={actorId} role={role} learningRepository={learningRepository} studioRepository={learningStudioRepository} mode="learner" learnerId={handoffLearnerId} onLearningChanged={onLearningChanged} />}
    />;
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'studio') return role === 'parent' || role === 'group-admin';
    if (item.id === 'group') return hasCapability(role, 'view-group');
    if (item.id === 'learners') return hasCapability(role, 'manage-household-learners');
    if (item.id === 'members') return hasCapability(role, 'manage-group-settings');
    return true;
  });

  function navigate(next: Screen) {
    window.location.hash = `/${next}`;
    setScreen(next);
  }

  function changeSimulation(enabled: boolean): void {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('sync-sim', '1');
    else url.searchParams.delete('sync-sim');
    window.location.assign(url.toString());
  }

  const syncLabel = !syncSnapshot.online
    ? 'Offline'
    : syncSnapshot.failedCount > 0
      ? `${syncSnapshot.failedCount} failed`
      : syncSnapshot.pendingCount > 0
        ? `${syncSnapshot.pendingCount} pending`
        : syncSnapshot.mode === 'local-only'
          ? 'Local only'
          : 'Synced';

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">BLH</span><div><span className="eyebrow">Beaufort Learning Harbor</span><strong>Group learning platform</strong></div></div>
        <nav className="primary-nav" aria-label="Main navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)} data-testid={`nav-${item.id}`}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</nav>
        <div className="sidebar-footer"><span className={`connection-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" /><span>{online ? 'Network available' : 'Working offline'}</span></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div><span className="mobile-brand">BLH</span><span className={`mode-badge ${runtimeConfiguration.mode}`} data-testid="runtime-mode">{runtimeConfiguration.mode === 'cloud' ? 'Cloud connected' : 'Local preview'}</span><button className={`sync-indicator ${syncSnapshot.failedCount > 0 ? 'failed' : syncSnapshot.pendingCount > 0 ? 'pending' : ''}`} type="button" onClick={() => navigate('settings')} data-testid="sync-indicator">{syncLabel}</button></div>
          <div className="identity-controls">{runtimeConfiguration.mode === 'local-preview' ? <label className="role-preview-control"><span>Preview role</span><select value={previewRole} onChange={(event) => setPreviewRole(event.target.value as AppRole)} data-testid="role-select">{APP_ROLES.map((option) => <option key={option} value={option}>{getRoleDefinition(option).label}</option>)}</select></label> : <><div className="identity-label"><strong>{cloud.identity?.label}</strong><span>{getRoleDefinition(role).label}</span></div><button className="button ghost small" type="button" onClick={() => void cloud.signOut()}>Sign out</button></>}</div>
        </header>
        <main className="content" id="main-content">
          {screen === 'today' && <TodayWorkspace organizationId={organizationId} actorId={actorId} role={role} repository={learningRepository} handoffLearnerId={null} onBeginHandoff={setHandoffLearnerId} onEndHandoff={() => setHandoffLearnerId(null)} />}
          {screen === 'studio' && (role === 'parent' || role === 'group-admin') && <LearningStudioWorkspace organizationId={organizationId} actorId={actorId} role={role} learningRepository={learningRepository} studioRepository={learningStudioRepository} mode="adult" />}
          {screen === 'group' && hasCapability(role, 'view-group') && <GroupScreen role={role} />}
          {screen === 'learners' && hasCapability(role, 'manage-household-learners') && <LearnersWorkspace organizationId={organizationId} actorId={actorId} repository={learningRepository} onBeginHandoff={setHandoffLearnerId} />}
          {screen === 'members' && hasCapability(role, 'manage-group-settings') && <MembersWorkspace organizationId={organizationId} organizationName={organizationName} repository={organizationRepository} />}
          {screen === 'support' && <SupportWorkspace actor={actor} repository={supportRepository} />}
          {screen === 'settings' && <div className="settings-release-stack"><SettingsOverview role={role} /><SyncRecoveryWorkspace manager={syncQueueManager} snapshot={syncSnapshot} simulationEnabled={simulationEnabledAtBoot} onSimulationChange={changeSimulation} onRestoreApplied={() => window.location.reload()} /><HostedPilotWorkspace organizationId={organizationId} identityActive={Boolean(cloud.identity)} syncSnapshot={syncSnapshot} conflictStore={studioConflictStore} /></div>}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
