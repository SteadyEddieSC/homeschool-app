import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1036 } from './build-v10.36.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.37 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function browserLessonPackModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) {
    throw new Error('v10.37 lesson-pack module contains an unsupported browser export');
  }
  return `<script data-blh-lesson-pack="v10.37" data-blh-lesson-pack-schema="1">
(function(){
  'use strict';
${browserSource}
  window.BLHLessonPacks = Object.freeze({
    BLH_LESSON_PACK_FORMAT,
    BLH_LESSON_PACK_SCHEMA,
    BLH_LESSON_PACK_KIND,
    BLH_LESSON_PACK_PRODUCT_VERSION,
    BLH_LESSON_PACK_STATUSES,
    BLHLessonPackError,
    normalizeLessonPackSection,
    normalizeLessonPackDraft,
    createLessonPackPackage,
    parseLessonPackPackage,
    serializeLessonPackPackage
  });
})();
</script>
`;
}

const LESSON_PACK_STYLES = `<style id="blh-v1037-lesson-pack-styles">
  .lp-shell{display:grid;gap:16px}
  .lp-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,rgba(142,234,149,.09),rgba(127,209,255,.08))}
  .lp-heading h2{margin:.25rem 0 .5rem}.lp-heading p{margin:0;color:var(--muted);max-width:820px}
  .lp-kicker,.lp-preview-label{font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:var(--muted)}
  .lp-heading-actions,.lp-actions,.lp-mini-actions{display:flex;flex-wrap:wrap;gap:8px}
  .lp-boundary{padding:12px 14px;border:1px solid rgba(245,158,11,.45);border-radius:16px;background:rgba(245,158,11,.08);line-height:1.45}
  .lp-workspace{display:grid;grid-template-columns:minmax(250px,330px) minmax(0,1fr);gap:16px;align-items:start}
  .lp-bank-panel,.lp-main-panel{border:1px solid var(--line);border-radius:22px;background:var(--panel);padding:16px;min-width:0}
  .lp-main-panel{display:grid;gap:16px}.lp-panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.lp-panel-title h3{margin:0}
  .lp-panel-title span{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:999px;background:rgba(142,234,149,.14);font-weight:900}
  .lp-pack-list{display:grid;gap:8px;max-height:75vh;overflow:auto;scrollbar-width:none}.lp-pack-list::-webkit-scrollbar{display:none}
  .lp-pack-row{display:grid;gap:4px;text-align:left;width:100%;padding:12px;border:1px solid var(--line);border-radius:14px;background:transparent;color:inherit;cursor:pointer}
  .lp-pack-row:hover,.lp-pack-row.active{border-color:var(--accent);background:rgba(142,234,149,.08)}
  .lp-pack-title{font-weight:900}.lp-pack-meta,.lp-pack-target{font-size:.78rem;color:var(--muted)}.lp-pack-target{color:var(--accent-2);font-weight:800}
  .lp-editor{display:grid;gap:15px}.lp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lp-span-2{grid-column:1/-1}
  .lp-editor .field{display:grid;gap:6px}.lp-editor .field>span{font-weight:800;font-size:.86rem}.lp-editor input,.lp-editor select,.lp-editor textarea{width:100%;box-sizing:border-box}
  .lp-editor-block{display:grid;gap:12px;padding:14px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}
  .lp-block-heading,.lp-section-head,.lp-preview-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lp-block-heading h3,.lp-block-heading p,.lp-preview-heading h3{margin:0}.lp-block-heading p{color:var(--muted);font-size:.85rem;margin-top:4px}
  .lp-section-stack{display:grid;gap:10px}.lp-section-editor{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:15px;background:rgba(0,0,0,.08)}
  .lp-check-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.lp-check-grid label,.lp-toggle{display:flex;gap:8px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:12px}
  .lp-check-grid input,.lp-toggle input{width:auto}.lp-adult-only{padding:12px;border:1px dashed rgba(167,139,250,.55);border-radius:14px;background:rgba(167,139,250,.06)}
  .lp-preview-shell{display:grid;gap:12px;padding:15px;border:1px solid var(--line);border-radius:20px;background:var(--panel-2)}
  .lp-preview-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px}.lp-before-card,.lp-after-card{display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:17px;background:var(--panel)}
  .lp-before-card{border-style:dashed}.lp-after-card{border-color:rgba(142,234,149,.4)}.lp-before-card h4,.lp-after-card h4,.lp-after-card h5,.lp-before-card p,.lp-after-card p{margin:0}
  .lp-meta{display:flex;gap:7px;flex-wrap:wrap}.lp-meta span{padding:5px 9px;border:1px solid var(--line);border-radius:999px;font-size:.78rem}
  .lp-student-sections{display:grid;gap:10px}.lp-student-sections section,.lp-no-equipment-preview,.lp-media-preview{display:grid;gap:5px;padding:11px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.025)}
  .lp-no-equipment-preview{border-left:4px solid var(--accent)}.lp-safety-note,.lp-copyright-note{padding:10px;border-radius:12px;background:rgba(245,158,11,.08);font-size:.84rem}.lp-copyright-note{background:rgba(142,234,149,.08)}
  .lp-empty{padding:24px;text-align:center;border:1px dashed var(--line);border-radius:16px;color:var(--muted)}.lp-empty h3{margin:0 0 7px;color:var(--text)}
  .lp-stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.lp-stat{display:grid;gap:4px;padding:16px;border:1px solid var(--line);border-radius:16px;text-align:center}.lp-stat b{font-size:1.7rem}.lp-stat span{font-size:.82rem;color:var(--muted)}.lp-director{display:grid;gap:14px}
  @media(max-width:980px){.lp-heading{display:grid}.lp-workspace{grid-template-columns:1fr}.lp-pack-list{max-height:330px}.lp-preview-grid{grid-template-columns:1fr}.lp-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:650px){.lp-heading,.lp-bank-panel,.lp-main-panel{padding:13px;border-radius:18px}.lp-heading-actions,.lp-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.lp-heading-actions .btn,.lp-actions .btn{width:100%}.lp-form-grid,.lp-check-grid{grid-template-columns:1fr}.lp-span-2{grid-column:auto}.lp-stat-grid{grid-template-columns:1fr 1fr}.lp-block-heading,.lp-section-head,.lp-preview-heading{display:grid}.lp-mini-actions{justify-content:start}.lp-before-card,.lp-after-card{padding:13px}}
</style>`;

