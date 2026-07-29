import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));

if (manifest.builder) {
  const moduleUrl = pathToFileURL(path.resolve(manifest.builder)).href;
  const releaseBuilder = await import(moduleUrl);
  if (typeof releaseBuilder.buildRelease !== 'function') throw new Error(`Release builder has no buildRelease export: ${manifest.builder}`);
  await releaseBuilder.buildRelease(manifest);
} else {
  throw new Error(`Current release manifest requires a builder: ${current.manifest}`);
}
