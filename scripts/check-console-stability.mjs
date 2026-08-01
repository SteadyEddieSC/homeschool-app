import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const text = await readFile(manifest.output, 'utf8');
const failures = [];

if (!manifest.consoleStability) failures.push('console stability manifest contract missing');
if (!text.includes(`data-console-stability="${manifest.consoleStability}"`)) failures.push('console stability document marker missing');
if (!text.includes(`data-legacy-observers-retired="${manifest.legacyObserversRetired}"`)) failures.push('retired legacy observer document marker missing');
if (!text.includes(`data-legacy-polls-retired="${manifest.legacyPollsRetired}"`)) failures.push('retired legacy poll document marker missing');

const binding = new RegExp(
  `const\\s+TITLE=['"]Beaufort Learning Harbor ${manifest.release.replaceAll('.', '\\.')}['"];\\s*` +
  `const\\s+APP=['"]Beaufort Learning Harbor['"];\\s*` +
  `const\\s+VERSION=['"]${manifest.release.replaceAll('.', '\\.')}['"];\\s*` +
  'const\\s+FLOW_STEPS='
);
if (!binding.test(text)) failures.push('legacy learning-path VERSION binding missing');

const retiredObserverMarker = `${manifest.release} legacy observer retired`;
const retiredObserverCount = text.split(retiredObserverMarker).length - 1;
if (retiredObserverCount !== manifest.legacyObserversRetired) {
  failures.push(`retired legacy observer count mismatch: ${retiredObserverCount}`);
}

const retiredPollMarker = `${manifest.release} legacy poll retired`;
const retiredPollCount = text.split(retiredPollMarker).length - 1;
if (retiredPollCount !== manifest.legacyPollsRetired) {
  failures.push(`retired legacy poll count mismatch: ${retiredPollCount}`);
}

const observerScripts = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.includes('MutationObserver'));
for (let index = 0; index < manifest.legacyObserversRetired; index += 1) {
  if (!observerScripts[index]) {
    failures.push(`legacy observer script ${index + 1} missing`);
    continue;
  }
  if (/\b[A-Za-z_$][\w$]*\.observe\(document\.body,/.test(observerScripts[index])) {
    failures.push(`legacy observer script ${index + 1} remains active`);
  }
}
for (let index = 0; index < manifest.legacyPollsRetired; index += 1) {
  if (!observerScripts[index]) {
    failures.push(`legacy polling script ${index + 1} missing`);
    continue;
  }
  if (/\bsetInterval\s*\(/.test(observerScripts[index])) {
    failures.push(`legacy polling script ${index + 1} remains active`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Console stability OK: ${manifest.release} · ${manifest.legacyObserversRetired} legacy observers and ${manifest.legacyPollsRetired} legacy polls retired`
);
