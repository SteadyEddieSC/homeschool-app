import { useEffect, useMemo, useState } from 'react';
import { SupportWorkspace } from './components/SupportWorkspace';
import { SignInPanel } from './components/SignInPanel';
import {
  APP_ROLES,
  getRoleDefinition,
  hasCapability,
  type AppRole
} from './domain/roles';
import type { SupportActor, SupportRepository } from './domain/support';
import { runtimeConfiguration, supabase } from './lib/supabase';
import { useCloudIdentity } from './lib/use-cloud-identity';
import { LocalSupportRepository } from './services/local-support';
import { SupabaseSupportRepository } from './services/supabase-support';

const SCREENS = ['today', 'group', 'support', 'settings'] as const;
type Screen = (typeof SCREENS)[number];

interface NavItem {
  id: Screen;
  label: string;
  description: string;
  icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'today', label: 'Today', description: 'The next useful action', icon: '◉' },
  { id: 'group', label: 'Group', description: 'Households and coordination', icon: '⌂' },
  { id: 'support', label: 'Help', description: 'Feedback and support', icon: '?' },
  { id: 'settings', label: 'Settings', description: 'Connections and readiness', icon: '⚙' }
];

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
  const studentView = role === 'student';
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">{studentView ? 'Your learning day' : 'Household and group overview'}</span>
          <h1>{studentView ? 'Know what to do next.' : 'One calm place to coordinate learning.'}</h1>
          <p>
            {studentView
              ? 'The v11 foundation keeps the learner path focused: Learn, Practice, Quiz or Test, Proof when needed, then Feedback.'
              : 'The new foundation connects planning, delivery, evidence, support, and records without turning every tool into a separate destination.'}
          </p>
        </div>
        <div className="hero-badge">
          <strong>v11</strong>
          <span>Foundation alpha 1</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Foundation readiness">
        <article className="metric-card">
          <span>Current role</span>
          <strong>{definition.label}</strong>
          <p>{definition.description}</p>
        </article>
        <article className="metric-card">
          <span>Shared data</span>
          <strong>{runtimeConfiguration.mode === 'cloud' ? 'Supabase connected' : 'Preview data only'}</strong>
          <p>{runtimeConfiguration.mode === 'cloud' ? 'Access is enforced by database policies.' : 'No real account or family data is being used.'}</p>
        </article>
        <article className="metric-card">
          <span>Legacy safety</span>
          <strong>v10.43 preserved</strong>
          <p>The validated offline application remains the stable fallback during migration.</p>
        </article>
      </section>

      <section className="panel workflow-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Primary workflow</span>
            <h2>{studentView ? 'Today’s learning path' : 'The household operating path'}</h2>
          </div>
          <span className="status-chip neutral">Designed before expanded</span>
        </div>
        <div className="workflow-steps">
          {(studentView
            ? ['Learn', 'Practice', 'Quiz / Test', 'Proof if needed', 'Feedback']
            : ['Plan', 'Assign', 'Learn', 'Review evidence', 'Reconcile records']
          ).map((step, index) => (
            <div className="workflow-step" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <p className="muted">
          This alpha establishes the application shell and data boundaries. It does not award XP, grades, attendance, mastery, or record completion.
        </p>
      </section>
    </div>
  );
}

function GroupScreen({ role }: { role: AppRole }) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <span className="eyebrow">Group model</span>
        <h1>Separate accounts, households, and organization membership.</h1>
        <p>Permissions should follow real relationships rather than assuming every adult can see every learner.</p>
      </section>
      <section className="model-grid">
        <article className="panel model-card">
          <span className="model-number">01</span>
          <h2>Account</h2>
          <p>Supabase Auth owns credentials, recovery, and sessions. The application never stores passwords.</p>
        </article>
        <article className="panel model-card">
          <span className="model-number">02</span>
          <h2>Household</h2>
          <p>Parents and guardians connect to household learners through explicit membership and consent.</p>
        </article>
        <article className="panel model-card">
          <span className="model-number">03</span>
          <h2>Group</h2>
          <p>Teachers, directors, and administrators receive only the organization permissions required for their jobs.</p>
        </article>
      </section>
      <section className="panel boundary-list">
        <div className="section-heading">
          <div><span className="eyebrow">Role boundary preview</span><h2>{getRoleDefinition(role).label}</h2></div>
        </div>
        <ul>
          <li>Household access is separate from group administration.</li>
          <li>Director and Group Administrator are distinct roles.</li>
          <li>System Administrator access does not automatically become educational authority.</li>
          <li>Students can report problems without seeing internal support notes.</li>
        </ul>
      </section>
    </div>
  );
}

