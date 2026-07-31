import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1035 } from './build-v10.35.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.36 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function browserKnowledgeModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) {
    throw new Error('v10.36 knowledge-check module contains an unsupported browser export');
  }
  return `<script data-blh-knowledge-check-bank="v10.36" data-blh-knowledge-check-schema="1">
(function(){
  'use strict';
${browserSource}
  window.BLHKnowledgeChecks = Object.freeze({
    BLH_KNOWLEDGE_CHECK_FORMAT,
    BLH_KNOWLEDGE_CHECK_SCHEMA,
    BLH_KNOWLEDGE_CHECK_KIND,
    BLH_KNOWLEDGE_CHECK_PRODUCT_VERSION,
    BLH_KNOWLEDGE_CHECK_TYPES,
    BLHKnowledgeCheckError,
    normalizeKnowledgeCheckPrompt,
    normalizeKnowledgeCheckPrompts,
    createKnowledgeCheckBank,
    parseKnowledgeCheckBank,
    serializeKnowledgeCheckBank
  });
})();
</script>
`;
}

const KNOWLEDGE_STYLES = `<style id="blh-v1036-knowledge-check-styles">
  .kc-shell{display:grid;gap:16px}
  .kc-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,rgba(127,209,255,.09),rgba(167,139,250,.08))}
  .kc-heading h2{margin:.25rem 0 .5rem}
  .kc-heading p{margin:0;color:var(--muted);max-width:800px}
  .kc-kicker,.kc-preview-kicker{font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:var(--muted)}
  .kc-heading-actions,.kc-actions{display:flex;flex-wrap:wrap;gap:8px}
  .kc-boundary{padding:12px 14px;border:1px solid rgba(245,158,11,.45);border-radius:16px;background:rgba(245,158,11,.08);line-height:1.45}
  .kc-workspace{display:grid;grid-template-columns:minmax(240px,330px) minmax(0,1fr);gap:16px;align-items:start}
  .kc-bank-panel,.kc-editor-panel{border:1px solid var(--line);border-radius:22px;background:var(--panel);padding:16px;min-width:0}
  .kc-editor-panel{display:grid;gap:16px}
  .kc-panel-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .kc-panel-title h3{margin:0}
  .kc-panel-title span{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:999px;background:rgba(127,209,255,.14);font-weight:900}
  .kc-prompt-list{display:grid;gap:8px;max-height:70vh;overflow:auto;scrollbar-width:none}
  .kc-prompt-list::-webkit-scrollbar{display:none}
  .kc-prompt-row{display:grid;gap:4px;text-align:left;width:100%;padding:12px;border:1px solid var(--line);border-radius:14px;background:transparent;color:inherit;cursor:pointer}
  .kc-prompt-row:hover,.kc-prompt-row.active{border-color:var(--accent);background:rgba(127,209,255,.09)}
  .kc-prompt-title{font-weight:900}
  .kc-prompt-meta,.kc-edit-hint{font-size:.78rem;color:var(--muted)}
  .kc-edit-hint{font-weight:800;color:var(--accent)}
  .kc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .kc-span-2{grid-column:1/-1}
  .kc-editor .field{display:grid;gap:6px}
  .kc-editor .field>span{font-weight:800;font-size:.86rem}
  .kc-editor input,.kc-editor select,.kc-editor textarea{width:100%;box-sizing:border-box}
  .kc-adult-field{padding:12px;border:1px dashed rgba(167,139,250,.55);border-radius:14px;background:rgba(167,139,250,.06)}
  .kc-student-card{display:grid;gap:14px;padding:18px;border:2px solid rgba(34,197,94,.35);border-radius:20px;background:rgba(34,197,94,.055)}
  .kc-student-card h3,.kc-student-card h4,.kc-student-card p{margin:0}
  .kc-student-card section{display:grid;gap:5px}
  .kc-meta{display:flex;flex-wrap:wrap;gap:7px}
  .kc-meta span{padding:5px 9px;border-radius:999px;border:1px solid var(--line);font-size:.78rem}
  .kc-review-note{padding:10px 12px;border-radius:12px;background:rgba(34,197,94,.1);font-size:.85rem}
  .kc-empty{padding:24px;text-align:center;border:1px dashed var(--line);border-radius:16px;color:var(--muted)}
  .kc-empty h3{margin:0 0 7px;color:var(--text)}
  .kc-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .kc-stat{display:grid;gap:4px;padding:16px;border:1px solid var(--line);border-radius:16px;text-align:center}
  .kc-stat b{font-size:1.7rem}
  .kc-stat span{font-size:.82rem;color:var(--muted)}
  .kc-director{display:grid;gap:14px}
  @media(max-width:900px){.kc-heading{display:grid}.kc-workspace{grid-template-columns:1fr}.kc-prompt-list{max-height:320px}.kc-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:600px){.kc-heading,.kc-bank-panel,.kc-editor-panel{padding:13px;border-radius:18px}.kc-heading-actions,.kc-actions{display:grid;grid-template-columns:1fr 1fr;width:100%}.kc-heading-actions .btn,.kc-actions .btn{width:100%}.kc-form-grid{grid-template-columns:1fr}.kc-span-2{grid-column:auto}.kc-stat-grid{grid-template-columns:1fr 1fr}.kc-student-card{padding:14px}.kc-workspace{gap:12px}}
</style>`;