const LESSON_PACK_NAV_ADAPTER = `  const v1037BaseNavGroupForScreen = v84NavGroupForScreen;
  v84NavGroupForScreen = function(screen, role=activeRole()){
    const id = typeof screen === 'string' ? screen : (screen?.id || '');
    if (id === 'lessonpacks') return role === 'parent' ? 'manage' : 'teach';
    return v1037BaseNavGroupForScreen(screen, role);
  };

`;

export function transformV1037(source, moduleSource, uiSource) {
  let text = source.split('10.36').join('10.37');
  text = text
    .replaceAll('"version": "v10.37", "title": "Knowledge Check Builder v1"', '"version": "v10.36", "title": "Knowledge Check Builder v1"')
    .replaceAll('### v10.37 — Knowledge Check Builder v1', '### v10.36 — Knowledge Check Builder v1')
    .replaceAll('data-release="v10.37-knowledge-check-builder"', 'data-release="v10.36-knowledge-check-builder"')
    .replaceAll('<b>v10.37 Knowledge Check Builder v1</b>', '<b>v10.36 Knowledge Check Builder v1</b>');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.37" data-route-contract="v10.37" data-destination-stability="v10.37" data-data-adapter="v10.37" data-data-schema="1" data-knowledge-check-builder="v10.37" data-knowledge-check-schema="1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.37" data-route-contract="v10.37" data-destination-stability="v10.37" data-data-adapter="v10.37" data-data-schema="1" data-knowledge-check-builder="v10.37" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.37" data-lesson-pack-schema="1">',
    'lesson-pack release contract marker'
  );
  text = replaceOnce(text, '</head>', `${LESSON_PACK_STYLES}\n</head>`, 'lesson-pack styles');
  text = replaceOnce(
    text,
    '      <section class="screen" id="screen-knowledge"></section>\n',
    '      <section class="screen" id="screen-knowledge"></section>\n      <section class="screen" id="screen-lessonpacks"></section>\n',
    'lesson-pack screen'
  );

  const catalogAnchor = "      {id:'knowledge', label:'Knowledge Checks', icon:'🗣️', group:'manage', roles:['parent','teacher','director','admin'], note:'Adult-reviewed recitation, discussion, notebook, project, oral tell-back, and mastery-proof prompt builder'},\n";
  text = replaceOnce(
    text,
    catalogAnchor,
    `${catalogAnchor}      {id:'lessonpacks', label:'Lesson Pack Editor', icon:'🧱', group:'teach', roles:['parent','teacher','director','admin'], note:'Structured reversible lesson-pack drafts with sections, practice/lab prompts, media needs, no-equipment paths, and before/after preview'},\n`,
    'lesson-pack catalog entry'
  );

  text = replaceOnce(text, "'access','rubrics','knowledge','records'", "'access','rubrics','knowledge','lessonpacks','records'", 'student DOM guard');
  text = replaceOnce(text, "const adultOnly=['records','rubrics','knowledge','permissions'", "const adultOnly=['records','rubrics','knowledge','lessonpacks','permissions'", 'adult-only role audit');
  text = replaceOnce(text, "'yearplan','access','rubrics','knowledge','updates'", "'yearplan','access','rubrics','knowledge','lessonpacks','updates'", 'student role-audit denylist');

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(
    text,
    mainScriptAnchor,
    `${browserLessonPackModuleScript(moduleSource)}${mainScriptAnchor}`,
    'lesson-pack browser module'
  );
  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(
    text,
    savedThemeAnchor,
    `${LESSON_PACK_NAV_ADAPTER}${uiSource.trimEnd()}\n\n${savedThemeAnchor}`,
    'lesson-pack workspace injection'
  );
  return text;
}

export async function buildRelease(manifest) {
  const v1036 = JSON.parse(await readFile('source/releases/v10.36/release.json', 'utf8'));
  await buildV1036({ ...v1036, output: manifest.output });
  const [source, moduleSource, uiSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/lesson-pack.mjs', 'utf8'),
    readFile('modules/lesson-pack-ui.js', 'utf8')
  ]);
  const text = transformV1037(source, moduleSource, uiSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.37 Lesson Pack Editor v1`);
}
