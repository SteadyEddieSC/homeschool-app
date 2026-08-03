import { useEffect, useState } from 'react';
import { IdentityBootstrap } from './components/IdentityBootstrap';
import { LearnersWorkspace } from './components/LearnersWorkspace';
import { MembersWorkspace } from './components/MembersWorkspace';
import { PasswordUpdatePanel } from './components/PasswordUpdatePanel';
import { SignInPanel } from './components/SignInPanel';
import { SupportWorkspace } from './components/SupportWorkspace';
import { TodayWorkspace } from './components/TodayWorkspace';
import type { LearningRepository } from './domain/learning';
import type { OrganizationRepository } from './domain/membership';
import { APP_ROLES, getRoleDefinition, hasCapability, type AppRole } from './domain/roles';
import type { SupportActor, SupportRepository } from './domain/support';
import { runtimeConfiguration, supabase } from './lib/supabase';
import { useCloudIdentity } from './lib/use-cloud-identity';
import { LocalLearningRepository } from './services/local-learning';
import { LocalOrganizationRepository } from './services/local-organization';
import { LocalSupportRepository } from './services/local-support';
import { SupabaseLearningRepository } from './services/supabase-learning';
import { SupabaseOrganizationRepository } from './services/supabase-organization';
import { SupabaseSupportRepository } from './services/supabase-support';

const SCREENS = ['today', 'group', 'learners', 'members', 'support', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

const localSupportRepository = new LocalSupportRepository();
const localOrganizationRepository = new LocalOrganizationRepository();
const localLearningRepository = new LocalLearningRepository();
const cloudSupportRepository = supabase ? new SupabaseSupportRepository(supabase) : null;
const cloudOrganizationRepository = supabase ? new SupabaseOrganizationRepository(supabase) : null;
const cloudLearningRepository = supabase ? new SupabaseLearningRepository(supabase) : null;

const NAV_ITEMS = [
  { id: 'today', label: 'Today', description: 'Assign, learn, and review', icon: '◉' },
  { id: 'group', label: 'Group', description: 'Households and coordination', icon: '⌂' },
  { id: 'learners', label: 'Learners', description: 'Profiles and handoff', icon: '◇' },
  { id: 'members', label: 'Members', description: 'Roles and invitations', icon: '◎' },
  { id: 'support', label: 'Help', description: 'Feedback and support', icon: '?' },
  { id: 'settings', label: 'Settings', description: 'Connections and readiness', icon: '⚙' }
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
      <section className="page-heading"><span className="eyebrow">Relationship model</span><h1>Accounts, households, learner profiles, and groups stay separate.</h1><p>Beta 1 adds parent-managed learner profiles without pretending a supervised device handoff is an independent login.</p></section>
      <section className="model-grid">
        <article className="panel model-card"><span className="model-number">01</span><h2>Adult account</h2><p>Supabase Auth owns adult credentials, confirmation, recovery, and sessions.</p></article>
        <article className="panel model-card"><span className="model-number">02</span><h2>Household learner</h2><p>A parent creates a bounded learner profile without another email address.</p></article>
        <article className="panel model-card"><span className="model-number">03</span><h2>Learning group</h2><p>Organization invitations continue to create only approved ordinary roles.</p></article>
      </section>
      <section className="panel boundary-list"><div className="section-heading"><div><span className="eyebrow">Current role</span><h2>{getRoleDefinition(role).label}</h2></div></div><ul><li>Parent-assisted learner mode hides adult navigation during handoff.</li><li>Learner actions cannot create grades, mastery, attendance, XP, or portfolio approval.</li><li>Household managers explicitly complete or return work after review.</li><li>Teacher and Director family access remains fail-closed until explicit teaching relationships exist.</li></ul></section>
    </div>
  );
}

