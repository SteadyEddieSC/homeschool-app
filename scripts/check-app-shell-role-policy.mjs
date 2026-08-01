import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const text = await readFile(manifest.output, 'utf8');
const failures = [];

const required = [
  `data-app-shell-role-policy="${manifest.appShellRolePolicy}"`,
  `data-app-shell-role-policy-schema="${manifest.appShellRolePolicySchema}"`,
  `data-blh-app-shell-role-policy="${manifest.appShellRolePolicy}"`,
  'window.BLHAppShellPolicy = Object.freeze',
  'window.BLHRolePolicyRuntime = Object.freeze',
  'return window.BLHAppShellPolicy.roleOptions();',
  'return window.BLHAppShellPolicy.catalog();',
  'return window.BLHAppShellPolicy.navGroupsForRole(role, screen => v84NavGroupForScreen(screen, role));',
  'if (!window.BLHAppShellPolicy.roleCanAccessStatic(screen, role)) return false;',
  "return window.BLHAppShellPolicy.defaultScreen(role) || 'home';",
  `${manifest.appShellRolePolicy} App Shell + Role Policy Module`
];
for (const marker of required) if (!text.includes(marker)) failures.push(`missing app-shell role-policy marker: ${marker}`);

const retired = [
  "const item = screenCatalog().find(s => s.id === screen);\n    if (!item || !item.roles.includes(role)) return false;",
  "if ((screen === 'lifeskillssettings') && role !== 'parent') return false;",
  "if (role === 'student') return 'home';\n    if (role === 'parent') return 'home';",
  'const labelsByRole = {'
];
for (const marker of retired) if (text.includes(marker)) failures.push(`legacy duplicated role-policy path remains active: ${marker}`);

if (manifest.appShellRolePolicy !== manifest.release) failures.push(`role-policy version must match active release: ${manifest.appShellRolePolicy}`);
if (manifest.appShellRolePolicySchema !== 1) failures.push(`unexpected role-policy schema: ${manifest.appShellRolePolicySchema}`);
if (!text.includes("roleIds: Object.freeze([...BLH_ROLE_IDS])")) failures.push('read-only role id surface missing');
if (!text.includes("unknown") && !text.includes('roleCanAccessStatic')) failures.push('fail-closed role policy surface missing');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`App-shell role-policy integrity OK: ${manifest.appShellRolePolicy} schema ${manifest.appShellRolePolicySchema}`);
