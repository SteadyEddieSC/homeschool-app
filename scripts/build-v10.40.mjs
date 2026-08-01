import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV10391 } from './build-v10.39.1.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.40 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function replaceExactCount(text, oldValue, newValue, expected, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== expected) throw new Error(`v10.40 expected ${expected} ${label} anchors, found ${count}`);
  return text.split(oldValue).join(newValue);
}

function extractBetween(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`v10.40 extraction start missing: ${label}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`v10.40 extraction end missing: ${label}`);
  return text.slice(start + startMarker.length, end);
}

function replaceBlock(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`v10.40 block start missing: ${label}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`v10.40 block end missing: ${label}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function browserRolePolicyModuleScript(moduleSource, catalogExpression) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) throw new Error('v10.40 role-policy module contains an unsupported browser export');
  return `<script data-blh-app-shell-role-policy="v10.40" data-blh-app-shell-role-policy-schema="1">\n(function(){\n  'use strict';\n${browserSource}\n  const policy = createAppShellRolePolicy({ catalog: ${catalogExpression} });\n  window.BLHAppShellPolicy = Object.freeze({\n    version: BLH_APP_SHELL_POLICY_VERSION,\n    schema: BLH_APP_SHELL_POLICY_SCHEMA,\n    roleIds: Object.freeze([...BLH_ROLE_IDS]),\n    roleOptions: policy.roleOptions,\n    catalog: policy.catalog,\n    defaultScreen: policy.defaultScreen,\n    roleCanAccessStatic: policy.roleCanAccessStatic,\n    visibleScreens: policy.visibleScreens,\n    navGroupsForRole: policy.navGroupsForRole,\n    snapshot: policy.snapshot\n  });\n})();\n</script>\n`;
}

export function transformV1040(source, moduleSource) {
  let text = source.split('v10.39.1').join('__BLH_V1040__');
  text = replaceOnce(text, "appVersion: '10.39.1'", "appVersion: '10.40'", 'core app version');
  text = replaceExactCount(text, "productVersion: '10.39.1'", "productVersion: '10.40'", 3, 'portable product-version');
  text = replaceOnce(text, "productVersion:'10.39.1'", "productVersion:'10.40'", 'Family Planner product-version');
  text = text.split('__BLH_V1040__').join('v10.40');

  const catalogExpression = extractBetween(
    text,
    "  function screenCatalog(){\n    // v3.2 role taxonomy: keep screens in the role that actually needs the workflow.\n    // Student mode intentionally excludes adult planning, roster, reporting, import/export, release notes, and diagnostics.\n    return ",
    ";\n  }\n  function navGroupsForRole(role){",
    'screen catalog expression'
  ).trim();

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  text = replaceOnce(text, mainScriptAnchor, `${browserRolePolicyModuleScript(moduleSource, catalogExpression)}${mainScriptAnchor}`, 'app-shell role-policy browser module');

  text = replaceBlock(
    text,
    '  function roleOptions(){',
    '  function ensureUiState(){',
    `  function roleOptions(){\n    return window.BLHAppShellPolicy.roleOptions();\n  }\n`,
    'role options'
  );

  text = replaceBlock(
    text,
    '  function screenCatalog(){',
    '  function navGroupsForRole(role){',
    `  function screenCatalog(){\n    return window.BLHAppShellPolicy.catalog();\n  }\n`,
    'screen catalog'
  );

  text = replaceBlock(
    text,
    '  function navGroupsForRole(role){',
    '  function roleCanAccess(screen, role=activeRole()){',
    `  function navGroupsForRole(role){\n    return window.BLHAppShellPolicy.navGroupsForRole(role, screen => v84NavGroupForScreen(screen, role));\n  }\n\n`,
    'navigation groups'
  );

  text = replaceOnce(
    text,
    "  function roleCanAccess(screen, role=activeRole()){\n    const item = screenCatalog().find(s => s.id === screen);\n    if (!item || !item.roles.includes(role)) return false;",
    "  function roleCanAccess(screen, role=activeRole()){\n    if (!window.BLHAppShellPolicy.roleCanAccessStatic(screen, role)) return false;",
    'static route authorization'
  );
  text = replaceOnce(
    text,
    "    if ((screen === 'lifeskillssettings') && role !== 'parent') return false;\n    if ((screen === 'practical' || screen === 'life-library' || screen.startsWith('life-lib-') || (screen.startsWith('life-') && !screen.startsWith('life-lib-'))) && !(role === 'student' || role === 'parent')) return false;\n",
    '',
    'legacy static role overrides'
  );

  text = replaceBlock(
    text,
    '  function roleDefaultScreen(role=activeRole()){',
    '  function roleIntent(role=activeRole()){',
    `  function roleDefaultScreen(role=activeRole()){\n    return window.BLHAppShellPolicy.defaultScreen(role) || 'home';\n  }\n  window.BLHRolePolicyRuntime = Object.freeze({\n    version:'v10.40',\n    schema:1,\n    canAccess:(screen, role=activeRole()) => roleCanAccess(screen, role),\n    staticCanAccess:(screen, role=activeRole()) => window.BLHAppShellPolicy.roleCanAccessStatic(screen, role),\n    defaultScreen:(role=activeRole()) => roleDefaultScreen(role),\n    roleOptions:() => roleOptions(),\n    catalog:() => screenCatalog(),\n    navGroups:(role=activeRole()) => navGroupsForRole(role),\n    snapshot:() => ({\n      ...window.BLHAppShellPolicy.snapshot(),\n      activeRole:activeRole(),\n      runtimeScreensByRole:Object.fromEntries(window.BLHAppShellPolicy.roleIds.map(role => [role, screenCatalog().filter(screen => roleCanAccess(screen.id, role)).map(screen => screen.id)]))\n    })\n  });\n  function renderV1040ReleaseNote(){\n    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');\n    if (list && !list.querySelector('[data-release=\"v10.40-role-policy\"]')) {\n      list.insertAdjacentHTML('afterbegin', '<div class=\"v27-release-item\" data-release=\"v10.40-role-policy\"><b>v10.40 App Shell + Role Policy Module</b><p>Centralized role metadata, screen catalog membership, static route authorization, role defaults, and navigation-group policy behind one tested runtime contract without changing current role outcomes.</p></div>');\n    }\n  }\n  const v1040BaseRenderAll = renderAll;\n  renderAll = function(){\n    v1040BaseRenderAll();\n    renderV1040ReleaseNote();\n  };\n`,
    'role default and runtime bridge'
  );

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.40" data-route-contract="v10.40" data-destination-stability="v10.40" data-data-adapter="v10.40" data-data-schema="1" data-knowledge-check-builder="v10.40" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.40" data-lesson-pack-schema="1" data-family-planner="v10.40" data-family-planner-schema="1" data-offline-runtime="v10.40" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.40" data-console-stability="v10.40" data-legacy-observers-retired="9" data-legacy-polls-retired="15" data-media-class-stability="v10.40">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.40" data-route-contract="v10.40" data-destination-stability="v10.40" data-data-adapter="v10.40" data-data-schema="1" data-knowledge-check-builder="v10.40" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.40" data-lesson-pack-schema="1" data-family-planner="v10.40" data-family-planner-schema="1" data-offline-runtime="v10.40" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.40" data-console-stability="v10.40" data-legacy-observers-retired="9" data-legacy-polls-retired="15" data-media-class-stability="v10.40" data-app-shell-role-policy="v10.40" data-app-shell-role-policy-schema="1">',
    'app-shell role-policy release marker'
  );

  return text;
}

export async function buildRelease(manifest) {
  const v10391 = JSON.parse(await readFile('source/releases/v10.39.1/release.json', 'utf8'));
  await buildV10391({ ...v10391, output: manifest.output });
  const [source, moduleSource] = await Promise.all([
    readFile(manifest.output, 'utf8'),
    readFile('modules/app-shell-role-policy.mjs', 'utf8')
  ]);
  const text = transformV1040(source, moduleSource);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.40 app-shell and role-policy module`);
}
