import { readFile } from 'node:fs/promises';

const files = [
  'modules/offline-runtime.mjs',
  'modules/offline-runtime-ui.js',
  'scripts/build-v10.39.mjs',
  'scripts/check-offline-runtime.mjs',
  'scripts/check-v10.39-privacy.mjs',
  'tests/offline-runtime.test.mjs',
  'tests/offline-runtime.spec.mjs',
  'tests/visual-baseline.spec.mjs',
  'docs/releases/v10.39-scope.md',
  'docs/roadmap-v10.39-v10.48.md',
  'source/releases/v10.39/README.md',
  'source/releases/v10.39/release.json'
];
const privateTerms = (process.env.BLH_PRIVATE_TERMS || '').split(',').map(value => value.trim()).filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /AKIA[0-9A-Z]{16}/
];
const failures = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lower = text.toLowerCase();
  for (const term of privateTerms) if (lower.includes(term.toLowerCase())) failures.push(`${file}: private term found: ${term}`);
  for (const pattern of secretPatterns) if (pattern.test(text)) failures.push(`${file}: possible secret matched ${pattern}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`v10.39 privacy and secret scan passed across ${files.length} modular/offline surfaces.`);
