import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.33 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

export async function buildRelease(manifest) {
  let text = await readFile(manifest.base, 'utf8');
  text = text.split('Beaufort Learning Harbor v10.32').join('Beaufort Learning Harbor v10.33');
  text = text.split('BLHMobileDock@v10.32').join('BLHMobileDock@v10.33');
  text = replaceOnce(text, "const APP_VERSION = 'v10.32';", "const APP_VERSION = 'v10.33';", 'app version');
  text = replaceOnce(text, "appVersion: '9.7',", "appVersion: '10.33',", 'state version');
  text = replaceOnce(text, '</style>', `

    /* v10.33 privacy-safe public demo controls */
    .blh1033-demo-notice{margin:0 0 14px;border:1px solid rgba(127,209,255,.45);border-radius:20px;background:linear-gradient(135deg,rgba(25,55,72,.92),rgba(31,36,67,.94));padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}
    .blh1033-demo-notice h2{font-size:1.02rem;margin:0 0 4px}.blh1033-demo-notice p{margin:0;color:var(--muted);line-height:1.42}.blh1033-demo-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.blh1033-demo-status{display:inline-flex;align-items:center;gap:7px;margin-top:8px;border:1px solid var(--line);border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.045);font-size:.78rem;font-weight:900}.blh1033-demo-panel{border:1px solid rgba(142,234,149,.32);background:rgba(142,234,149,.07)}
    @media(max-width:760px){.blh1033-demo-notice{grid-template-columns:1fr;padding:12px}.blh1033-demo-actions{justify-content:stretch}.blh1033-demo-actions .btn{flex:1 1 100%}}
</style>`, 'release styles');
  text = replaceOnce(text, '  function renderAll(){\n', `  const DEMO_META_KEY = 'beaufortLearningHarbor.v10.33.demoMeta';
  function buildDeterministicDemoState(mode='active'){
    const next = seedProgress(clone(defaultState));
    next.appVersion = '10.33';
    next.programName = 'Demo Family Learning Harbor';
    next.currentWeekId = 'week_1';
    next.activeStudentId = 'stu_jordan';
    next.currentStudyLevelId = 'upper';
    next.currentClassDate = '2026-08-19';
    next.currentHabitDate = '2026-08-19';
    next.demoProfile = {
      synthetic: true,
      familyName: 'Demo Family',
      scenario: mode,
      schema: 'beaufortLearningHarbor.demo.v1',
      deterministicSeed: 'blh-v10.33-demo-family'
    };
    next.activity = [];
    if (mode === 'active') {
      const jordan = next.progress.stu_jordan;
      const avery = next.progress.stu_avery;
      Object.assign(jordan, { xp:145, coins:32, teamPoints:45, streak:4, lastPracticeDate:'2026-08-19' });
      Object.assign(avery, { xp:88, coins:21, teamPoints:29, streak:3, lastPracticeDate:'2026-08-19' });
      jordan.studied = { demo_history_week_1:'2026-08-18', demo_geography_week_1:'2026-08-18' };
      avery.studied = { demo_geography_week_1:'2026-08-18' };
      jordan.completed = { demo_map_route:true, demo_ocean_review:true };
      avery.completed = { demo_ocean_names:true };
      next.activity = [
        { at:'2026-08-19T14:30:00.000Z', studentId:'stu_avery', studentName:'Avery', text:'Completed an ocean-name tell-back', xp:10 },
        { at:'2026-08-19T14:10:00.000Z', studentId:'stu_jordan', studentName:'Jordan', text:'Finished the explorer route briefing practice', xp:15 },
        { at:'2026-08-18T15:00:00.000Z', studentId:'stu_jordan', studentName:'Jordan', text:'Studied the Week 1 map and geography cards', xp:8 }
      ];
    }
    return normalize(seedProgress(next));
  }
  function persistDemoMeta(mode){
    try { localStorage.setItem(DEMO_META_KEY, JSON.stringify({ synthetic:true, scenario:mode, seed:'blh-v10.33-demo-family' })); } catch (err) { console.warn('Demo metadata save skipped', err); }
  }
  function applyDemoScenario(mode){
    state = buildDeterministicDemoState(mode);
    persistDemoMeta(mode);
    saveState();
    setScreen('home');
    toast(mode === 'active' ? 'Demo Family loaded' : 'Demo data reset');
  }
  function loadDemoFamily(){
    if (!confirm('Replace this browser\\'s current app data with the active synthetic Demo Family scenario? Export first if you need a backup.')) return;
    applyDemoScenario('active');
  }
  function resetDemo(){
    if (!confirm('Reset this browser to a fresh deterministic Demo Family state? Export first if you need a backup.')) return;
    applyDemoScenario('fresh');
  }
  function renderDemoNotice(){
    if (document.documentElement.dataset.demoBuild !== 'synthetic') return;
    const main = document.querySelector('#app > main');
    if (!main) return;
    let el = document.getElementById('blh1033DemoNotice');
    if (!el) {
      el = document.createElement('section');
      el.id = 'blh1033DemoNotice';
      el.className = 'blh1033-demo-notice';
      main.prepend(el);
    }
    const scenario = state?.demoProfile?.scenario || 'starter';
    const label = scenario === 'active' ? 'Active sample progress' : scenario === 'fresh' ? 'Fresh demo state' : 'Built-in starter state';
    el.innerHTML = \`<div><h2>Public demonstration · fictional learners only</h2><p>This build uses Jordan, Avery, and Demo Family. Changes stay in this browser's local storage; there are no accounts, cloud student records, tracking, or required network services.</p><span class="blh1033-demo-status" data-testid="demo-scenario-status">\${escapeHtml(label)}</span></div><div class="blh1033-demo-actions"><button class="btn primary" id="loadDemoFamilyBtn" data-testid="load-demo-family">Load Demo Family</button><button class="btn" id="resetDemoDataBtn" data-testid="reset-demo-data">Reset Demo Data</button></div>\`;
  }
  function renderV1033ReleaseNote(){
    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.33-demo-foundation"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.33-demo-foundation"><b>v10.33 Repository + Demo Foundation</b><p>Added deterministic Load Demo Family and Reset Demo Data controls, persistent public-demo privacy language, browser-local scenario status, reproducible dependency locking, and automated demo persistence coverage.</p></div>');
    }
  }

  function renderAll(){
`, 'demo helpers');
  text = replaceOnce(text, '    renderData();\n    applyRoleDomGuard();\n', '    renderData();\n    renderDemoNotice();\n    renderV1033ReleaseNote();\n    applyRoleDomGuard();\n', 'render hooks');
  text = replaceOnce(text, `        <section class="panel full">
          <h2>Danger zone</h2>
          <p>Reset only affects this browser. Export first if you want a backup.</p>
          <button class="btn danger" id="resetBtn">Reset to starter demo data</button>
        </section>`, `        <section class="panel full blh1033-demo-panel">
          <h2>Public demo controls</h2>
          <p><b>Load Demo Family</b> replaces this browser's app state with deterministic sample progress. <b>Reset Demo Data</b> returns to a clean fictional family. Both actions affect only this browser and never upload student records.</p>
          <div class="row wrap">
            <button class="btn primary" id="loadDemoFamilyDataBtn" data-testid="load-demo-family-data">Load Demo Family</button>
            <button class="btn danger" id="resetDemoDataAdminBtn" data-testid="reset-demo-data-admin">Reset Demo Data</button>
          </div>
          <p class="tiny muted">Export first when you need to preserve the current browser state.</p>
        </section>`, 'data controls');
  text = replaceOnce(text, `  function resetDemo(){
    if (!confirm('Reset this browser to starter demo data?')) return;
    state = seedProgress(clone(defaultState));
    saveState();
    toast('Reset complete');
  }
`, '', 'old reset');
  text = replaceOnce(text, "    if (e.target.id === 'resetBtn') resetDemo();\n", "    if (e.target.id === 'loadDemoFamilyBtn' || e.target.id === 'loadDemoFamilyDataBtn') loadDemoFamily();\n    if (e.target.id === 'resetDemoDataBtn' || e.target.id === 'resetDemoDataAdminBtn') resetDemo();\n", 'demo clicks');
  text = replaceOnce(text, "version:'v10.32',", "version:'v10.33',", 'release version marker');
  text = replaceOnce(text, '<html lang="en" data-demo-build="synthetic">', '<html lang="en" data-demo-build="synthetic" data-release="v10.33">', 'html release marker');
  await mkdir(path.dirname(manifest.output), { recursive: true });
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} from ${manifest.base} using ${manifest.builder}`);
}