function SettingsScreen({ role }: { role: AppRole }) {
  const definition = getRoleDefinition(role);
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Beta preview readiness</span><h1>Family workflows are now testable without weakening deployment boundaries.</h1><p>Beta 1 adds learner profiles and reviewed Today items. It still does not deploy automatically, migrate v10.43, or contain real family data.</p></section>
      <section className="settings-grid">
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">S</span><div><h2>Supabase</h2><p>Adult identity, households, learners, Today items, invitations, and Row-Level Security.</p></div></div><span className={`status-chip ${runtimeConfiguration.supabaseConfigured ? 'resolved' : 'neutral'}`}>{runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Not connected'}</span><p className="muted">Configured host: {runtimeConfiguration.supabaseHost || 'none'}. Service-role keys remain rejected from browser configuration.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">CF</span><div><h2>Cloudflare</h2><p>React assets and Worker API remain isolated from the v10 production Worker.</p></div></div><span className="status-chip acknowledged">Manual preview gate</span><p className="muted">The recommended next action is an owner-controlled preview deployment and household pilot.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">B</span><div><h2>BAND</h2><p>Optional reviewed announcements and reminders.</p></div></div><span className="status-chip neutral">Deferred</span><p className="muted">No BAND credentials or learner records are included.</p></article>
      </section>
      <section className="panel permission-summary"><h2>Current access</h2><p>{definition.description}</p><div className="permission-chips">{definition.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></section>
    </div>
  );
}

export default function BetaApp() {
  const online = useOnlineStatus();
  const cloud = useCloudIdentity();
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

  const organizationRepository: OrganizationRepository = cloud.identity && cloudOrganizationRepository ? cloudOrganizationRepository : localOrganizationRepository;
  const learningRepository: LearningRepository = cloud.identity && cloudLearningRepository ? cloudLearningRepository : localLearningRepository;

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

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">BLH</span><div><span className="eyebrow">Beaufort Learning Harbor</span><strong>Group learning platform</strong></div></div>
        <nav className="primary-nav" aria-label="Main navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)} data-testid={`nav-${item.id}`}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</nav>
        <div className="sidebar-footer"><span className={`connection-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" /><span>{online ? 'Network available' : 'Working offline'}</span></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div><span className="mobile-brand">BLH</span><span className={`mode-badge ${runtimeConfiguration.mode}`} data-testid="runtime-mode">{runtimeConfiguration.mode === 'cloud' ? 'Cloud connected' : 'Local preview'}</span></div>
          <div className="identity-controls">{runtimeConfiguration.mode === 'local-preview' ? <label className="role-preview-control"><span>Preview role</span><select value={previewRole} onChange={(event) => setPreviewRole(event.target.value as AppRole)} data-testid="role-select">{APP_ROLES.map((option) => <option key={option} value={option}>{getRoleDefinition(option).label}</option>)}</select></label> : <><div className="identity-label"><strong>{cloud.identity?.label}</strong><span>{getRoleDefinition(role).label}</span></div><button className="button ghost small" type="button" onClick={() => void cloud.signOut()}>Sign out</button></>}</div>
        </header>
        <main className="content" id="main-content">
          {screen === 'today' && <TodayWorkspace organizationId={organizationId} actorId={actorId} role={role} repository={learningRepository} handoffLearnerId={null} onBeginHandoff={setHandoffLearnerId} onEndHandoff={() => setHandoffLearnerId(null)} />}
          {screen === 'group' && hasCapability(role, 'view-group') && <GroupScreen role={role} />}
          {screen === 'learners' && hasCapability(role, 'manage-household-learners') && <LearnersWorkspace organizationId={organizationId} actorId={actorId} repository={learningRepository} onBeginHandoff={setHandoffLearnerId} />}
          {screen === 'members' && hasCapability(role, 'manage-group-settings') && <MembersWorkspace organizationId={organizationId} organizationName={organizationName} repository={organizationRepository} />}
          {screen === 'support' && <SupportWorkspace actor={actor} repository={supportRepository} />}
          {screen === 'settings' && <SettingsScreen role={role} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
