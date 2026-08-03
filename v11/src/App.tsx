import { useEffect, useState } from 'react';
import { IdentityBootstrap } from './components/IdentityBootstrap';
import { MembersWorkspace } from './components/MembersWorkspace';
import { PasswordUpdatePanel } from './components/PasswordUpdatePanel';
import { SignInPanel } from './components/SignInPanel';
import { SupportWorkspace } from './components/SupportWorkspace';
import { APP_ROLES, getRoleDefinition, hasCapability, type AppRole } from './domain/roles';
import type { OrganizationRepository } from './domain/membership';
import type { SupportActor, SupportRepository } from './domain/support';
import { runtimeConfiguration, supabase } from './lib/supabase';
import { useCloudIdentity } from './lib/use-cloud-identity';
import { LocalOrganizationRepository } from './services/local-organization';
import { LocalSupportRepository } from './services/local-support';
import { SupabaseOrganizationRepository } from './services/supabase-organization';
import { SupabaseSupportRepository } from './services/supabase-support';

const SCREENS = ['today', 'group', 'members', 'support', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

const localSupportRepository = new LocalSupportRepository();
const localOrganizationRepository = new LocalOrganizationRepository();
const cloudSupportRepository = supabase ? new SupabaseSupportRepository(supabase) : null;
const cloudOrganizationRepository = supabase ? new SupabaseOrganizationRepository(supabase) : null;

const NAV_ITEMS = [
  { id: 'today', label: 'Today', description: 'The next useful action', icon: '◉' },
  { id: 'group', label: 'Group', description: 'Households and coordination', icon: '⌂' },
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

function TodayScreen({ role }: { role: AppRole }) {
  const definition = getRoleDefinition(role);
  const student = role === 'student';
  const steps = student
    ? ['Learn', 'Practice', 'Quiz / Test', 'Proof if needed', 'Feedback']
    : ['Plan', 'Assign', 'Learn', 'Review evidence', 'Reconcile records'];

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">{student ? 'Your learning day' : 'Household and group overview'}</span>
          <h1>{student ? 'Know what to do next.' : 'One calm place to coordinate learning.'}</h1>
          <p>{student
            ? 'The learner path stays focused: Learn, Practice, Quiz or Test, Proof when needed, then Feedback.'
            : 'Identity, membership, planning, delivery, evidence, and support now have explicit boundaries.'}</p>
        </div>
        <div className="hero-badge"><strong>v11</strong><span>Identity alpha 2</span></div>
      </section>

      <section className="metric-grid" aria-label="Foundation readiness">
        <article className="metric-card"><span>Current role</span><strong>{definition.label}</strong><p>{definition.description}</p></article>
        <article className="metric-card"><span>Identity</span><strong>{runtimeConfiguration.mode === 'cloud' ? 'Supabase connected' : 'Preview identities'}</strong><p>{runtimeConfiguration.mode === 'cloud' ? 'Sessions and memberships are database-backed.' : 'No real account or family data is being used.'}</p></article>
        <article className="metric-card"><span>Legacy safety</span><strong>v10.43 preserved</strong><p>The validated offline application remains the stable fallback.</p></article>
      </section>

      <section className="panel workflow-panel">
        <div className="section-heading"><div><span className="eyebrow">Primary workflow</span><h2>{student ? 'Today’s learning path' : 'The household operating path'}</h2></div><span className="status-chip neutral">No automatic outcomes</span></div>
        <div className="workflow-steps">{steps.map((step, index) => <div className="workflow-step" key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}</div>
        <p className="muted">This alpha does not award XP, grades, attendance, mastery, or record completion.</p>
      </section>
    </div>
  );
}

function GroupScreen({ role }: { role: AppRole }) {
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Group model</span><h1>Separate accounts, households, and organization membership.</h1><p>Permissions follow real relationships rather than assuming every adult can see every learner.</p></section>
      <section className="model-grid">
        <article className="panel model-card"><span className="model-number">01</span><h2>Account</h2><p>Supabase Auth owns credentials, confirmation, recovery, and sessions.</p></article>
        <article className="panel model-card"><span className="model-number">02</span><h2>Household</h2><p>Parents and guardians connect to learners through explicit membership and consent.</p></article>
        <article className="panel model-card"><span className="model-number">03</span><h2>Group</h2><p>Expiring invitations create only the approved organization role.</p></article>
      </section>
      <section className="panel boundary-list">
        <div className="section-heading"><div><span className="eyebrow">Role boundary preview</span><h2>{getRoleDefinition(role).label}</h2></div></div>
        <ul>
          <li>Household access is separate from group administration.</li>
          <li>Director and Group Administrator remain distinct roles.</li>
          <li>System Administrator access cannot be granted through an invitation.</li>
          <li>Students can report problems without seeing internal support notes.</li>
        </ul>
      </section>
    </div>
  );
}

function SettingsScreen({ role }: { role: AppRole }) {
  const definition = getRoleDefinition(role);
  return (
    <div className="page-stack">
      <section className="page-heading"><span className="eyebrow">Preview readiness</span><h1>Connections stay explicit and secrets stay outside browser code.</h1><p>Alpha 2 supports account bootstrap and a manually authorized preview deployment without touching the v10 Worker.</p></section>
      <section className="settings-grid">
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">S</span><div><h2>Supabase</h2><p>Authentication, Postgres, invitations, recovery, and row-level security.</p></div></div><span className={`status-chip ${runtimeConfiguration.supabaseConfigured ? 'resolved' : 'neutral'}`}>{runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Not connected'}</span><p className="muted">Configured host: {runtimeConfiguration.supabaseHost || 'none'}. Service-role keys are rejected from browser configuration.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">CF</span><div><h2>Cloudflare</h2><p>React assets and Worker API deploy as one isolated preview unit.</p></div></div><span className="status-chip acknowledged">Manual preview gate</span><p className="muted">Deployment requires the `v11-preview` GitHub environment, scoped secrets, and an explicit confirmation input.</p></article>
        <article className="panel connection-card"><div className="connection-heading"><span className="connection-icon">B</span><div><h2>BAND</h2><p>Optional reviewed announcements and reminders.</p></div></div><span className="status-chip neutral">Deferred</span><p className="muted">No client secret, access token, or student record is included.</p></article>
      </section>
      <section className="panel permission-summary"><h2>Current access</h2><p>{definition.description}</p><div className="permission-chips">{definition.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div>{!hasCapability(role, 'manage-group-settings') && <p className="muted">Membership administration is hidden for this role.</p>}{hasCapability(role, 'manage-system-settings') && <p className="message success">System administration preview is enabled, but invitation-based elevation remains blocked.</p>}</section>
    </div>
  );
}

export default function App() {
  const online = useOnlineStatus();
  const cloud = useCloudIdentity();
  const [previewRole, setPreviewRole] = useState<AppRole>('parent');
  const [screen, setScreen] = useState<Screen>(screenFromHash);
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
  }, [effectiveRole, screen]);

  const organizationRepository: OrganizationRepository = cloud.identity && cloudOrganizationRepository
    ? cloudOrganizationRepository
    : localOrganizationRepository;

  if (runtimeConfiguration.mode === 'cloud') {
    if (cloud.loading) return <div className="loading-screen">Loading secure group access…</div>;
    if (cloud.recoveryMode && cloud.session) return <PasswordUpdatePanel onUpdatePassword={cloud.updatePassword} onSignOut={cloud.signOut} />;
    if (!cloud.session) return <SignInPanel busy={cloud.loading} error={cloud.error} onSignIn={cloud.signIn} onSignUp={cloud.signUp} onRequestPasswordReset={cloud.requestPasswordReset} />;
    if (cloud.account && !cloud.identity) return <IdentityBootstrap account={cloud.account} repository={cloudOrganizationRepository ?? localOrganizationRepository} onComplete={cloud.refreshIdentity} onSignOut={cloud.signOut} />;
  }

  const role = effectiveRole;
  const organizationId = cloud.identity?.organizationId ?? 'preview-organization';
  const organizationName = cloud.identity?.organizationName ?? 'Beaufort Learning Harbor Preview';
  const actor: SupportActor = cloud.identity
    ? { id: cloud.identity.userId, label: cloud.identity.label, role, organizationId }
    : { id: `preview-${role}`, label: `Preview ${getRoleDefinition(role).label}`, role, organizationId };
  const supportRepository: SupportRepository = cloud.identity && cloudSupportRepository ? cloudSupportRepository : localSupportRepository;
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'group') return hasCapability(role, 'view-group');
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
          {screen === 'today' && <TodayScreen role={role} />}
          {screen === 'group' && hasCapability(role, 'view-group') && <GroupScreen role={role} />}
          {screen === 'members' && hasCapability(role, 'manage-group-settings') && <MembersWorkspace organizationId={organizationId} organizationName={organizationName} repository={organizationRepository} />}
          {screen === 'support' && <SupportWorkspace actor={actor} repository={supportRepository} />}
          {screen === 'settings' && <SettingsScreen role={role} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">{visibleNav.map((item) => <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
