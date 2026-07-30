import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1034 } from './build-v10.34.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.34.1 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

export async function buildRelease(manifest) {
  const v1034 = JSON.parse(await readFile('source/releases/v10.34/release.json', 'utf8'));
  await buildV1034({ ...v1034, output: manifest.output });
  let text = await readFile(manifest.output, 'utf8');

  text = text.split('v10.34').join('__BLH_V10341__');
  text = replaceOnce(text, "appVersion: '10.34'", "appVersion: '10.34.1'", 'core app version');
  text = text.split('__BLH_V10341__').join('v10.34.1');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.34.1" data-route-contract="v10.34.1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.34.1" data-route-contract="v10.34.1" data-destination-stability="v10.34.1">',
    'destination stability contract'
  );

  const rebuildingAtlas = `    if(!atlas) return;\n    atlas.querySelector('.blh-source-gallery')?.remove();\n    // Collect before hiding old packs, so versioned pack images are available but not shown separately.`;
  const stableAtlas = `    if(!atlas) return;\n    const existing=atlas.querySelector('.blh-source-gallery');\n    if(existing){ hideOldPacks(); return existing; }\n    // Collect before hiding old packs, so versioned pack images are available but not shown separately.`;
  text = replaceOnce(text, rebuildingAtlas, stableAtlas, 'source-media gallery idempotency');

  const rebuildingVisualModel = `    if(!screen || !/^screen-lib-/.test(screen.id)) return;\n    screen.querySelector('.blh-visual-model')?.remove();\n    const topic=screenTopic(screen);`;
  const stableVisualModel = `    if(!screen || !/^screen-lib-/.test(screen.id)) return;\n    const existing=screen.querySelector('.blh-visual-model');\n    if(existing){ hideOldPacks(); return existing; }\n    const topic=screenTopic(screen);`;
  text = replaceOnce(text, rebuildingVisualModel, stableVisualModel, 'visual-model idempotency');

  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.34.1 mobile destination stability`);
}
