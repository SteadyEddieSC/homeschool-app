import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1038 } from './build-v10.38.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.39 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function browserOfflineRuntimeModuleScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) throw new Error('v10.39 offline-runtime module contains an unsupported browser export');
  return `<script data-blh-offline-runtime="v10.39" data-blh-offline-runtime-schema="1">\n(function(){\n  'use strict';\n${browserSource}\n  const runtime = installOfflineRuntimeGuard(window, { blockExternal:true });\n  window.BLHOfflineRuntime = Object.freeze({\n    BLH_OFFLINE_RUNTIME_VERSION,\n    BLH_OFFLINE_RUNTIME_POLICY,\n    BLH_OFFLINE_RUNTIME_SCHEMA,\n    BLHOfflineRuntimeError,\n    classifyOfflineRequest,\n    createOfflineRuntimeLedger,\n    recordOfflineRequest,\n    snapshotOfflineRuntimeLedger,\n    snapshot: runtime.snapshot,\n    reset: runtime.reset\n  });\n})();\n</script>\n`;
}

const OFFLINE_RUNTIME_STYLES = `<style id="blh-v1039-offline-runtime-styles">\n  .blh1039-offline-status{display:inline-flex;align-items:center;min-height:30px;padding:5px 10px;margin-left:8px;border:1px solid rgba(74,222,128,.42);border-radius:999px;background:rgba(74,222,128,.08);font-size:.78rem;font-weight:900;color:var(--text);vertical-align:middle}\n  .blh1039-offline-status[data-blocked-count]:not([data-blocked-count="0"]){border-color:rgba(245,158,11,.58);background:rgba(245,158,11,.10)}\n  @media(max-width:650px){.blh1039-offline-status{margin:7px 0 0;width:max-content;max-width:100%;white-space:normal}}\n</style>`;

export function transformV1039(source, moduleSource, uiSource) {
  let text = source.split('10.38').join('10.39');
  text = text
    .replaceAll('data-release="v10.39-family-planner"', 'data-release="v10.38-family-planner"')
    .replaceAll('<b>v10.39 Family/Co-op Planner v1</b>', '<b>v10.38 Family/Co-op Planner v1</b>');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.39" data-route-contract="v10.39" data-destination-stability="v10.39" data-data-adapter="v10.39" data-data-schema="1" data-knowledge-check-builder="v10.39" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39" data-lesson-pack-schema="1" data-family-planner="v10.39" data-family-planner-schema="1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.39" data-route-contract="v10.39" data-destination-stability="v10.39" data-data-adapter="v10.39" data-data-schema="1" data-knowledge-check-builder="v10.39" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39" data-lesson-pack-schema="1" data-family-planner="v10.39" data-family-planner-schema="1" data-offline-runtime="v10.39" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.39">',
    'offline runtime release contract marker'
  );
  text = replaceOnce(text, '</head>', `${OFFLINE_RUNTIME_STYLES}\n</head>`, 'offline runtime styles');

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(text, mainScriptAnchor, `${browserOfflineRuntimeModuleScript(moduleSource)}${mainScriptAnchor}`, 'offline runtime browser module');

  const savedThemeAnchor = "  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';";
  text = replaceOnce(text, savedThemeAnchor, `${uiSource.trimEnd()}\n\n${savedThemeAnchor}`, 'offline runtime UI injection');
  return text;
}

export async function buildRelease(manifest) {
  const v1038 = JSON.parse(await readFile('source/releases/v10.38/release.json', 'utf8'));
  await buildV1038({ ...v1038, output: manifest.output });
  const [source, moduleSource, uiSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/offline-runtime.mjs', 'utf8'),
    readFile('modules/offline-runtime-ui.js', 'utf8')
  ]);
  const text = transformV1039(source, moduleSource, uiSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.39 modular offline runtime and regression foundation`);
}
