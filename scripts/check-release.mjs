import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const output = await readFile(manifest.output);
const text = output.toString('utf8');
const failures = [];
const digest = createHash('sha256').update(output).digest('hex');
const productVersion = manifest.release.replace(/^v/, '');

if (digest !== manifest.sha256) failures.push(`sha256 mismatch: ${digest}`);
if (output.length !== manifest.bytes) failures.push(`byte mismatch: ${output.length}`);
if (!text.includes(manifest.title)) failures.push(`stable title/version missing: ${manifest.title}`);
if (!text.includes(`data-release="${manifest.release}"`)) failures.push(`release marker missing: ${manifest.release}`);
if (!text.includes(`data-demo-build="${manifest.demoBuild}"`)) failures.push('synthetic demo marker missing');
if (manifest.routeContract && !text.includes(`data-route-contract="${manifest.routeContract}"`)) failures.push(`route contract missing: ${manifest.routeContract}`);
if (manifest.destinationStability && !text.includes(`data-destination-stability="${manifest.destinationStability}"`)) failures.push(`destination stability contract missing: ${manifest.destinationStability}`);
if (manifest.dataAdapter && !text.includes(`data-data-adapter="${manifest.dataAdapter}"`)) failures.push(`data adapter contract missing: ${manifest.dataAdapter}`);
if (manifest.dataSchema && !text.includes(`data-data-schema="${manifest.dataSchema}"`)) failures.push(`data schema contract missing: ${manifest.dataSchema}`);
if (!new RegExp(`const\\s+OWNER\\s*=\\s*['"]${manifest.dockOwner.replaceAll('.', '\\.') }['"]`).test(text)) failures.push('mobile dock owner missing');
if (manifest.heroOwner && !new RegExp(`const\\s+OWNER\\s*=\\s*['"]${manifest.heroOwner.replaceAll('.', '\\.') }['"]`).test(text)) failures.push('hero owner missing');
if (manifest.heroOwner && text.includes("const VERSION='v10.32';")) failures.push('legacy v10.32 title writer remains active');
if (manifest.destinationStability && text.includes("atlas.querySelector('.blh-source-gallery')?.remove();")) failures.push('source-media rebuild loop remains active');
if (manifest.destinationStability && text.includes("screen.querySelector('.blh-visual-model')?.remove();")) failures.push('visual-model rebuild loop remains active');
if (manifest.dataAdapter) {
  if (!text.includes('window.BLHDataAdapter = Object.freeze')) failures.push('browser data adapter global missing');
  if (!text.includes(`window.BLHDataAdapter.exportState(state, { productVersion: '${productVersion}' })`)) failures.push('versioned full export path missing');
  if (!text.includes('window.BLHDataAdapter.parseImport(raw)')) failures.push('validated full import path missing');
  if (text.includes("downloadJson('homeschool-quest-lab-full-data.json', state)")) failures.push('legacy raw full-state export remains active');
  if (text.includes('state = normalize(seedProgress(imported));')) failures.push('legacy direct full-state import remains active');
  if (!text.includes('Download sanitized app data')) failures.push('sanitized export user guidance missing');
}
if (manifest.knowledgeCheckBuilder) {
  if (!text.includes(`data-knowledge-check-builder="${manifest.knowledgeCheckBuilder}"`)) failures.push('knowledge-check builder contract missing');
  if (!text.includes(`data-knowledge-check-schema="${manifest.knowledgeCheckBankSchema}"`)) failures.push('knowledge-check bank schema marker missing');
  if (!text.includes(`data-blh-knowledge-check-bank="${manifest.knowledgeCheckBuilder}"`)) failures.push('knowledge-check browser bank module marker missing');
  if (!text.includes('window.BLHKnowledgeChecks = Object.freeze')) failures.push('knowledge-check bank global missing');
  if (!text.includes('window.BLHKnowledgeCheckUI = Object.freeze')) failures.push('knowledge-check UI global missing');
  if (!text.includes('id="screen-knowledge"')) failures.push('knowledge-check screen missing');
  if (!text.includes("{id:'knowledge', label:'Knowledge Checks'")) failures.push('knowledge-check navigation entry missing');
  if (!text.includes("roles:['parent','teacher','director','admin']")) failures.push('knowledge-check adult role boundary missing');
  if (!text.includes('beaufort-learning-harbor-knowledge-check-bank')) failures.push('knowledge-check portable format missing');
  if (!text.includes('not auto-graded')) failures.push('subjective-work auto-grading boundary missing');
}
if (manifest.lessonPackEditor) {
  if (!text.includes(`data-lesson-pack-editor="${manifest.lessonPackEditor}"`)) failures.push('lesson-pack editor contract missing');
  if (!text.includes(`data-lesson-pack-schema="${manifest.lessonPackSchema}"`)) failures.push('lesson-pack schema marker missing');
  if (!text.includes(`data-blh-lesson-pack="${manifest.lessonPackEditor}"`)) failures.push('lesson-pack browser module marker missing');
  if (!text.includes('window.BLHLessonPacks = Object.freeze')) failures.push('lesson-pack package global missing');
  if (!text.includes('window.BLHLessonPackUI = Object.freeze')) failures.push('lesson-pack UI global missing');
  if (!text.includes('id="screen-lessonpacks"')) failures.push('lesson-pack screen missing');
  if (!text.includes("{id:'lessonpacks', label:'Lesson Pack Editor'")) failures.push('lesson-pack navigation entry missing');
  if (!text.includes('beaufort-learning-harbor-lesson-pack')) failures.push('lesson-pack portable format missing');
  if (!text.includes('No live apply occurs')) failures.push('lesson-pack no-live-apply boundary missing');
  if (!text.includes('Do not paste copyrighted curriculum text')) failures.push('lesson-pack copyright boundary missing');
  if (!text.includes('Import legacy Studio drafts')) failures.push('lesson-pack legacy migration control missing');
  if (!text.includes('Before / after preview')) failures.push('lesson-pack before/after preview missing');
}
if (manifest.familyPlanner) {
  if (!text.includes(`data-family-planner="${manifest.familyPlanner}"`)) failures.push('family-planner contract missing');
  if (!text.includes(`data-family-planner-schema="${manifest.familyPlannerSchema}"`)) failures.push('family-planner schema marker missing');
  if (!text.includes(`data-blh-family-planner="${manifest.familyPlanner}"`)) failures.push('family-planner browser module marker missing');
  if (!text.includes('window.BLHFamilyPlanner = Object.freeze')) failures.push('family-planner package global missing');
  if (!text.includes('window.BLHFamilyPlannerUI = Object.freeze')) failures.push('family-planner UI global missing');
  if (!text.includes('id="screen-familyplanner"')) failures.push('family-planner screen missing');
  if (!text.includes("{id:'familyplanner', label:'Family / Co-op Planner'")) failures.push('family-planner navigation entry missing');
  if (!text.includes('beaufort-learning-harbor-family-planner')) failures.push('family-planner portable format missing');
  if (!text.includes('do not complete assignments or change XP, coins, attendance, mastery, portfolio approval, or lesson-pack status')) failures.push('family-planner record/reward boundary missing');
  if (!text.includes('Seed current sources')) failures.push('family-planner source seeding control missing');
  if (!text.includes('Create linked carryover')) failures.push('family-planner carryover control missing');
  if (!text.includes('Open weekly planner')) failures.push('family-planner workflow entry links missing');
  if (!text.includes('No external calendar sync')) failures.push('family-planner no-calendar-sync boundary missing');
}
for (const route of ['learn','practice','quiz','proof','feedback']) {
  if (!new RegExp(`route\\s*:\\s*['"]${route}['"]`).test(text)) failures.push(`dock route missing: ${route}`);
}
for (const marker of ['load-demo-family','reset-demo-data','demo-scenario-status','buildDeterministicDemoState']) {
  if (!text.includes(marker)) failures.push(`v10.33 demo marker missing: ${marker}`);
}
for (const [index, match] of [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
  const script = match[1].trim();
  if (script) try { new vm.Script(script); } catch (error) { failures.push(`inline script ${index + 1}: ${error.message}`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Release integrity OK: ${manifest.release} · ${digest} · ${output.length} bytes`);
