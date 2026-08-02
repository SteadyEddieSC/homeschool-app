import { readFile, writeFile } from 'node:fs/promises';
import { buildRelease as buildV1043 } from './build-v10.43.mjs';

function replaceOnce(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`v10.43 runtime-fix expected one ${label} anchor, found ${count}`);
  return text.replace(oldValue, newValue);
}

const MUTATING_WORKSPACE_READER = `  const BLH_LESSON_PACK_APPLY_RELEASE = 'v10.43';

  function ensureLessonPackApplyState(){
    state.ui ||= {};
    const current = state.ui.lessonPackControlledApply;
    try {
      state.ui.lessonPackControlledApply = window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace(current || {});
    } catch (error) {
      state.ui.lessonPackControlledApply = window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace({});
      toast(\`Controlled-apply workspace reset: \${error.code ? \`\${error.code}: \` : ''}\${error.message}\`);
    }
    state.ui.lessonPackApplyDrafts ||= {};
    if (!state.ui.lessonPackApplyDrafts || typeof state.ui.lessonPackApplyDrafts !== 'object' || Array.isArray(state.ui.lessonPackApplyDrafts)) {
      state.ui.lessonPackApplyDrafts = {};
    }
    return state.ui.lessonPackControlledApply;
  }`;

const READ_ONLY_WORKSPACE_READER = `  const BLH_LESSON_PACK_APPLY_RELEASE = 'v10.43';
  const lessonPackApplyDraftCache = new Map();

  function readLessonPackApplyWorkspace(){
    const current = state.ui?.lessonPackControlledApply;
    try {
      return window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace(current || {});
    } catch (error) {
      toast(\`Controlled-apply workspace ignored: \${error.code ? \`\${error.code}: \` : ''}\${error.message}\`);
      return window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace({});
    }
  }`;

const MUTATING_DRAFT_CACHE = `  function lessonPackApplyDraft(pack){
    state.ui ||= {};
    state.ui.lessonPackApplyDrafts ||= {};
    const current = state.ui.lessonPackApplyDrafts[pack.id];
    if (current && typeof current === 'object' && !Array.isArray(current)) return current;
    const draft = {
      includeObjective:true,
      sectionIds:(pack.sections || []).map(section => section.id),
      includePractice:Boolean((pack.practicePrompts || []).length),
      includeLabs:Boolean((pack.labPrompts || []).length),
      includeNoEquipment:Boolean(pack.noEquipmentPath?.enabled),
      includeMediaPlan:Boolean(pack.mediaNeeds && Object.values(pack.mediaNeeds).some(Boolean)),
      contentRightsAttested:false,
      mediaLicenseReviewed:false,
      mediaProvenanceReviewed:false,
      auditNote:''
    };
    state.ui.lessonPackApplyDrafts[pack.id] = draft;
    return draft;
  }`;

const READ_ONLY_DRAFT_CACHE = `  function lessonPackApplyDraft(pack){
    const current = lessonPackApplyDraftCache.get(pack.id);
    if (current && typeof current === 'object' && !Array.isArray(current)) return current;
    const draft = {
      includeObjective:true,
      sectionIds:(pack.sections || []).map(section => section.id),
      includePractice:Boolean((pack.practicePrompts || []).length),
      includeLabs:Boolean((pack.labPrompts || []).length),
      includeNoEquipment:Boolean(pack.noEquipmentPath?.enabled),
      includeMediaPlan:Boolean(pack.mediaNeeds && Object.values(pack.mediaNeeds).some(Boolean)),
      contentRightsAttested:false,
      mediaLicenseReviewed:false,
      mediaProvenanceReviewed:false,
      auditNote:''
    };
    lessonPackApplyDraftCache.set(pack.id, draft);
    return draft;
  }`;

export async function buildRelease(manifest) {
  await buildV1043(manifest);
  let text = await readFile(manifest.output, 'utf8');
  text = replaceOnce(text, MUTATING_WORKSPACE_READER, READ_ONLY_WORKSPACE_READER, 'mutating workspace reader');
  text = replaceOnce(text, MUTATING_DRAFT_CACHE, READ_ONLY_DRAFT_CACHE, 'mutating draft cache');
  const callCount = text.split('ensureLessonPackApplyState()').length - 1;
  if (callCount !== 4) throw new Error(`v10.43 runtime-fix expected four workspace reader calls, found ${callCount}`);
  text = text.replaceAll('ensureLessonPackApplyState()', 'readLessonPackApplyWorkspace()');
  await writeFile(manifest.output, text, 'utf8');
  console.log(`Applied v10.43 read-only render-state correction to ${manifest.output}`);
}
