import { access, readFile } from 'node:fs/promises';

const required = [
  'README.md',
  'AGENTS.md',
  'package.json',
  'playwright.config.mjs',
  'source/releases/v10.32/release.json',
  'docs/architecture.md',
  'docs/privacy-and-demo-data.md',
  'docs/test-strategy.md',
  '.github/workflows/validate.yml'
];

for (const path of required) await access(path);
const manifest = JSON.parse(await readFile('source/releases/v10.32/release.json', 'utf8'));
if (manifest.privacy !== 'synthetic-demo-data') throw new Error('release privacy marker is missing');
if (!Array.isArray(manifest.students) || manifest.students.length < 2) throw new Error('synthetic students are missing');
console.log(`Repository foundation OK for ${manifest.release}.`);
