import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1039 } from './build-v10.39.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.39.1 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function retireLegacyObserverLoops(text) {
  let observerScriptIndex = 0;
  let retired = 0;
  const output = text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, openTag, body, closeTag) => {
    if (!body.includes('MutationObserver')) return whole;
    observerScriptIndex += 1;
    if (observerScriptIndex > 9) return whole;
    const next = body.replace(
      /\b[A-Za-z_$][\w$]*\.observe\(document\.body,\{[^}]*\}\);/,
      'void 0 /* v10.39.1 legacy observer retired */;'
    );
    if (next === body) throw new Error(`v10.39.1 legacy observer ${observerScriptIndex} registration anchor missing`);
    retired += 1;
    return openTag + next + closeTag;
  });
  if (observerScriptIndex < 9 || retired !== 9) {
    throw new Error(`v10.39.1 expected 9 retired legacy observers, found ${retired} across ${observerScriptIndex} observer scripts`);
  }
  return output;
}

export function transformV10391(source) {
  let text = source.split('v10.39').join('__BLH_V10391__');
  text = replaceOnce(text, "appVersion: '10.39'", "appVersion: '10.39.1'", 'core app version');
  text = text.split('__BLH_V10391__').join('v10.39.1');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.39.1" data-route-contract="v10.39.1" data-destination-stability="v10.39.1" data-data-adapter="v10.39.1" data-data-schema="1" data-knowledge-check-builder="v10.39.1" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39.1" data-lesson-pack-schema="1" data-family-planner="v10.39.1" data-family-planner-schema="1" data-offline-runtime="v10.39.1" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.39.1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.39.1" data-route-contract="v10.39.1" data-destination-stability="v10.39.1" data-data-adapter="v10.39.1" data-data-schema="1" data-knowledge-check-builder="v10.39.1" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39.1" data-lesson-pack-schema="1" data-family-planner="v10.39.1" data-family-planner-schema="1" data-offline-runtime="v10.39.1" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.39.1" data-console-stability="v10.39.1" data-legacy-observers-retired="9">',
    'console stability release marker'
  );

  const titleAnchor = "  const TITLE='Beaufort Learning Harbor v10.39.1';\n  const APP='Beaufort Learning Harbor';\n  const FLOW_STEPS=[";
  text = replaceOnce(
    text,
    titleAnchor,
    "  const TITLE='Beaufort Learning Harbor v10.39.1';\n  const APP='Beaufort Learning Harbor';\n  const VERSION='v10.39.1';\n  const FLOW_STEPS=[",
    'legacy learning-path version binding'
  );

  return retireLegacyObserverLoops(text);
}

export async function buildRelease(manifest) {
  const v1039 = JSON.parse(await readFile('source/releases/v10.39/release.json', 'utf8'));
  await buildV1039({ ...v1039, output: manifest.output });
  const source = await readFile(manifest.output, 'utf8');
  const text = transformV10391(source);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.39.1 console and observer stability hotfix`);
}
