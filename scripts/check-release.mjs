import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const manifest = JSON.parse(await readFile('source/releases/v10.32/release.json', 'utf8'));
const source = await readFile(manifest.source);
const output = await readFile(manifest.output);
const text = source.toString('utf8');
const failures = [];
const digest = createHash('sha256').update(source).digest('hex');
if (digest !== manifest.sha256) failures.push(`sha256 mismatch: ${digest}`);
if (source.length !== manifest.bytes) failures.push(`byte mismatch: ${source.length}`);
if (!source.equals(output)) failures.push('build output differs from release source');
if (!text.includes('Beaufort Learning Harbor v10.32')) failures.push('stable title/version missing');
if (!text.includes("OWNER = 'BLHMobileDock@v10.32'")) failures.push('mobile dock owner missing');
for (const route of ['learn','practice','quiz','proof','feedback']) if (!text.includes(`${route}:`)) failures.push(`route missing: ${route}`);
for (const [index, match] of [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
  const script = match[1].trim();
  if (script) try { new vm.Script(script); } catch (error) { failures.push(`inline script ${index + 1}: ${error.message}`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Release integrity OK: ${manifest.release}`);
