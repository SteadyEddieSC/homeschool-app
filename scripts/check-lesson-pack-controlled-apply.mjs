import { readFile } from 'node:fs/promises';

const current = JSON.parse(await readFile('source/current-release.json', 'utf8'));
const manifest = JSON.parse(await readFile(current.manifest, 'utf8'));
const output = await readFile(manifest.output, 'utf8');
const moduleSource = await readFile('modules/lesson-pack-controlled-apply.mjs', 'utf8');
const uiSource = await readFile('modules/lesson-pack-controlled-apply-ui.js', 'utf8');
const failures = [];

if (manifest.lessonPackControlledApply !== manifest.release) failures.push('manifest Lesson Pack Controlled Apply version mismatch');
if (manifest.lessonPackControlledApplySchema !== 1) failures.push('manifest Lesson Pack Controlled Apply schema must be 1');
for (const marker of [
  `data-lesson-pack-apply="${manifest.release}"`,
  'data-lesson-pack-apply-schema="1"',
  `data-blh-lesson-pack-apply="${manifest.release}"`,
  'data-blh-lesson-pack-apply-schema="1"',
  'window.BLHLessonPackApply = Object.freeze',
  'window.BLHLessonPackApplyUI = Object.freeze',
  'Controlled Apply v1',
  'Confirm controlled apply',
  'Rollback active overlay',
  'Read-only overlay rollup',
  'Lesson Pack overlay · local device',
  'original or approved OER, public-domain, nonprofit, or government-use material',
  'source pack and progress records unchanged'
]) {
  if (!output.includes(marker)) failures.push(`artifact marker missing: ${marker}`);
}
for (const marker of [
  'normalizeLessonPackControlledApplyWorkspace',
  'fingerprintLessonPackOverlayPlan',
  'applyLessonPackOverlay',
  'rollbackLessonPackOverlay',
  'createStudentSafeLessonPackOverlay',
  'DUPLICATE_ACTIVE_OVERLAY',
  'RIGHTS_ATTESTATION_REQUIRED',
  'MEDIA_REVIEW_REQUIRED',
  'BLH_LESSON_PACK_APPLY_LIMIT = 50'
]) {
  if (!moduleSource.includes(marker)) failures.push(`operations marker missing: ${marker}`);
}
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon(', 'WebSocket(', 'EventSource(']) {
  if (moduleSource.includes(forbidden) || uiSource.includes(forbidden)) failures.push(`network primitive introduced: ${forbidden}`);
}
if (uiSource.includes('innerHTML = overlay.auditNote') || uiSource.includes('innerHTML = overlay.rightsAttested')) failures.push('adult governance data wired into destination output');
if (!uiSource.includes("['parent','teacher','admin']")) failures.push('adult apply role boundary missing');
if (!uiSource.includes("activeRole() === 'director'")) failures.push('Director read-only rollup boundary missing');
if (!uiSource.includes('student-facing overlay content only')) failures.push('student-safe destination disclosure missing');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Lesson Pack Controlled Apply integrity OK');