function SettingsScreen({ role }: { role: AppRole }) {
  const canManageGroup = hasCapability(role, 'manage-group-settings');
  const canManageSystem = hasCapability(role, 'manage-system-settings');
  return (
    <div className="page-stack">
      <section className="page-heading">
        <span className="eyebrow">Foundation readiness</span>
        <h1>Connections stay explicit and secrets stay server-side.</h1>
        <p>The preview can be evaluated without any third-party account. Real cloud configuration is added only after owner-controlled setup.</p>
      </section>
      <section className="settings-grid">
        <article className="panel connection-card">
          <div className="connection-heading">
            <span className="connection-icon">S</span>
            <div><h2>Supabase</h2><p>Authentication, Postgres, row-level security, and active file metadata.</p></div>
          </div>
          <span className={`status-chip ${runtimeConfiguration.supabaseConfigured ? 'resolved' : 'neutral'}`}>
            {runtimeConfiguration.supabaseConfigured ? 'Configured' : 'Not connected'}
          </span>
          <p className="muted">Only the public project URL and publishable browser key belong in Vite configuration. Service-role keys remain server-side.</p>
        </article>
        <article className="panel connection-card">
          <div className="connection-heading">
            <span className="connection-icon">CF</span>
            <div><h2>Cloudflare</h2><p>React assets and the Worker API deploy as one preview unit.</p></div>
          </div>
          <span className="status-chip acknowledged">Preview isolated</span>
          <p className="muted">The Worker name is intentionally separate from the v10.43 production Worker.</p>
        </article>
        <article className="panel connection-card">
          <div className="connection-heading">
            <span className="connection-icon">B</span>
            <div><h2>BAND</h2><p>Optional communication channel for reviewed announcements and reminders.</p></div>
          </div>
          <span className="status-chip neutral">Deferred</span>
          <p className="muted">No client secret, access token, or student record is included in this release.</p>
        </article>
      </section>
      <section className="panel permission-summary">
        <h2>Current access</h2>
        <p>{getRoleDefinition(role).description}</p>
        <div className="permission-chips">
          {getRoleDefinition(role).capabilities.map((capability) => <span key={capability}>{capability}</span>)}
        </div>
        {!canManageGroup && <p className="muted">Group configuration controls are hidden for this role.</p>}
        {canManageSystem && <p className="message success">System administration preview is enabled for this role.</p>}
      </section>
    </div>
  );
}

export default function App() {
  const online = useOnlineStatus();
  const cloud = useCloudIdentity();
  const [previewRole, setPreviewRole] = useState<AppRole>('parent');
  const [screen, setScreen] = useState<Screen>(screenFromHash);

  useEffect(() => {
    const update = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  if (runtimeConfiguration.mode === 'cloud' && (cloud.loading || !cloud.identity)) {
    if (cloud.loading) return <div className="loading-screen">Loading secure group access…</div>;
    return <SignInPanel busy={cloud.loading} error={cloud.error} onSignIn={cloud.signIn} />;
  }

  const role = cloud.identity?.role ?? previewRole;
  const actor: SupportActor = cloud.identity
    ? {
        id: cloud.identity.userId,
        label: cloud.identity.label,
        role,
        organizationId: cloud.identity.organizationId
      }
    : {
        id: `preview-${role}`,
        label: `Preview ${getRoleDefinition(role).label}`,
        role,
        organizationId: 'preview-organization'
      };

  const repository: SupportRepository = useMemo(
    () => supabase && cloud.identity ? new SupabaseSupportRepository(supabase) : new LocalSupportRepository(),
    [cloud.identity]
  );

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'group') return hasCapability(role, 'view-group');
    return true;
  });

  function navigate(next: Screen) {
    window.location.hash = `/${next}`;
    setScreen(next);
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">BLH</span>
          <div>
            <span className="eyebrow">Beaufort Learning Harbor</span>
            <strong>Group learning platform</strong>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          {visibleNav.map((item) => (
            <button
              type="button"
              key={item.id}
              className={screen === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
              data-testid={`nav-${item.id}`}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`connection-dot ${online ? 'online' : 'offline'}`} aria-hidden="true" />
          <span>{online ? 'Network available' : 'Working offline'}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="mobile-brand">BLH</span>
            <span className={`mode-badge ${runtimeConfiguration.mode}`} data-testid="runtime-mode">
              {runtimeConfiguration.mode === 'cloud' ? 'Cloud connected' : 'Local preview'}
            </span>
          </div>
          <div className="identity-controls">
            {runtimeConfiguration.mode === 'local-preview' ? (
              <label className="role-preview-control">
                <span>Preview role</span>
                <select
                  value={previewRole}
                  onChange={(event) => setPreviewRole(event.target.value as AppRole)}
                  data-testid="role-select"
                >
                  {APP_ROLES.map((option) => (
                    <option key={option} value={option}>{getRoleDefinition(option).label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <div className="identity-label"><strong>{cloud.identity?.label}</strong><span>{getRoleDefinition(role).label}</span></div>
                <button className="button ghost small" type="button" onClick={() => void cloud.signOut()}>Sign out</button>
              </>
            )}
          </div>
        </header>

        <main className="content" id="main-content">
          {screen === 'today' && <TodayScreen role={role} />}
          {screen === 'group' && hasCapability(role, 'view-group') && <GroupScreen role={role} />}
          {screen === 'support' && <SupportWorkspace actor={actor} repository={repository} />}
          {screen === 'settings' && <SettingsScreen role={role} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {visibleNav.map((item) => (
          <button type="button" key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
            <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
