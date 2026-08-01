import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1037 } from './build-v10.37.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.38 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function browserFamilyPlannerModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) {
    throw new Error('v10.38 family-planner module contains an unsupported browser export');
  }
  return `<script data-blh-family-planner="v10.38" data-blh-family-planner-schema="1">
(function(){
  'use strict';
${browserSource}
  window.BLHFamilyPlanner = Object.freeze({
    BLH_FAMILY_PLANNER_FORMAT,
    BLH_FAMILY_PLANNER_SCHEMA,
    BLH_FAMILY_PLANNER_KIND,
    BLH_FAMILY_PLANNER_PRODUCT_VERSION,
    BLH_FAMILY_PLANNER_DAYS,
    BLH_FAMILY_PLANNER_MODES,
    BLH_FAMILY_PLANNER_TYPES,
    BLH_FAMILY_PLANNER_STATUSES,
    BLH_FAMILY_PLANNER_TARGET_KINDS,
    BLH_FAMILY_PLANNER_SOURCE_SCREENS,
    BLHFamilyPlannerError,
    normalizeFamilyPlannerItem,
    normalizeFamilyPlannerWeek,
    normalizeFamilyPlannerWorkspace,
    createFamilyPlannerPackage,
    parseFamilyPlannerPackage,
    serializeFamilyPlannerPackage
  });
})();
</script>
`;
}

