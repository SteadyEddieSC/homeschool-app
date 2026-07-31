import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const failures = [];
const privateTerms = (process.env.BLH_PRIVATE_TERMS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function addIfFile(files, candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return;
  try {
    if ((await stat(candidate)).isFile()) files.add(candidate);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const files = new Set([
  'source/current-release.json',
  current.manifest,
  'package.json',
  'modules/data-adapter.mjs',
  'scripts/build-v10.35.mjs',
  'tests/data-adapter.test.mjs',
  'tests/data-workflow.spec.mjs'
]);

await addIfFile(files, manifest.output);
await addIfFile(files, manifest.base);
await addIfFile(files, manifest.builder);
for (const directory of ['fixtures', 'source/releases']) {
  for (const file of await walk(directory)) {
    if (/\.(?:json|html|txt|md)$/i.test(file)) files.add(file);
  }
}

for (const file of [...files].sort()) {
  const text = await readFile(file, 'utf8');
  const lower = text.toLowerCase();
  for (const term of privateTerms) {
    if (lower.includes(term.toLowerCase())) failures.push(`${file}: private term found: ${term}`);
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) failures.push(`${file}: possible secret matched ${pattern}`);
  }
}

for (const fixturePath of ['fixtures/demo-family-active.json', 'fixtures/demo-family-fresh.json']) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  if (fixture.family?.name !== 'Demo Family') failures.push(`${fixturePath}: family must remain Demo Family`);
  const names = Array.isArray(fixture.students) ? fixture.students.map(student => student.name) : [];
  for (const requiredName of ['Jordan', 'Avery']) {
    if (!names.includes(requiredName)) failures.push(`${fixturePath}: synthetic student missing: ${requiredName}`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Privacy and secret scan passed across ${files.size} current data surfaces.`);
