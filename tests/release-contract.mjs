import { readFile } from 'node:fs/promises';

const current = JSON.parse(
  await readFile(new URL('../source/current-release.json', import.meta.url), 'utf8')
);

export const releaseManifest = JSON.parse(
  await readFile(new URL(`../${current.manifest}`, import.meta.url), 'utf8')
);