const FAMILY_PLANNER_STYLES = `<style id="blh-v1038-family-planner-styles">
  .fp-shell{display:grid;gap:16px;min-width:0}.fp-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,rgba(127,209,255,.10),rgba(167,139,250,.09))}.fp-heading h2{margin:.25rem 0 .5rem}.fp-heading p{margin:0;color:var(--muted);max-width:850px}.fp-kicker{font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:var(--muted)}
  .fp-heading-actions,.fp-actions,.fp-item-actions,.fp-shortcuts{display:flex;flex-wrap:wrap;gap:8px}.fp-entry-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;margin-bottom:12px;border:1px solid rgba(127,209,255,.35);border-radius:14px;background:rgba(127,209,255,.07)}.fp-entry-link>div{display:grid;gap:2px}.fp-entry-link span{font-size:.8rem;color:var(--muted)}.fp-boundary{padding:12px 14px;border:1px solid rgba(245,158,11,.45);border-radius:16px;background:rgba(245,158,11,.08);line-height:1.45}.fp-shortcuts{padding:10px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}
  .fp-week-controls{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(180px,.8fr) minmax(260px,1.4fr);gap:12px;align-items:end;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.fp-week-controls label,.fp-filters label{display:grid;gap:6px;font-weight:800;font-size:.84rem}.fp-week-controls select,.fp-filters select{width:100%}.fp-week-stats{display:flex;flex-wrap:wrap;gap:7px}.fp-week-stats span{padding:7px 10px;border:1px solid var(--line);border-radius:999px;font-size:.8rem}.fp-week-stats .warn,.fp-stat.warn{border-color:rgba(255,123,123,.65);background:rgba(255,123,123,.08)}
  .fp-week-notes{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;padding:14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}.fp-filters{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:10px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--panel-2)}
  .fp-workspace{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.75fr);gap:16px;align-items:start;min-width:0}.fp-main,.fp-side{min-width:0}.fp-side{position:sticky;top:12px}.fp-board{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:10px;align-items:start;min-width:0}.fp-day{display:grid;gap:10px;padding:11px;border:1px solid var(--line);border-radius:18px;background:var(--panel);min-width:0}.fp-day-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.fp-day-head h3{margin:0;font-size:1rem}.fp-day-head span{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;background:rgba(127,209,255,.12);font-weight:900}.fp-day-list{display:grid;gap:9px}.fp-day-empty{padding:18px 8px;text-align:center;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:.82rem}
  .fp-item-card{display:grid;gap:9px;padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2);min-width:0}.fp-item-card.archived{opacity:.58}.fp-item-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.fp-item-head h4{margin:3px 0 0;font-size:.95rem;overflow-wrap:anywhere}.fp-item-card p{margin:0;font-size:.84rem;line-height:1.4;overflow-wrap:anywhere}.fp-type{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:900}.fp-item-meta{display:flex;flex-wrap:wrap;gap:5px}.fp-item-meta span,.fp-coop-chip{font-size:.72rem;padding:5px 7px;border:1px solid var(--line);border-radius:9px;overflow-wrap:anywhere}.fp-coop-chip{background:rgba(167,139,250,.08)}.fp-item-actions .btn{min-height:36px;padding:7px 9px}
  .fp-editor{display:grid;gap:14px;padding:15px;border:1px solid var(--line);border-radius:20px;background:var(--panel)}.fp-editor-heading,.fp-block-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.fp-editor-heading h3,.fp-block-heading h4,.fp-block-heading p{margin:0}.fp-block-heading p{margin-top:4px;color:var(--muted);font-size:.82rem}.fp-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.fp-span-2{grid-column:1/-1}.fp-editor .field,.fp-week-notes .field{display:grid;gap:6px}.fp-editor .field>span,.fp-week-notes .field>span{font-weight:800;font-size:.82rem}.fp-editor input,.fp-editor select,.fp-editor textarea,.fp-week-notes textarea{width:100%;box-sizing:border-box}.fp-editor-block{display:grid;gap:11px;padding:12px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.fp-toggle{display:flex;align-items:center;gap:7px;padding:8px;border:1px solid var(--line);border-radius:11px}.fp-toggle input{width:auto}.fp-adult-only{padding:11px;border:1px dashed rgba(167,139,250,.55);border-radius:13px;background:rgba(167,139,250,.06)}.fp-carry-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}.fp-empty{padding:24px;text-align:center;border:1px dashed var(--line);border-radius:18px;background:var(--panel);color:var(--muted)}.fp-empty h3{color:var(--text);margin:0 0 6px}
  .fp-stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.fp-stat{display:grid;gap:4px;padding:16px;border:1px solid var(--line);border-radius:16px;text-align:center;background:var(--panel)}.fp-stat b{font-size:1.7rem}.fp-stat span{font-size:.8rem;color:var(--muted)}.fp-director{display:grid;gap:14px}.fp-day-rollup{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.fp-day-rollup div{display:grid;gap:3px;padding:12px;border:1px solid var(--line);border-radius:12px;text-align:center}.fp-day-rollup b{font-size:1.35rem}.fp-day-rollup span{font-size:.75rem;color:var(--muted)}
  @media(max-width:1250px){.fp-board{grid-template-columns:repeat(3,minmax(190px,1fr))}.fp-workspace{grid-template-columns:minmax(0,1fr) minmax(300px,.7fr)}.fp-filters{grid-template-columns:repeat(3,minmax(140px,1fr))}}
  @media(max-width:980px){.fp-heading{display:grid}.fp-workspace{grid-template-columns:1fr}.fp-side{position:static}.fp-board{grid-template-columns:repeat(2,minmax(0,1fr))}.fp-week-controls{grid-template-columns:1fr 1fr}.fp-week-stats{grid-column:1/-1}.fp-week-notes{grid-template-columns:1fr 1fr}.fp-week-notes .btn{grid-column:1/-1}.fp-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:650px){.fp-heading,.fp-editor{padding:13px;border-radius:18px}.fp-heading-actions,.fp-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.fp-heading-actions .btn,.fp-actions .btn{width:100%}.fp-week-controls,.fp-week-notes,.fp-filters,.fp-board,.fp-form-grid,.fp-carry-row{grid-template-columns:1fr}.fp-span-2{grid-column:auto}.fp-week-stats{grid-column:auto}.fp-board{overflow:visible}.fp-day{min-width:0}.fp-editor-heading,.fp-block-heading{display:grid}.fp-stat-grid,.fp-day-rollup{grid-template-columns:1fr 1fr}.fp-shortcuts{display:grid;grid-template-columns:1fr 1fr}.fp-shortcuts .btn{width:100%}.fp-entry-link{display:grid}.fp-entry-link .btn{width:100%}.fp-item-actions{display:grid;grid-template-columns:1fr 1fr}.fp-item-actions .btn{width:100%}}
</style>`;

