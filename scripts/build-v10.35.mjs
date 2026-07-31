import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV10341 } from './build-v10.34.1.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index < 0) throw new Error(`v10.35 build anchor missing: ${label}`);
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

function browserAdapterScript(moduleSource) {
  const browserSource = moduleSource.replace(/^export\s+/gm, '');
  if (/^\s*export\s/m.test(browserSource)) {
    throw new Error('v10.35 data adapter contains an unsupported browser export');
  }
  return `<script data-blh-data-adapter="v10.35" data-blh-data-schema="1">
(function(){
  'use strict';
${browserSource}
  window.BLHDataAdapter = Object.freeze({
    BLH_DATA_FORMAT,
    BLH_SCHEMA_VERSION,
    BLH_PRODUCT_VERSION,
    BLH_LEGACY_STORAGE_KEY,
    BLH_DATA_KINDS,
    BLH_STATE_KEYS,
    BLHDataError,
    sanitizeState,
    createEnvelope,
    migrateToCurrent,
    parseImport,
    serializeEnvelope,
    exportState,
    readStoredState,
    commitImportedState
  });
})();
</script>
`;
}

export async function buildRelease(manifest) {
  const v10341 = JSON.parse(await readFile('source/releases/v10.34.1/release.json', 'utf8'));
  await buildV10341({ ...v10341, output: manifest.output });
  let text = await readFile(manifest.output, 'utf8');

  text = text.split('10.34.1').join('10.35');

  const htmlAnchor = '<html lang="en" data-demo-build="synthetic" data-release="v10.35" data-route-contract="v10.35" data-destination-stability="v10.35">';
  text = replaceOnce(
    text,
    htmlAnchor,
    '<html lang="en" data-demo-build="synthetic" data-release="v10.35" data-route-contract="v10.35" data-destination-stability="v10.35" data-data-adapter="v10.35" data-data-schema="1">',
    'data adapter contract marker'
  );

  const mainScriptAnchor = `<script>\n(function(){\n  'use strict';\n\n  const STORAGE_KEY = 'beaufortLearningHarbor.v10.19.state';`;
  const adapterModule = await readFile('modules/data-adapter.mjs', 'utf8');
  text = replaceOnce(
    text,
    mainScriptAnchor,
    `${browserAdapterScript(adapterModule)}${mainScriptAnchor}`,
    'browser data adapter injection'
  );

  text = replaceOnce(
    text,
    '<p>Use this to move data between computers, give a teacher the starter pack, or make a backup before experimenting.</p>',
    '<p>Use this to move data between computers or make a portable backup. Full-app exports use schema 1, omit local adult PIN credentials and unlock sessions, and keep backup snapshots as metadata only.</p>',
    'export safety guidance'
  );
  text = replaceOnce(
    text,
    '<button class="btn primary" id="exportStateBtn">Download full app data</button>',
    '<button class="btn primary" id="exportStateBtn">Download sanitized app data</button>',
    'sanitized export label'
  );

  const oldDownload = `  function downloadJson(filename, obj){\n    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});\n    const url = URL.createObjectURL(blob);\n    const a = document.createElement('a');\n    a.href = url;\n    a.download = filename;\n    document.body.appendChild(a);\n    a.click();\n    a.remove();\n    URL.revokeObjectURL(url);\n  }`;
  const safeDownload = `  function downloadText(filename, text, type='application/json'){\n    const blob = new Blob([text], {type});\n    const url = URL.createObjectURL(blob);\n    const a = document.createElement('a');\n    a.href = url;\n    a.download = filename;\n    document.body.appendChild(a);\n    a.click();\n    a.remove();\n    URL.revokeObjectURL(url);\n  }\n\n  function downloadJson(filename, obj){\n    downloadText(filename, JSON.stringify(obj, null, 2));\n  }`;
  text = replaceOnce(text, oldDownload, safeDownload, 'deterministic text download helper');

  const oldExport = `    if (e.target.id === 'exportStateBtn') downloadJson('homeschool-quest-lab-full-data.json', state);`;
  const safeExport = `    if (e.target.id === 'exportStateBtn') {\n      try {\n        const payload = window.BLHDataAdapter.exportState(state, { productVersion: '10.35' });\n        downloadText('beaufort-learning-harbor-v10.35-data.json', payload);\n        toast('Sanitized app data exported');\n      } catch (err) {\n        toast('Export failed: ' + err.message);\n      }\n    }`;
  text = replaceOnce(text, oldExport, safeExport, 'versioned sanitized full export');

  const oldImport = `  function importFile(file){\n    if (!file) return;\n    const reader = new FileReader();\n    reader.onload = () => {\n      try {\n        const imported = JSON.parse(reader.result);\n        if (imported.curriculum && imported.students) {\n          state = normalize(seedProgress(imported));\n          saveState();\n          toast('Full app data imported');\n        } else if (imported.weeks) {\n          state.curriculum = imported;\n          if (!getWeek(state.currentWeekId)) state.currentWeekId = state.curriculum.weeks[0]?.id || '';\n          saveState();\n          toast('Curriculum imported');\n        } else {\n          throw new Error('File must be full app data or curriculum pack.');\n        }\n      } catch (err) { toast('Import failed: ' + err.message); }\n    };\n    reader.readAsText(file);\n  }`;
  const safeImport = `  function importFile(file){\n    if (!file) return;\n    const reader = new FileReader();\n    reader.onload = () => {\n      try {\n        const raw = String(reader.result || '');\n        const imported = JSON.parse(raw);\n        const curriculumOnly = imported && Array.isArray(imported.weeks) && !imported.format && !imported.students && !imported.curriculum;\n        if (curriculumOnly) {\n          state.curriculum = imported;\n          if (!getWeek(state.currentWeekId)) state.currentWeekId = state.curriculum.weeks[0]?.id || '';\n          saveState();\n          toast('Curriculum imported');\n          return;\n        }\n        const versioned = imported?.format === window.BLHDataAdapter.BLH_DATA_FORMAT;\n        const envelope = window.BLHDataAdapter.parseImport(raw);\n        if (envelope.kind !== window.BLHDataAdapter.BLH_DATA_KINDS.APPLICATION_STATE) {\n          throw new Error('File is not full application state.');\n        }\n        const candidate = normalize(seedProgress(envelope.state));\n        state = candidate;\n        saveState();\n        toast(versioned ? 'Versioned app data imported' : 'Legacy app data migrated and imported');\n      } catch (err) {\n        toast('Import failed: ' + (err.code ? err.code + ': ' : '') + err.message);\n      }\n    };\n    reader.readAsText(file);\n  }`;
  text = replaceOnce(text, oldImport, safeImport, 'fail-closed full import');

  await writeFile(manifest.output, text, 'utf8');
  console.log(`Built ${manifest.output} with v10.35 versioned data adapter and import/export safety`);
}
