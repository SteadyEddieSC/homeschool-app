import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const text = await readFile(manifest.output, 'utf8');
const failures = [];

const markers = [
  `data-family-planner="${manifest.familyPlanner}"`,
  `data-family-planner-schema="${manifest.familyPlannerSchema}"`,
  `data-family-planner-v2-schema="${manifest.familyPlannerV2Schema}"`,
  `data-blh-family-planner-v2="${manifest.familyPlanner}"`,
  `data-blh-family-planner-v2-schema="${manifest.familyPlannerV2Schema}"`,
  'window.BLHFamilyPlannerV2 = Object.freeze',
  'createWeekTemplate',
  'applyWeekTemplate',
  'copyWeek',
  'analyzeWeek',
  'createLearnerSafePrintModel',
  'createLearnerSafeCsv',
  'family-planner-save-template',
  'family-planner-apply-template',
  'family-planner-duplicate-week',
  'family-planner-roll-forward',
  'family-planner-v2-analysis',
  'family-planner-print-summary',
  'family-planner-csv',
  'Adult notes excluded',
  'Print and binder output is optional support material only',
  'source week preserved',
  'No external calendar sync'
];
for (const marker of markers) if (!text.includes(marker)) failures.push(`missing Family Planner v2 marker: ${marker}`);
if (text.includes('PRIVATE ADULT NOTE') || text.includes('PRIVATE ARRIVAL')) failures.push('test-only private marker leaked into release artifact');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Family Planner v2 integrity OK: ${manifest.release} · schema ${manifest.familyPlannerV2Schema}`);
