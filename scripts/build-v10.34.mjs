import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV10331 } from './build-v10.33.1.mjs';

function replaceAll(text, oldValue, newValue) {
  return text.split(oldValue).join(newValue);
}

export async function buildRelease(manifest) {
  const v10331 = JSON.parse(await readFile('source/releases/v10.33.1/release.json', 'utf8'));
  await buildV10331({ ...v10331, output: manifest.output });
  let text = await readFile(manifest.output, 'utf8');

  text = replaceAll(text, 'v10.33.1', 'v10.34');
  text = replaceAll(text, '10.33.1', '10.34');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.34">';
  if (!text.includes(htmlAnchor)) throw new Error('v10.34 HTML release anchor missing');
  text = text.replace(htmlAnchor, '<html lang="en" data-demo-build="synthetic" data-release="v10.34" data-route-contract="v10.34">');

  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.34 route and role regression contract`);
}
