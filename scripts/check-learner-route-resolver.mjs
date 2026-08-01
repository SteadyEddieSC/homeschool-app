import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const [text, moduleSource, nodeSpec, browserSpec] = await Promise.all([
  readFile(manifest.output, 'utf8'),
  readFile('modules/learner-route-resolver.mjs', 'utf8'),
  readFile('tests/learner-route-resolver.test.mjs', 'utf8'),
  readFile('tests/learner-route-resolver.spec.mjs', 'utf8')
]);
const failures = [];

if (manifest.learnerRouteResolver !== manifest.release) failures.push('learner route resolver version must match the active release');
if (manifest.learnerRouteResolverSchema !== 1) failures.push('learner route resolver schema must remain 1');

for (const marker of [
  `data-learner-route-resolver="${manifest.learnerRouteResolver}"`,
  `data-learner-route-resolver-schema="${manifest.learnerRouteResolverSchema}"`,
  `data-blh-learner-route-resolver="${manifest.learnerRouteResolver}"`,
  `data-blh-learner-route-resolver-schema="${manifest.learnerRouteResolverSchema}"`,
  'window.BLHLearnerRouteResolver = Object.freeze',
  'window.BLHLearnerRouteRuntime = Object.freeze',
  'resolveLearnerRoute',
  'resolveAssignmentDestination',
  'resolveLearnerRouteMatrix',
  'NEXT_UNFINISHED_ASSIGNMENT',
  'NO_MATCHING_ASSIGNMENT',
  'ASSIGNMENT_DESTINATION_MISSING',
  'ASSIGNMENT_NOT_FOUND_OR_NOT_APPLICABLE',
  'v10.41 Learner Route + Assignment Resolver',
  '<b>Resolver:</b>',
  '<b>Resolved screen:</b>'
]) {
  if (!text.includes(marker)) failures.push(`learner route resolver marker missing: ${marker}`);
}

for (const marker of [
  "function matches(item,stu){const t=String(item.student||'all').toLowerCase();",
  "function nextItem(kind){const stu=student(); const d=loadManifest();",
  "const item=nextItem(kind); if(item){openScreen(item.screen); setTimeout(()=>injectTarget(item),180); return;}",
  "const item=(d.assignments||[]).find(x=>x.id===id); if(!item) return; openScreen(item.screen);"
]) {
  if (text.includes(marker)) failures.push(`legacy duplicated learner-route path remains active: ${marker}`);
}

for (const marker of [
  "BLH_LEARNER_ROUTE_RESOLVER_VERSION = 'v10.41'",
  'ASSIGNMENT_TARGET_DEFAULTED_ALL',
  'DUPLICATE_ASSIGNMENT_ID_SKIPPED',
  'INVALID_PROTOTYPE',
  "learn: 'study'",
  "proof: 'assignments'",
  'Object.freeze'
]) {
  if (!moduleSource.includes(marker)) failures.push(`resolver module contract missing: ${marker}`);
}

for (const marker of [
  'preserves exact lower and upper learner route selection',
  'falls back safely when an assignment or destination is missing',
  'direct assignment resolution enforces learner applicability',
  'unknown route kinds fail closed to Home',
  'rejects dangerous objects'
]) {
  if (!nodeSpec.includes(marker)) failures.push(`Node resolver coverage missing: ${marker}`);
}

for (const marker of [
  'expectedMatrices',
  'stu_jordan',
  'stu_avery',
  'incomplete learner, assignment, and destination mappings',
  'direct assignment resolution cannot widen work to the wrong learner',
  'Route QA shows resolver diagnostics'
]) {
  if (!browserSpec.includes(marker)) failures.push(`browser resolver coverage missing: ${marker}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Learner route resolver integrity OK: ${manifest.learnerRouteResolver} schema ${manifest.learnerRouteResolverSchema}`);