export function transformV1038(source, moduleSource, uiSource) {
  let text = source.split('10.37').join('10.38');
  text = text
    .replaceAll('data-release="v10.38-lesson-pack-editor"', 'data-release="v10.37-lesson-pack-editor"')
    .replaceAll('<b>v10.38 Lesson Pack Editor v1</b>', '<b>v10.37 Lesson Pack Editor v1</b>');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.38" data-route-contract="v10.38" data-destination-stability="v10.38" data-data-adapter="v10.38" data-data-schema="1" data-knowledge-check-builder="v10.38" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.38" data-lesson-pack-schema="1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.38" data-route-contract="v10.38" data-destination-stability="v10.38" data-data-adapter="v10.38" data-data-schema="1" data-knowledge-check-builder="v10.38" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.38" data-lesson-pack-schema="1" data-family-planner="v10.38" data-family-planner-schema="1">',
    'family-planner release contract marker'
  );
  text = replaceOnce(text, '</head>', `${FAMILY_PLANNER_STYLES}\n</head>`, 'family-planner styles');
  text = replaceOnce(
    text,
    '      <section class="screen" id="screen-lessonpacks"></section>\n',
    '      <section class="screen" id="screen-lessonpacks"></section>\n      <section class="screen" id="screen-familyplanner"></section>\n',
    'family-planner screen'
  );

  const catalogAnchor = "      {id:'lessonpacks', label:'Lesson Pack Editor', icon:'🧱', group:'teach', roles:['parent','teacher','director','admin'], note:'Structured reversible lesson-pack drafts with sections, practice/lab prompts, media needs, no-equipment paths, and before/after preview'},\n";
  text = replaceOnce(
    text,
    catalogAnchor,
    `${catalogAnchor}      {id:'familyplanner', label:'Family / Co-op Planner', icon:'🗓️', group:'manage', roles:['parent','teacher','director','admin'], note:'Weekly family and co-op coordination board with learner filters, flex/catch-up modes, source-safe carryover, and portable planning packages'},\n`,
    'family-planner catalog entry'
  );

  text = replaceOnce(text, "'access','rubrics','knowledge','lessonpacks','records'", "'access','rubrics','knowledge','lessonpacks','familyplanner','records'", 'student DOM guard');
  text = replaceOnce(text, "const adultOnly=['records','rubrics','knowledge','lessonpacks','permissions'", "const adultOnly=['records','rubrics','knowledge','lessonpacks','familyplanner','permissions'", 'adult-only role audit');
  text = replaceOnce(text, "'yearplan','access','rubrics','knowledge','lessonpacks','updates'", "'yearplan','access','rubrics','knowledge','lessonpacks','familyplanner','updates'", 'student role-audit denylist');

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(
    text,
    mainScriptAnchor,
    `${browserFamilyPlannerModuleScript(moduleSource)}${mainScriptAnchor}`,
    'family-planner browser module'
  );
  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(
    text,
    savedThemeAnchor,
    `${uiSource.trimEnd()}\n\n${savedThemeAnchor}`,
    'family-planner workspace injection'
  );
  return text;
}

export async function buildRelease(manifest) {
  const v1037 = JSON.parse(await readFile('source/releases/v10.37/release.json', 'utf8'));
  await buildV1037({ ...v1037, output: manifest.output });
  const [source, moduleSource, uiCore, uiWorkspace, uiActions] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/family-planner.mjs', 'utf8'),
    readFile('modules/family-planner-ui-core.js', 'utf8'),
    readFile('modules/family-planner-ui-workspace.js', 'utf8'),
    readFile('modules/family-planner-ui-actions.js', 'utf8')
  ]);
  const text = transformV1038(source, moduleSource, `${uiCore}${uiWorkspace}${uiActions}`);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.38 Family/Co-op Planner v1`);
}