export function transformV1036(source, moduleSource, uiSource) {
  let text = source.split('10.35').join('10.36');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.36" data-route-contract="v10.36" data-destination-stability="v10.36" data-data-adapter="v10.36" data-data-schema="1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.36" data-route-contract="v10.36" data-destination-stability="v10.36" data-data-adapter="v10.36" data-data-schema="1" data-knowledge-check-builder="v10.36" data-knowledge-check-schema="1">',
    'knowledge-check release contract marker'
  );

  text = replaceOnce(text, '</head>', `${KNOWLEDGE_STYLES}\n</head>`, 'knowledge-check styles');

  text = replaceOnce(
    text,
    '      <section class="screen" id="screen-rubrics"></section>\n',
    '      <section class="screen" id="screen-rubrics"></section>\n      <section class="screen" id="screen-knowledge"></section>\n',
    'knowledge-check screen'
  );

  const catalogAnchor = "      {id:'rubrics', label:'Rubric Studio', icon:'🧾', group:'manage', roles:['parent','teacher','director','admin'], note:'Assessment Builder / Rubric Studio v2 with evidence reviews, reusable rubrics, report notes, and role-fit UI audit'},\n";
  text = replaceOnce(
    text,
    catalogAnchor,
    `${catalogAnchor}      {id:'knowledge', label:'Knowledge Checks', icon:'🗣️', group:'manage', roles:['parent','teacher','director','admin'], note:'Adult-reviewed recitation, discussion, notebook, project, oral tell-back, and mastery-proof prompt builder'},\n`,
    'knowledge-check screen catalog entry'
  );

  text = replaceOnce(
    text,
    "'access','rubrics','records'",
    "'access','rubrics','knowledge','records'",
    'student DOM guard'
  );
  text = replaceOnce(
    text,
    "const adultOnly=['records','rubrics','permissions'",
    "const adultOnly=['records','rubrics','knowledge','permissions'",
    'adult-only role audit'
  );
  text = replaceOnce(
    text,
    "'yearplan','access','rubrics','updates'",
    "'yearplan','access','rubrics','knowledge','updates'",
    'student role-audit denylist'
  );

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(
    text,
    mainScriptAnchor,
    `${browserKnowledgeModuleScript(moduleSource)}${mainScriptAnchor}`,
    'knowledge-check bank browser module'
  );

  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(
    text,
    savedThemeAnchor,
    `${uiSource.trimEnd()}\n\n${savedThemeAnchor}`,
    'knowledge-check workspace injection'
  );

  return text;
}

export async function buildRelease(manifest) {
  const v1035 = JSON.parse(await readFile('source/releases/v10.35/release.json', 'utf8'));
  await buildV1035({ ...v1035, output: manifest.output });
  const [source, moduleSource, uiSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/knowledge-check-bank.mjs', 'utf8'),
    readFile('modules/knowledge-check-ui.js', 'utf8')
  ]);
  const text = transformV1036(source, moduleSource, uiSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.36 Knowledge Check Builder v1`);
}
