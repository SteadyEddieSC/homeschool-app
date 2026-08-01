import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1039 } from './build-v10.39.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.39.1 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function replaceExactCount(text, oldValue, newValue, expected, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== expected) throw new Error(`v10.39.1 expected ${expected} ${label} anchors, found ${count}`);
  return text.split(oldValue).join(newValue);
}

function stabilizeLegacyRuntime(text) {
  let observerScriptIndex = 0;
  let observersRetired = 0;
  let pollsRetired = 0;
  const pollPattern = /\s*let\s+([ni])=0;\s*const\s+([A-Za-z_$][\w$]*)=setInterval\([\s\S]*?clearInterval\(\2\);?\s*\},\d+\);?/;

  const output = text.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (whole, openTag, body, closeTag) => {
    if (!body.includes('MutationObserver')) return whole;
    observerScriptIndex += 1;

    if (observerScriptIndex <= 9) {
      const next = body.replace(
        /\b[A-Za-z_$][\w$]*\.observe\(document\.body,\{[^}]*\}\);/,
        'void 0 /* v10.39.1 legacy observer retired */;'
      );
      if (next === body) throw new Error(`v10.39.1 legacy observer ${observerScriptIndex} registration anchor missing`);
      body = next;
      observersRetired += 1;
    }

    if (observerScriptIndex <= 15) {
      const next = body.replace(pollPattern, '\n    void 0 /* v10.39.1 legacy poll retired */;');
      if (next === body) throw new Error(`v10.39.1 legacy poll ${observerScriptIndex} anchor missing`);
      body = next;
      pollsRetired += 1;
    }

    return openTag + body + closeTag;
  });

  if (observerScriptIndex < 15 || observersRetired !== 9 || pollsRetired !== 15) {
    throw new Error(
      `v10.39.1 runtime stabilization mismatch: ${observersRetired} observers and ${pollsRetired} polls retired across ${observerScriptIndex} observer scripts`
    );
  }
  return output;
}

export function transformV10391(source) {
  let text = source.split('v10.39').join('__BLH_V10391__');
  text = replaceOnce(text, "appVersion: '10.39'", "appVersion: '10.39.1'", 'core app version');
  text = replaceExactCount(text, "productVersion: '10.39'", "productVersion: '10.39.1'", 3, 'portable product-version');
  text = replaceOnce(text, "productVersion:'10.39'", "productVersion:'10.39.1'", 'Family Planner product-version');
  text = text.split('__BLH_V10391__').join('v10.39.1');

  text = replaceExactCount(
    text,
    'v10.39.1-offline-runtime',
    'v10.39-offline-runtime',
    2,
    'historical offline-runtime release-note id'
  );
  text = replaceOnce(
    text,
    '<b>v10.39.1 Modularization + Offline Regression Foundation</b>',
    '<b>v10.39 Modularization + Offline Regression Foundation</b>',
    'historical offline-runtime release-note title'
  );

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.39.1" data-route-contract="v10.39.1" data-destination-stability="v10.39.1" data-data-adapter="v10.39.1" data-data-schema="1" data-knowledge-check-builder="v10.39.1" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39.1" data-lesson-pack-schema="1" data-family-planner="v10.39.1" data-family-planner-schema="1" data-offline-runtime="v10.39.1" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.39.1">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.39.1" data-route-contract="v10.39.1" data-destination-stability="v10.39.1" data-data-adapter="v10.39.1" data-data-schema="1" data-knowledge-check-builder="v10.39.1" data-knowledge-check-schema="1" data-lesson-pack-editor="v10.39.1" data-lesson-pack-schema="1" data-family-planner="v10.39.1" data-family-planner-schema="1" data-offline-runtime="v10.39.1" data-offline-runtime-schema="1" data-offline-policy="same-origin-and-embedded" data-visual-baselines="v10.39.1" data-console-stability="v10.39.1" data-legacy-observers-retired="9" data-legacy-polls-retired="15">',
    'console stability release marker'
  );

  const titleAnchor = "  const TITLE='Beaufort Learning Harbor v10.39.1';\n  const APP='Beaufort Learning Harbor';\n  const FLOW_STEPS=[";
  text = replaceOnce(
    text,
    titleAnchor,
    "  const TITLE='Beaufort Learning Harbor v10.39.1';\n  const APP='Beaufort Learning Harbor';\n  const VERSION='v10.39.1';\n  const FLOW_STEPS=[",
    'legacy learning-path version binding'
  );

  return stabilizeLegacyRuntime(text);
}

export async function buildRelease(manifest) {
  const v1039 = JSON.parse(await readFile('source/releases/v10.39/release.json', 'utf8'));
  await buildV1039({ ...v1039, output: manifest.output });
  const source = await readFile(manifest.output, 'utf8');
  const text = transformV10391(source);
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.39.1 console and observer stability hotfix`);
}
