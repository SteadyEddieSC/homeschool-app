import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('source/releases/v10.32/release.json', 'utf8'));
const text = await readFile(manifest.source, 'utf8');
const failures = [];
for (const student of manifest.students) {
  if (!text.includes(student.id)) failures.push(`synthetic id missing: ${student.id}`);
  if (!text.includes(student.name)) failures.push(`synthetic name missing: ${student.name}`);
}
for (const term of (process.env.BLH_PRIVATE_TERMS || '').split(',').map(v => v.trim()).filter(Boolean)) {
  if (text.toLowerCase().includes(term.toLowerCase())) failures.push(`private term found: ${term}`);
}
for (const pattern of [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/]) {
  if (pattern.test(text)) failures.push(`possible secret matched ${pattern}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Privacy and secret scan passed.');
