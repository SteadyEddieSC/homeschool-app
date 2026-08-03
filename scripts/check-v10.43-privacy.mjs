import { strict as assert } from 'node:assert';
import {
  applyLessonPackOverlay,
  createStudentSafeLessonPackOverlay
} from '../modules/lesson-pack-controlled-apply.mjs';

const sourcePack = {
  id:'lp_privacy_synthetic',
  title:'Synthetic privacy pack',
  subject:'Science',
  track:'All learners',
  targetWeekId:'week_privacy',
  targetScreen:'biology',
  status:'ready',
  objective:'Explain a synthetic observation.',
  sections:[{ id:'section_privacy', title:'Learn', body:'Original synthetic student-facing content.' }],
  practicePrompts:['Explain the observation.'],
  labPrompts:[],
  mediaNeeds:{ heroImage:false, supportingImages:false, diagramOrMap:false, sourceLicenseReview:false, altText:false, notes:'' },
  noEquipmentPath:{ enabled:false, directions:'', evidence:'' },
  adultNotes:'PRIVATE_ADULT_SOURCE_MARKER',
  updatedAt:'2026-08-02T12:00:00.000Z'
};
const request = {
  targetScreen:'biology',
  targetWeekId:'week_privacy',
  selection:{ includeObjective:true, sectionIds:['section_privacy'], includePractice:true, includeLabs:false, includeNoEquipment:false, includeMediaPlan:false },
  contentRightsAttested:true,
  mediaLicenseReviewed:false,
  mediaProvenanceReviewed:false,
  auditNote:'PRIVATE_ADULT_AUDIT_MARKER'
};
const result = applyLessonPackOverlay({}, sourcePack, request, {
  role:'parent',
  now:'2026-08-02T12:30:00.000Z',
  id:'overlay_privacy',
  auditId:'audit_privacy'
});
const safe = JSON.stringify(createStudentSafeLessonPackOverlay(result.overlay));
for (const forbidden of ['PRIVATE_ADULT_SOURCE_MARKER','PRIVATE_ADULT_AUDIT_MARKER','rightsAttested','appliedByRole','auditNote','rollbackNote','mediaReview','fingerprint']) {
  assert.equal(safe.includes(forbidden), false, `student-safe overlay leaked ${forbidden}`);
}
assert.equal(JSON.stringify(sourcePack).includes('PRIVATE_ADULT_SOURCE_MARKER'), true);
assert.equal(result.workspace.audit.length, 1);
console.log('v10.43 privacy boundary OK');
