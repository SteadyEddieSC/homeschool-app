import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const [text, moduleSource, uiSource, browserSpec, visualSpec, packageJson] = await Promise.all([
  readFile(manifest.output, 'utf8'),
  readFile('modules/offline-runtime.mjs', 'utf8'),
  readFile('modules/offline-runtime-ui.js', 'utf8'),
  readFile('tests/offline-runtime.spec.mjs', 'utf8'),
  readFile('tests/visual-baseline.spec.mjs', 'utf8'),
  readFile('package.json', 'utf8')
]);
const failures = [];

if (manifest.offlineRuntime !== manifest.release) failures.push('offline runtime version must match the active release');
if (manifest.offlineRuntimeSchema !== 1) failures.push('offline runtime schema must remain 1');
if (manifest.offlinePolicy !== 'same-origin-and-embedded') failures.push('offline runtime policy mismatch');
if (manifest.visualBaselines !== manifest.release) failures.push('visual baseline contract must match the active release');

for (const marker of [
  `data-offline-runtime="${manifest.offlineRuntime}"`,
  `data-offline-runtime-schema="${manifest.offlineRuntimeSchema}"`,
  `data-offline-policy="${manifest.offlinePolicy}"`,
  `data-visual-baselines="${manifest.visualBaselines}"`,
  `data-blh-offline-runtime="${manifest.offlineRuntime}"`,
  `data-blh-offline-runtime-schema="${manifest.offlineRuntimeSchema}"`,
  'window.BLHOfflineRuntime = Object.freeze',
  'offline-runtime-status',
  'Offline-ready · no external runtime requests',
  'EXTERNAL_NETWORK_BLOCKED',
  'blh:offline-runtime',
  'v10.39 Modularization + Offline Regression Foundation'
]) {
  if (!text.includes(marker)) failures.push(`offline runtime marker missing: ${marker}`);
}

for (const marker of [
  "scope.fetch = function blhOfflineFetch",
  "xhrPrototype.open = function blhOfflineXhrOpen",
  "scope.navigator.sendBeacon = function blhOfflineSendBeacon",
  "BLH_OFFLINE_RUNTIME_POLICY = 'same-origin-and-embedded'",
  'snapshotOfflineRuntimeLedger',
  'installOfflineRuntimeGuard'
]) {
  if (!moduleSource.includes(marker)) failures.push(`offline runtime module contract missing: ${marker}`);
}

if (!uiSource.includes("window.addEventListener('blh:offline-runtime'")) failures.push('offline runtime status event listener missing');
if (!browserSpec.includes('context.setOffline(true)')) failures.push('explicit browser offline-mode test missing');
if (!browserSpec.includes('https://example.invalid/collect')) failures.push('external request rejection test missing');
for (const marker of ['PNG.sync.read', 'student-jordan-home-path', 'student-avery-botany-target', 'parent-planner-heading', 'director-planner-rollup']) {
  if (!visualSpec.includes(marker)) failures.push(`visual baseline contract missing: ${marker}`);
}
if (!packageJson.includes('"pngjs": "7.0.0"')) failures.push('pinned PNG comparison dependency missing');
if (/<script\b[^>]*\bsrc\s*=/i.test(text)) failures.push('standalone release must not load external script files');
if (/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["']https?:/i.test(text)) failures.push('standalone release must not load external stylesheets');
if (/navigator\.serviceWorker\.register\s*\(/.test(text)) failures.push('v10.39 must not introduce a service worker');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Offline runtime contract OK: ${manifest.offlineRuntime} · policy ${manifest.offlinePolicy} · visual baselines ${manifest.visualBaselines}`);
