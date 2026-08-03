import { useEffect, useState } from 'react';
import { IdentityBootstrap } from './components/IdentityBootstrap';
import { LearnersWorkspace } from './components/LearnersWorkspace';
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
import { LocalSupportRepository } from './services/local-support';
import { ResilientLearningRepository } from './services/resilient-learning';
import { SupabaseLearningRepository } from './services/supabase-learning';
import { SupabaseOrganizationRepository } from './services/supabase-organization';
import { SupabaseSupportRepository } from './services/supabase-support';
import { SyncQueueManager } from './services/sync-queue';

const SCREENS = ['today', 'group', 'learners', 'members', 'support', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

const localSupportRepository = new LocalSupportRepository();
const localOrganizationRepository = new LocalOrganizationRepository();
const localLearningRepository = new LocalLearningRepository();
const cloudSupportRepository = supabase ? new SupabaseSupportRepository(supabase) : null;
const cloudOrganizationRepository = supabase ? new SupabaseOrganizationRepository(supabase) : null;
const cloudLearningRepository = supabase ? new SupabaseLearningRepository(supabase) : null;
const simulationEnabledAtBoot = runtimeConfiguration.mode === 'local-preview'
  && new URLSearchParams(window.location.search).get('sync-sim') === '1';
const syncQueueManager = new SyncQueueManager({
  mode: runtimeConfiguration.mode === 'cloud'
    ? 'cloud-connected'
    : simulationEnabledAtBoot
      ? 'cloud-simulation'
      : 'local-only'
});
const resilientLearningRepository = new ResilientLearningRepository({
  local: localLearningRepository,
  remote: cloudLearningRepository,
  queue: syncQueueManager,
  simulateRemote: simulationEnabledAtBoot
});

const NAV_ITEMS = [
  { id: 'today', label: 'Today', description: 'Assign, learn, and review', icon: '◉' },
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
      <section className="page-heading"><span className="eyebrow">Resilient relationship model</span><h1>Family work stays local immediately and synchronizes only through explicit boundaries.</h1><p>Beta 2 adds operation receipts, retry controls, and encrypted recovery without requiring the hosted Supabase project yet.</p></section>
      <section className="model-grid">
        <article className="panel model-card"><span className="model-number">01</span><h2>Local mirror</h2><p>Supported household actions are written locally first so the current device remains usable during a temporary interruption.</p></article>
        <article className="panel model-card"><span className="model-number">02</span><h2>Operation queue</h2><p>Cloud-bound actions receive stable identifiers, preserve order, and cannot be duplicated by a retry.</p></article>
        <article className="panel model-card"><span className="model-number">03</span><h2>Controlled recovery</h2><p>Encrypted backups are verified and previewed before replacing application-owned local records.</p></article>
      </section>
      <section className="panel boundary-list"><div className="section-heading"><div><span className="eyebrow">Current role</span><h2>{getRoleDefinition(role).label}</h2></div></div><ul><li>Synchronization is disabled while a hosted user is signed out.</li><li>Parent-assisted learner actions still require explicit adult review.</li><li>Retry receipts prevent the same Today transition from applying twice.</li><li>Backups exclude sessions, credentials, deployment secrets, OAuth tokens, and active invitation tokens.</li></ul></section>
    </div>
  );
}

function SettingsOverview({ role }: { role: AppRole }) {
  const definition = getRoleDefinition(role);
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Beta 2 readiness</span><h1>Supabase can wait; resilience and recovery do not have to.</h1><p>The application now exposes pending work, failed retries, local-only status, and encrypted backup/restore before any hosted pilot begins.</p></section>
      <section className="settings-grid">
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">S</span><div><h2>Supabase</h2><p>Optional hosted identity and database target.</p></div></div><span className={`status-chip ${runtimeConfiguration.supabaseConfigured ? 'resolved' : 'neutral'}`}>{runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Deferred'}</span><p className="muted">Configured host: {runtimeConfiguration.supabaseHost || 'none'}. Local preview remains fully testable.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">Q</span><div><h2>Offline queue</h2><p>Ordered operations with retry, cancellation, and duplicate prevention.</p></div></div><span className="status-chip acknowledged">Ready</span><p className="muted">Cloud simulation can validate the queue without sending data anywhere.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">R</span><div><h2>Recovery</h2><p>Encrypted portable backups with integrity verification and restore preview.</p></div></div><span className="status-chip resolved">Available</span><p className="muted">A pre-restore rollback snapshot is retained locally before replacement.</p></article>
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
    return <TodayWorkspace organizationId={organizationId} actorId={actorId} role={role} repository={learningRepository} handoffLearnerId={handoffLearnerId} onBeginHandoff={setHandoffLearnerId} onEndHandoff={() => setHandoffLearnerId(null)} />;
  }

  const visibleNav = NAV_ITEMS.filter((item) => {
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
          {screen === 'group' && hasCapability(role, 'view-group') && <GroupScreen role={role} />}
          {screen === 'learners' && hasCapability(role, 'manage-household-learners') && <LearnersWorkspace organizationId={organizationId} actorId={actorId} repository={learningRepository} onBeginHandoff={setHandoffLearnerId} />}
          {screen === 'members' && hasCapability(role, 'manage-group-settings') && <MembersWorkspace organizationId={organizationId} organizationName={organizationName} repository={organizationRepository} />}
          {screen === 'support' && <SupportWorkspace actor={actor} repository={supportRepository} />}
          {screen === 'settings' && <div className="settings-release-stack"><SettingsOverview role={role} /><SyncRecoveryWorkspace manager={syncQueueManager} snapshot={syncSnapshot} simulationEnabled={simulationEnabledAtBoot} onSimulationChange={changeSimulation} onRestoreApplied={() => window.location.reload()} /></div>}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
