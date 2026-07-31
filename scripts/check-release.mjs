import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const output = await readFile(manifest.output);
const text = output.toString('utf8');
const failures = [];
const digest = createHash('sha256').update(output).digest('hex');

if (digest !== manifest.sha256) failures.push(`sha256 mismatch: ${digest}`);
if (output.length !== manifest.bytes) failures.push(`byte mismatch: ${output.length}`);
if (!text.includes(manifest.title)) failures.push(`stable title/version missing: ${manifest.title}`);
if (!text.includes(`data-release="${manifest.release}"`)) failures.push(`release marker missing: ${manifest.release}`);
if (!text.includes(`data-demo-build="${manifest.demoBuild}"`)) failures.push('synthetic demo marker missing');
if (manifest.routeContract && !text.includes(`data-route-contract="${manifest.routeContract}"`)) failures.push(`route contract missing: ${manifest.routeContract}`);
if (manifest.destinationStability && !text.includes(`data-destination-stability="${manifest.destinationStability}"`)) failures.push(`destination stability contract missing: ${manifest.destinationStability}`);
if (manifest.dataAdapter && !text.includes(`data-data-adapter="${manifest.dataAdapter}"`)) failures.push(`data adapter contract missing: ${manifest.dataAdapter}`);
if (manifest.dataSchema && !text.includes(`data-data-schema="${manifest.dataSchema}"`)) failures.push(`data schema contract missing: ${manifest.dataSchema}`);
if (!new RegExp(`const\\s+OWNER\\s*=\\s*['"]${manifest.dockOwner.replaceAll('.', '\\.') }['"]`).test(text)) failures.push('mobile dock owner missing');
if (manifest.heroOwner && !new RegExp(`const\\s+OWNER\\s*=\\s*['"]${manifest.heroOwner.replaceAll('.', '\\.') }['"]`).test(text)) failures.push('hero owner missing');
if (manifest.heroOwner && text.includes("const VERSION='v10.32';")) failures.push('legacy v10.32 title writer remains active');
if (manifest.destinationStability && text.includes("atlas.querySelector('.blh-source-gallery')?.remove();")) failures.push('source-media rebuild loop remains active');
if (manifest.destinationStability && text.includes("screen.querySelector('.blh-visual-model')?.remove();")) failures.push('visual-model rebuild loop remains active');
if (manifest.dataAdapter) {
  if (!text.includes('window.BLHDataAdapter = Object.freeze')) failures.push('browser data adapter global missing');
  if (!text.includes("window.BLHDataAdapter.exportState(state, { productVersion: '10.35' })")) failures.push('versioned full export path missing');
  if (!text.includes('window.BLHDataAdapter.parseImport(raw)')) failures.push('validated full import path missing');
  if (text.includes("downloadJson('homeschool-quest-lab-full-data.json', state)")) failures.push('legacy raw full-state export remains active');
  if (text.includes('state = normalize(seedProgress(imported));')) failures.push('legacy direct full-state import remains active');
  if (!text.includes('Download sanitized app data')) failures.push('sanitized export user guidance missing');
}
for (const route of ['learn','practice','quiz','proof','feedback']) {
  if (!new RegExp(`route\\s*:\\s*['"]${route}['"]`).test(text)) failures.push(`dock route missing: ${route}`);
}
for (const marker of ['load-demo-family','reset-demo-data','demo-scenario-status','buildDeterministicDemoState']) {
  if (!text.includes(marker)) failures.push(`v10.33 demo marker missing: ${marker}`);
}
for (const [index, match] of [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
  const script = match[1].trim();
  if (script) try { new vm.Script(script); } catch (error) { failures.push(`inline script ${index + 1}: ${error.message}`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Release integrity OK: ${manifest.release} · ${digest} · ${output.length} bytes`);
