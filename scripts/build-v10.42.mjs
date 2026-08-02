import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1041 } from './build-v10.41.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.42 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function replaceExactCount(text, oldValue, newValue, expected, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== expected) throw new Error(`v10.42 expected ${expected} ${label} anchors, found ${count}`);
  return text.split(oldValue).join(newValue);
}

function browserFamilyPlannerV2ModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) throw new Error('v10.42 Family Planner v2 module contains an unsupported browser export');
  return `<script data-blh-family-planner-v2="v10.42" data-blh-family-planner-v2-schema="1">\n(function(){\n  'use strict';\n${browserSource}\n  window.BLHFamilyPlannerV2 = Object.freeze({\n    version:BLH_FAMILY_PLANNER_V2_VERSION,\n    schema:BLH_FAMILY_PLANNER_V2_SCHEMA,\n    templateFormat:BLH_FAMILY_PLANNER_TEMPLATE_FORMAT,\n    BLHFamilyPlannerV2Error,\n    normalizeWeekTemplate,\n    createWeekTemplate,\n    normalizeTemplateLibrary,\n    applyWeekTemplate,\n    copyWeek,\n    analyzeWeek,\n    createLearnerSafePrintModel,\n    createLearnerSafeCsv\n  });\n})();\n</script>\n`;
}

const FAMILY_PLANNER_V2_STYLES = `<style id="blh-v1042-family-planner-v2-styles">
  .fpv2-tools{display:grid;grid-template-columns:1.2fr 1fr .8fr;gap:12px}.fpv2-tool-block,.fpv2-analysis,.fpv2-print-preview{display:grid;gap:12px;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}.fpv2-tool-heading,.fpv2-analysis-head,.fpv2-print-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.fpv2-tool-heading h3,.fpv2-analysis-head h3,.fpv2-print-heading h2{margin:.2rem 0 0}.fpv2-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}.fpv2-tool-grid.compact{grid-template-columns:minmax(180px,1fr)}.fpv2-actions{display:flex;flex-wrap:wrap;gap:8px;grid-column:1/-1}.fpv2-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fpv2-stat-grid>div{display:grid;gap:3px;padding:11px;border:1px solid var(--line);border-radius:12px;text-align:center}.fpv2-stat-grid>div.warn{border-color:rgba(255,123,123,.65);background:rgba(255,123,123,.08)}.fpv2-stat-grid b{font-size:1.35rem}.fpv2-stat-grid span,.fpv2-targets span{font-size:.76rem;color:var(--muted)}.fpv2-targets{display:flex;flex-wrap:wrap;gap:6px}.fpv2-targets span{padding:6px 8px;border:1px solid var(--line);border-radius:999px}.fpv2-warning-list ul{margin:.2rem 0 0;padding-left:1.2rem}.fpv2-warning-list li{margin:.35rem 0}.fpv2-print-days{display:grid;grid-template-columns:repeat(5,minmax(170px,1fr));gap:8px}.fpv2-print-days>section{padding:10px;border:1px solid var(--line);border-radius:14px}.fpv2-print-days h3{margin:0 0 8px}.fpv2-print-days article{display:grid;gap:5px;padding:8px 0;border-top:1px solid var(--line)}.fpv2-print-days article:first-of-type{border-top:0}.fpv2-print-days article>div{display:grid}.fpv2-print-days p,.fpv2-print-days small{margin:0}.fpv2-print-days span,.fpv2-print-days small{color:var(--muted)}
  @media(max-width:1200px){.fpv2-tools{grid-template-columns:1fr 1fr}.fpv2-tool-block:last-child{grid-column:1/-1}.fpv2-print-days{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:760px){.fpv2-tools,.fpv2-tool-grid,.fpv2-stat-grid,.fpv2-print-days{grid-template-columns:1fr}.fpv2-tool-block:last-child{grid-column:auto}.fpv2-tool-heading,.fpv2-analysis-head,.fpv2-print-heading{display:grid}.fpv2-actions{display:grid;grid-template-columns:1fr}.fpv2-actions .btn{width:100%}}
  @media print{body.fpv2-printing *{visibility:hidden!important}body.fpv2-printing .fpv2-print-preview,body.fpv2-printing .fpv2-print-preview *{visibility:visible!important}body.fpv2-printing .fpv2-print-preview{position:absolute;inset:0;width:auto;border:0;background:#fff;color:#000}body.fpv2-printing .fpv2-print-preview .btn{display:none!important}body.fpv2-printing .fpv2-print-days{grid-template-columns:repeat(2,1fr)}body.fpv2-printing .fpv2-print-days>section{break-inside:avoid;border:1px solid #888}}
</style>`;

export function transformV1042(source, moduleSource, uiSource) {
  let text = source
    .replaceAll('data-release="v10.41-learner-route-resolver"', 'data-release="__BLH_HISTORY_V1041__"')
    .replaceAll('<b>v10.41 Learner Route + Assignment Resolver</b>', '<b>__BLH_HISTORY_V1041_TITLE__</b>');

  text = text.split('v10.41').join('v10.42');
  text = replaceOnce(text, "appVersion: '10.41'", "appVersion: '10.42'", 'core app version');
  text = replaceExactCount(text, "productVersion: '10.41'", "productVersion: '10.42'", 3, 'portable product-version');
  text = replaceOnce(text, "productVersion:'10.41'", "productVersion:'10.42'", 'Family Planner product-version');
  text = text
    .replaceAll('data-release="__BLH_HISTORY_V1041__"', 'data-release="v10.41-learner-route-resolver"')
    .replaceAll('<b>__BLH_HISTORY_V1041_TITLE__</b>', '<b>v10.41 Learner Route + Assignment Resolver</b>');

  text = replaceOnce(
    text,
    'data-family-planner="v10.42" data-family-planner-schema="1" data-offline-runtime=',
    'data-family-planner="v10.42" data-family-planner-schema="1" data-family-planner-v2-schema="1" data-offline-runtime=',
    'Family Planner v2 root schema marker'
  );
  text = replaceOnce(text, '</head>', `${FAMILY_PLANNER_V2_STYLES}\n</head>`, 'Family Planner v2 styles');

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(text, mainScriptAnchor, `${browserFamilyPlannerV2ModuleScript(moduleSource)}${mainScriptAnchor}`, 'Family Planner v2 browser module');

  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(text, savedThemeAnchor, `${uiSource.trimEnd()}\n\n${savedThemeAnchor}`, 'Family Planner v2 UI integration');
  return text;
}

export async function buildRelease(manifest) {
  const v1041 = JSON.parse(await readFile('source/releases/v10.41/release.json', 'utf8'));
  await buildV1041({ ...v1041, output: manifest.output });
  const [source, moduleSource, uiSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/family-planner-v2.mjs', 'utf8'),
    readFile('modules/family-planner-v2-ui.js', 'utf8')
  ]);
  const text = transformV1042(source, moduleSource, uiSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.42 Family Planner v2`);
}
