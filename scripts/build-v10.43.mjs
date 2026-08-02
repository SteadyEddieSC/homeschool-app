import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1042 } from './build-v10.42.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.43 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function replaceExactCount(text, oldValue, newValue, expected, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== expected) throw new Error(`v10.43 expected ${expected} ${label} anchors, found ${count}`);
  return text.split(oldValue).join(newValue);
}

function browserLessonPackApplyModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) throw new Error('v10.43 Lesson Pack Controlled Apply module contains an unsupported browser export');
  return `<script data-blh-lesson-pack-apply="v10.43" data-blh-lesson-pack-apply-schema="1">\n(function(){\n  'use strict';\n${browserSource}\n  window.BLHLessonPackApply = Object.freeze({\n    version:BLH_LESSON_PACK_APPLY_VERSION,\n    schema:BLH_LESSON_PACK_APPLY_SCHEMA,\n    limit:BLH_LESSON_PACK_APPLY_LIMIT,\n    roles:BLH_LESSON_PACK_APPLY_ROLES,\n    BLHLessonPackApplyError,\n    normalizeLessonPackControlledApplyWorkspace,\n    listActiveLessonPackOverlays,\n    createLessonPackApplyPlan,\n    fingerprintLessonPackOverlayPlan,\n    applyLessonPackOverlay,\n    rollbackLessonPackOverlay,\n    createStudentSafeLessonPackOverlay\n  });\n})();\n</script>\n`;
}

const LESSON_PACK_APPLY_STYLES = `<style id="blh-v1043-lesson-pack-apply-styles">
  .lpa-shell,.lpa-director-rollup,.lpa-destination-card{display:grid;gap:16px;margin-top:18px;padding:18px;border:1px solid var(--line);border-radius:22px;background:var(--panel)}.lpa-heading,.lpa-card-heading,.lpa-history-head,.lpa-destination-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.lpa-heading h3,.lpa-card-heading h4,.lpa-history-head p,.lpa-destination-heading h3,.lpa-destination-heading p{margin:.2rem 0 0}.lpa-grid,.lpa-compare{display:grid;grid-template-columns:1fr 1fr;gap:14px}.lpa-review-card,.lpa-compare>article,.lpa-history-card{display:grid;gap:12px;padding:15px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--panel) 88%,transparent)}.lpa-check-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.lpa-check-list label,.lpa-attest{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border:1px solid var(--line);border-radius:12px}.lpa-check-list input,.lpa-attest input{margin-top:.18rem;flex:0 0 auto}.lpa-warning{padding:12px 14px;border:1px solid rgba(255,174,66,.7);border-radius:14px;background:rgba(255,174,66,.1)}.lpa-confirm-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px;border:1px solid var(--line);border-radius:16px}.lpa-confirm-row ul{margin:.35rem 0 0;padding-left:1.25rem}.lpa-history,.lpa-history-list{display:grid;gap:12px}.lpa-history-card[data-overlay-status="active"]{border-color:rgba(92,199,145,.7)}.lpa-history-card[data-overlay-status="rolled-back"]{opacity:.82}.lpa-no-equipment{padding:12px;border-left:4px solid var(--accent);background:rgba(100,160,255,.08);border-radius:10px}.lpa-destination-card{margin:18px 0}.lpa-destination-card section{display:grid;gap:6px}.lpa-destination-card section h4,.lpa-destination-card section p{margin:0}.lpa-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.lpa-stat-grid>div{display:grid;gap:4px;padding:12px;border:1px solid var(--line);border-radius:14px;text-align:center}.lpa-stat-grid b{font-size:1.4rem}.lpa-stat-grid span,.lpa-destination-list span{font-size:.78rem;color:var(--muted)}.lpa-destination-list{display:flex;flex-wrap:wrap;gap:7px}.lpa-destination-list span{padding:7px 9px;border:1px solid var(--line);border-radius:999px}
  @media(max-width:820px){.lpa-grid,.lpa-compare,.lpa-check-list,.lpa-stat-grid{grid-template-columns:1fr}.lpa-heading,.lpa-card-heading,.lpa-history-head,.lpa-destination-heading,.lpa-confirm-row{display:grid}.lpa-confirm-row .btn{width:100%}}
</style>`;

export function transformV1043(source, moduleSource, uiSource) {
  let text = source
    .replaceAll('data-release="v10.42-family-planner-v2"', 'data-release="__BLH_HISTORY_V1042__"')
    .replaceAll('<b>v10.42 Family Planner v2</b>', '<b>__BLH_HISTORY_V1042_TITLE__</b>');

  text = text.split('v10.42').join('v10.43');
  text = replaceOnce(text, "appVersion: '10.42'", "appVersion: '10.43'", 'core app version');
  text = replaceExactCount(text, "productVersion: '10.42'", "productVersion: '10.43'", 3, 'portable product-version');
  text = replaceOnce(text, "productVersion:'10.42'", "productVersion:'10.43'", 'Family Planner product-version');
  text = text
    .replaceAll('data-release="__BLH_HISTORY_V1042__"', 'data-release="v10.42-family-planner-v2"')
    .replaceAll('<b>__BLH_HISTORY_V1042_TITLE__</b>', '<b>v10.42 Family Planner v2</b>')
    .replaceAll('No live apply occurs in v10.43.', 'No live apply occurs from the draft editor alone; reviewed overlays require Controlled Apply.');

  text = replaceOnce(
    text,
    'data-family-planner-v2-schema="1" data-offline-runtime=',
    'data-family-planner-v2-schema="1" data-lesson-pack-apply="v10.43" data-lesson-pack-apply-schema="1" data-offline-runtime=',
    'Lesson Pack Controlled Apply root schema marker'
  );
  text = replaceOnce(text, '</head>', `${LESSON_PACK_APPLY_STYLES}\n</head>`, 'Lesson Pack Controlled Apply styles');

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(text, mainScriptAnchor, `${browserLessonPackApplyModuleScript(moduleSource)}${mainScriptAnchor}`, 'Lesson Pack Controlled Apply browser module');

  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(text, savedThemeAnchor, `${uiSource.trimEnd()}\n\n${savedThemeAnchor}`, 'Lesson Pack Controlled Apply UI integration');
  return text;
}

export async function buildRelease(manifest) {
  const v1042 = JSON.parse(await readFile('source/releases/v10.42/release.json', 'utf8'));
  await buildV1042({ ...v1042, output: manifest.output });
  const [source, moduleSource, uiSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/lesson-pack-controlled-apply.mjs', 'utf8'),
    readFile('modules/lesson-pack-controlled-apply-ui.js', 'utf8')
  ]);
  const text = transformV1043(source, moduleSource, uiSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.43 Lesson Pack Controlled Apply v1`);
}
