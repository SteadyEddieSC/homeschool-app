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
if (!new RegExp(`const\\s+OWNER\\s*=\\s*['"]${manifest.dockOwner.replaceAll('.', '\\.') }['"]`).test(text)) failures.push('mobile dock owner missing');
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
