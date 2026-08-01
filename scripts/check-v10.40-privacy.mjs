import { readFile } from 'node:fs/promises';

const files = [
  'modules/app-shell-role-policy.mjs',
  'scripts/build-v10.40.mjs',
  'scripts/check-app-shell-role-policy.mjs',
  'scripts/check-v10.40-privacy.mjs',
  'tests/app-shell-role-policy.test.mjs',
  'tests/app-shell-role-policy.spec.mjs',
  'docs/releases/v10.40-scope.md',
  'docs/curriculum/4-6-preliminary-booklist.md',
  'docs/roadmap-v10.40-v10.49.md',
  'source/releases/v10.40/README.md',
  'source/releases/v10.40/release.json'
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
console.log(`v10.40 privacy and secret scan passed across ${files.length} release surfaces.`);
