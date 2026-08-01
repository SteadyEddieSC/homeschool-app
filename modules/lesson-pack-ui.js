  const BLH_LESSON_PACK_RELEASE = 'v10.37';
  const BLH_LESSON_PACK_LEGACY_KEYS = Object.freeze([
    'blh20.curriculumDrafts.v1',
    'beaufortLearningHarbor.curriculumStudio.v2.drafts',
    'beaufort.learning.harbor.v10.18.curriculumStudio',
    'blh21.releasePlan.v1'
  ]);
  const BLH_LESSON_TARGETS = Object.freeze([
    ['lessonplayer','Lesson Player'],
    ['library','Study Library'],
    ['biology','Honors Biology Lab'],
    ['latin','Henle Latin Lab'],
    ['literature','Literature / Composition Lab'],
    ['mocktrial','Mock Trial Lab'],
    ['spanish','Spanish Foundations Lab'],
    ['botany','Botany Lab'],
    ['ancient','Ancient History Lab'],
    ['logic','Logic Lab'],
    ['writing','Writing Lab'],
    ['practical','Life Skills']
  ]);

  function ensureLessonPackState(){
    state.ui ||= {};
    const current = state.ui.lessonPackEditor;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      state.ui.lessonPackEditor = { version: BLH_LESSON_PACK_RELEASE, activePackId: '', drafts: [] };
    }
    const settings = state.ui.lessonPackEditor;
    settings.version = BLH_LESSON_PACK_RELEASE;
    if (!Array.isArray(settings.drafts)) settings.drafts = [];
    if (typeof settings.activePackId !== 'string') settings.activePackId = '';
    return settings;
  }

  function lessonPackCanEdit(role = activeRole()){
    return ['parent','teacher','admin'].includes(role);
  }

  function lessonPackById(id){
    return ensureLessonPackState().drafts.find(pack => pack.id === id) || null;
  }

  function selectedLessonPack(){
    const settings = ensureLessonPackState();
    return lessonPackById(settings.activePackId) || settings.drafts[0] || null;
  }

  function lessonPackSafeId(value){
    const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70);
    return normalized || 'draft';
  }

  function lessonPackId(prefix = 'lp'){
    const existing = new Set(ensureLessonPackState().drafts.map(pack => pack.id));
    const base = `${prefix}_${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 2;
    while (existing.has(candidate)) candidate = `${base}_${suffix++}`;
    return candidate;
  }

  function lessonSectionId(pack, prefix = 'section'){
    const existing = new Set((pack.sections || []).map(section => section.id));
    const base = `${prefix}_${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 2;
    while (existing.has(candidate)) candidate = `${base}_${suffix++}`;
    return candidate;
  }

  function newLessonPack(){
    const now = new Date().toISOString();
    return {
      id: lessonPackId(),
      title: 'New lesson pack',
      subject: 'General studies',
      track: 'All learners',
      targetWeekId: state.currentWeekId || '',
      targetScreen: 'lessonplayer',
      status: 'draft',
      objective: 'Describe what the learner should understand or be able to do.',
      sections: [{ id: `section_${Date.now().toString(36)}`, title: 'Learn', body: 'Add original, book-independent lesson content here.' }],
      practicePrompts: ['Explain the main idea in your own words.'],
      labPrompts: [],
      mediaNeeds: { heroImage:false, supportingImages:false, diagramOrMap:false, sourceLicenseReview:false, altText:false, notes:'' },
      noEquipmentPath: { enabled:false, directions:'', evidence:'' },
      adultNotes: '',
      sourceDraftId: '',
      applyMode: 'draft-only',
      createdAt: now,
      updatedAt: now
    };
  }

  function lessonPackTargetLabel(id){
    return BLH_LESSON_TARGETS.find(item => item[0] === id)?.[1] || id || 'Unmapped target';
  }

  function lessonPackWeekLabel(id){
    const week = (state.curriculum?.weeks || []).find(item => item.id === id);
    return week ? `${week.title || week.id}` : (id || 'No week selected');
  }

  function lessonPackStatusOptions(selected){
    return window.BLHLessonPacks.BLH_LESSON_PACK_STATUSES.map(status =>
      `<option value="${status}" ${status === selected ? 'selected' : ''}>${status[0].toUpperCase() + status.slice(1)}</option>`
    ).join('');
  }

  function lessonPackTargetOptions(selected){
    return BLH_LESSON_TARGETS.map(([id,label]) =>
      `<option value="${escapeHtml(id)}" ${id === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
    ).join('');
  }

  function lessonPackWeekOptions(selected){
    const weeks = state.curriculum?.weeks || [];
    return `<option value="">No week selected</option>${weeks.map(week =>
      `<option value="${escapeHtml(week.id)}" ${week.id === selected ? 'selected' : ''}>${escapeHtml(week.title || week.id)}</option>`
    ).join('')}`;
  }

  function lessonPackSectionsEditor(pack){
    return `<div class="lp-section-stack" data-testid="lesson-sections">${(pack.sections || []).map((section,index) => `
      <article class="lp-section-editor" data-lp-section-index="${index}">
        <div class="lp-section-head"><b>Section ${index + 1}</b><div class="lp-mini-actions">
          <button class="btn small" type="button" data-lp-action="section-up" data-lp-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn small" type="button" data-lp-action="section-down" data-lp-index="${index}" ${index === pack.sections.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn small danger" type="button" data-lp-action="section-remove" data-lp-index="${index}" ${pack.sections.length === 1 ? 'disabled' : ''}>Remove</button>
        </div></div>
        <label class="field"><span>Section title</span><input data-lp-section-title maxlength="240" value="${escapeHtml(section.title || '')}"></label>
        <label class="field"><span>Student-facing content</span><textarea data-lp-section-body rows="5" maxlength="12000">${escapeHtml(section.body || '')}</textarea></label>
        <input type="hidden" data-lp-section-id value="${escapeHtml(section.id || lessonSectionId(pack))}">
      </article>`).join('')}</div>
      <button class="btn" type="button" data-lp-action="section-add" data-testid="lesson-section-add">Add lesson section</button>`;
  }

  function lessonPackEditor(pack){
    if (!pack) return '<div class="lp-empty"><h3>Select or create a lesson pack</h3><p>The editor creates reversible, local draft packages only.</p></div>';
    const media = pack.mediaNeeds || {};
    const noEquipment = pack.noEquipmentPath || {};
    return `<form class="lp-editor" data-testid="lesson-pack-editor-form" onsubmit="return false">
      <div class="lp-form-grid">
        <label class="field lp-span-2"><span>Lesson-pack title</span><input id="lpTitle" data-testid="lesson-pack-title" maxlength="240" value="${escapeHtml(pack.title || '')}"></label>
        <label class="field"><span>Subject</span><input id="lpSubject" maxlength="160" value="${escapeHtml(pack.subject || '')}"></label>
        <label class="field"><span>Learner track</span><input id="lpTrack" maxlength="160" value="${escapeHtml(pack.track || '')}"></label>
        <label class="field"><span>Target week</span><select id="lpWeek">${lessonPackWeekOptions(pack.targetWeekId)}</select></label>
        <label class="field"><span>Target destination</span><select id="lpTarget" data-testid="lesson-pack-target">${lessonPackTargetOptions(pack.targetScreen)}</select></label>
        <label class="field"><span>Status</span><select id="lpStatus">${lessonPackStatusOptions(pack.status)}</select></label>
        <label class="field"><span>Apply mode</span><input value="Draft only · no live apply" disabled></label>
        <label class="field lp-span-2"><span>Learning objective</span><textarea id="lpObjective" data-testid="lesson-pack-objective" rows="4" maxlength="4000">${escapeHtml(pack.objective || '')}</textarea></label>
      </div>

      <section class="lp-editor-block"><div class="lp-block-heading"><div><h3>Lesson sections</h3><p>Ordered, original student-facing content. Do not paste copyrighted curriculum text.</p></div></div>${lessonPackSectionsEditor(pack)}</section>

      <section class="lp-editor-block"><div class="lp-block-heading"><div><h3>Practice and lab prompts</h3><p>Keep practice separate from hands-on lab/project work.</p></div></div>
        <div class="lp-form-grid">
          <label class="field"><span>Practice prompts · one per line</span><textarea id="lpPractice" data-testid="lesson-pack-practice" rows="6">${escapeHtml((pack.practicePrompts || []).join('\n'))}</textarea></label>
          <label class="field"><span>Lab/project prompts · one per line</span><textarea id="lpLabs" data-testid="lesson-pack-labs" rows="6">${escapeHtml((pack.labPrompts || []).join('\n'))}</textarea></label>
        </div>
      </section>

      <section class="lp-editor-block lp-media-block"><div class="lp-block-heading"><div><h3>Media needs checklist</h3><p>Plan compact, relevant OER/public-domain/nonprofit/government media before sourcing.</p></div></div>
        <div class="lp-check-grid">
          <label><input id="lpMediaHero" type="checkbox" ${media.heroImage ? 'checked' : ''}> Hero image needed</label>
          <label><input id="lpMediaSupporting" type="checkbox" ${media.supportingImages ? 'checked' : ''}> 2–3 supporting images</label>
          <label><input id="lpMediaDiagram" type="checkbox" ${media.diagramOrMap ? 'checked' : ''}> Diagram or map</label>
          <label><input id="lpMediaLicense" type="checkbox" ${media.sourceLicenseReview ? 'checked' : ''}> Source/license review</label>
          <label><input id="lpMediaAlt" type="checkbox" ${media.altText ? 'checked' : ''}> Alt text required</label>
        </div>
        <label class="field"><span>Sourcing and visual notes</span><textarea id="lpMediaNotes" data-testid="lesson-pack-media-notes" rows="4" maxlength="4000">${escapeHtml(media.notes || '')}</textarea></label>
      </section>

      <section class="lp-editor-block lp-no-equipment-block"><div class="lp-block-heading"><div><h3>No-equipment path</h3><p>Optional alternative so the lesson can still be completed without special supplies or a computer.</p></div><label class="lp-toggle"><input id="lpNoEquipmentEnabled" data-testid="lesson-pack-no-equipment" type="checkbox" ${noEquipment.enabled ? 'checked' : ''}> Include path</label></div>
        <div class="lp-form-grid">
          <label class="field"><span>Directions</span><textarea id="lpNoEquipmentDirections" rows="4" maxlength="6000">${escapeHtml(noEquipment.directions || '')}</textarea></label>
          <label class="field"><span>Expected evidence</span><textarea id="lpNoEquipmentEvidence" rows="4" maxlength="4000">${escapeHtml(noEquipment.evidence || '')}</textarea></label>
        </div>
      </section>

      <label class="field lp-adult-only"><span>Adult planning notes · excluded from student preview</span><textarea id="lpAdultNotes" data-testid="lesson-pack-adult-notes" rows="4" maxlength="5000">${escapeHtml(pack.adultNotes || '')}</textarea></label>
      <div class="lp-actions">
        <button class="btn primary" type="button" data-lp-action="save" data-testid="lesson-pack-save">Save draft</button>
        <button class="btn" type="button" data-lp-action="duplicate">Duplicate</button>
        <button class="btn" type="button" data-lp-action="export" data-testid="lesson-pack-export">Export draft package</button>
        <button class="btn danger" type="button" data-lp-action="delete">Delete</button>
      </div>
    </form>`;
  }

  function lessonPackPromptList(items, emptyText){
    return items.length ? `<ol>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : `<p class="tiny muted">${escapeHtml(emptyText)}</p>`;
  }

  function lessonPackPreview(pack){
    if (!pack) return '<div class="lp-empty"><h3>No preview yet</h3><p>Create or select a lesson pack.</p></div>';
    const media = pack.mediaNeeds || {};
    const mediaItems = [
      media.heroImage && 'Hero image',
      media.supportingImages && 'Supporting images',
      media.diagramOrMap && 'Diagram/map',
      media.sourceLicenseReview && 'Source/license review',
      media.altText && 'Alt text'
    ].filter(Boolean);
    const noEquipment = pack.noEquipmentPath || {};
    return `<section class="lp-preview-shell" data-testid="lesson-pack-preview">
      <div class="lp-preview-heading"><div><div class="lp-kicker">Before / after preview</div><h3>Review without applying</h3></div><span class="pill">Draft-only overlay candidate</span></div>
      <div class="lp-preview-grid">
        <article class="lp-before-card" data-testid="lesson-pack-before-preview">
          <div class="lp-preview-label">Before · current live target</div>
          <h4>${escapeHtml(lessonPackTargetLabel(pack.targetScreen))}</h4>
          <p><b>Week:</b> ${escapeHtml(lessonPackWeekLabel(pack.targetWeekId))}</p>
          <p>The current lesson destination remains unchanged. Existing Curriculum Studio drafts and controlled overlays are not overwritten by this editor.</p>
          <div class="lp-safety-note">No live apply occurs in v10.37.</div>
        </article>
        <article class="lp-after-card" data-testid="lesson-pack-student-preview">
          <div class="lp-preview-label">After · proposed student-ready pack</div>
          <h4>${escapeHtml(pack.title)}</h4>
          <div class="lp-meta"><span>${escapeHtml(pack.subject)}</span><span>${escapeHtml(pack.track)}</span><span>${escapeHtml(lessonPackWeekLabel(pack.targetWeekId))}</span></div>
          <p class="lp-objective"><b>Objective:</b> ${escapeHtml(pack.objective)}</p>
          <div class="lp-student-sections">${(pack.sections || []).map((section,index) => `<section><h5>${index + 1}. ${escapeHtml(section.title)}</h5><p>${escapeHtml(section.body)}</p></section>`).join('')}</div>
          <section><h5>Practice</h5>${lessonPackPromptList(pack.practicePrompts || [], 'No practice prompts added.')}</section>
          <section><h5>Lab / project</h5>${lessonPackPromptList(pack.labPrompts || [], 'No lab or project prompts added.')}</section>
          ${noEquipment.enabled ? `<section class="lp-no-equipment-preview"><h5>No-equipment path</h5><p>${escapeHtml(noEquipment.directions)}</p><p><b>Show:</b> ${escapeHtml(noEquipment.evidence)}</p></section>` : ''}
          <section class="lp-media-preview"><h5>Planned media</h5><p>${mediaItems.length ? escapeHtml(mediaItems.join(' · ')) : 'No media needs selected yet.'}</p>${media.notes ? `<p>${escapeHtml(media.notes)}</p>` : ''}</section>
          <div class="lp-copyright-note">Student preview contains only the proposed original lesson, practice, lab, and no-equipment content. Adult notes and package controls are hidden.</div>
        </article>
      </div>
    </section>`;
  }

  function lessonPackList(drafts, activeId){
    if (!drafts.length) return '<div class="lp-empty"><h3>No lesson packs yet</h3><p>Create a structured draft or migrate a legacy Curriculum Studio draft.</p></div>';
    return `<div class="lp-pack-list">${drafts.map(pack => `
      <button class="lp-pack-row ${pack.id === activeId ? 'active' : ''}" type="button" data-lp-action="select" data-lp-id="${escapeHtml(pack.id)}">
        <span class="lp-pack-title">${escapeHtml(pack.title)}</span>
        <span class="lp-pack-meta">${escapeHtml(pack.subject)} · ${escapeHtml(pack.track)} · ${escapeHtml(pack.status)}</span>
        <span class="lp-pack-target">${escapeHtml(lessonPackTargetLabel(pack.targetScreen))}</span>
      </button>`).join('')}</div>`;
  }

  function lessonPackDirectorRollup(drafts){
    const ready = drafts.filter(pack => pack.status === 'ready').length;
    const noEquipment = drafts.filter(pack => pack.noEquipmentPath?.enabled).length;
    const mediaReady = drafts.filter(pack => pack.mediaNeeds?.sourceLicenseReview && pack.mediaNeeds?.altText).length;
    const sections = drafts.reduce((sum,pack) => sum + (pack.sections?.length || 0), 0);
    return `<div class="lp-director" data-testid="lesson-pack-director-rollup">
      <div class="lp-stat-grid">
        <div class="lp-stat"><b>${drafts.length}</b><span>Total packs</span></div>
        <div class="lp-stat"><b>${ready}</b><span>Ready drafts</span></div>
        <div class="lp-stat"><b>${sections}</b><span>Lesson sections</span></div>
        <div class="lp-stat"><b>${noEquipment}</b><span>No-equipment paths</span></div>
        <div class="lp-stat"><b>${mediaReady}</b><span>Media review-ready</span></div>
      </div>
      <section class="panel"><h3>Readiness rollup</h3>${drafts.length ? `<ul>${drafts.slice(0,12).map(pack => `<li><b>${escapeHtml(pack.title)}</b> · ${escapeHtml(pack.status)} · ${escapeHtml(lessonPackTargetLabel(pack.targetScreen))}</li>`).join('')}</ul>` : '<p>No lesson packs have been created.</p>'}</section>
      <section class="panel"><h3>Governance boundary</h3><p>Director view summarizes readiness only. Authoring, package import/export, legacy migration, and adult planning notes remain with Parent, Teacher, and Admin. No pack is applied from this screen.</p></section>
    </div>`;
  }

  function renderLessonPackEditor(){
    const el = document.getElementById('screen-lessonpacks');
    if (!el) return;
    const role = activeRole();
    const settings = ensureLessonPackState();
    if (role === 'student') {
      el.innerHTML = roleLimitedPanel('Adult lesson-pack workspace', 'Students see lesson content only after a separately governed apply step. Draft authoring, import/export, migration, and adult notes remain hidden.');
      return;
    }
    if (role === 'director') {
      el.innerHTML = `<div class="lp-shell" data-lesson-pack-editor="v10.37"><div class="lp-heading"><div><div class="lp-kicker">Lesson Pack Editor v1</div><h2>Curriculum draft readiness rollup</h2><p>Review structured draft readiness without exposing authoring details or applying curriculum.</p></div></div>${lessonPackDirectorRollup(settings.drafts)}</div>`;
      return;
    }
    if (!lessonPackCanEdit(role)) {
      el.innerHTML = roleLimitedPanel('Lesson-pack workspace unavailable', 'This role does not author structured curriculum drafts.');
      return;
    }
    const active = selectedLessonPack();
    if (active && settings.activePackId !== active.id) settings.activePackId = active.id;
    el.innerHTML = `<div class="lp-shell" data-lesson-pack-editor="v10.37">
      <div class="lp-heading">
        <div><div class="lp-kicker">Lesson Pack Editor v1</div><h2>Build a reversible lesson-pack draft</h2><p>Turn broad Curriculum Studio ideas into structured lesson sections, practice, lab prompts, media needs, and no-equipment paths before any controlled overlay apply.</p></div>
        <div class="lp-heading-actions">
          <button class="btn primary" type="button" data-lp-action="new" data-testid="lesson-pack-new">New pack</button>
          <button class="btn" type="button" data-lp-action="migrate" data-testid="lesson-pack-migrate">Import legacy Studio drafts</button>
          <button class="btn" type="button" data-lp-action="import" data-testid="lesson-pack-import">Import draft package</button>
          <input id="lpImportFile" data-testid="lesson-pack-import-file" type="file" accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="lp-boundary"><b>Boundary:</b> v10.37 edits and previews local drafts only. It does not apply an overlay, rewrite live curriculum, copy copyrighted lessons, or award XP for authoring.</div>
      <div class="lp-workspace">
        <aside class="lp-bank-panel"><div class="lp-panel-title"><h3>Lesson packs</h3><span>${settings.drafts.length}</span></div>${lessonPackList(settings.drafts, settings.activePackId)}</aside>
        <main class="lp-main-panel">${lessonPackEditor(active)}${lessonPackPreview(active)}</main>
      </div>
    </div>`;
  }

  function splitLessonPackLines(value){
    return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  }

  function readLessonPackFormRaw(pack){
    const sectionNodes = Array.from(document.querySelectorAll('#screen-lessonpacks [data-lp-section-index]'));
    const sections = sectionNodes.map((node,index) => ({
      id: node.querySelector('[data-lp-section-id]')?.value || lessonSectionId(pack, `section${index + 1}`),
      title: node.querySelector('[data-lp-section-title]')?.value || '',
      body: node.querySelector('[data-lp-section-body]')?.value || ''
    }));
    return {
      ...pack,
      title: document.getElementById('lpTitle')?.value || '',
      subject: document.getElementById('lpSubject')?.value || '',
      track: document.getElementById('lpTrack')?.value || '',
      targetWeekId: document.getElementById('lpWeek')?.value || '',
      targetScreen: document.getElementById('lpTarget')?.value || 'lessonplayer',
      status: document.getElementById('lpStatus')?.value || 'draft',
      objective: document.getElementById('lpObjective')?.value || '',
      sections,
      practicePrompts: splitLessonPackLines(document.getElementById('lpPractice')?.value),
      labPrompts: splitLessonPackLines(document.getElementById('lpLabs')?.value),
      mediaNeeds: {
        heroImage: !!document.getElementById('lpMediaHero')?.checked,
        supportingImages: !!document.getElementById('lpMediaSupporting')?.checked,
        diagramOrMap: !!document.getElementById('lpMediaDiagram')?.checked,
        sourceLicenseReview: !!document.getElementById('lpMediaLicense')?.checked,
        altText: !!document.getElementById('lpMediaAlt')?.checked,
        notes: document.getElementById('lpMediaNotes')?.value || ''
      },
      noEquipmentPath: {
        enabled: !!document.getElementById('lpNoEquipmentEnabled')?.checked,
        directions: document.getElementById('lpNoEquipmentDirections')?.value || '',
        evidence: document.getElementById('lpNoEquipmentEvidence')?.value || ''
      },
      adultNotes: document.getElementById('lpAdultNotes')?.value || '',
      applyMode: 'draft-only',
      updatedAt: new Date().toISOString()
    };
  }

  function syncLessonPackRaw(){
    const settings = ensureLessonPackState();
    const pack = selectedLessonPack();
    if (!pack || !document.getElementById('lpTitle')) return pack;
    const raw = readLessonPackFormRaw(pack);
    const index = settings.drafts.findIndex(item => item.id === pack.id);
    if (index >= 0) settings.drafts[index] = raw;
    return raw;
  }

  function saveLessonPack(){
    const settings = ensureLessonPackState();
    const pack = selectedLessonPack();
    if (!pack) return;
    try {
      const normalized = window.BLHLessonPacks.normalizeLessonPackDraft(readLessonPackFormRaw(pack));
      const index = settings.drafts.findIndex(item => item.id === pack.id);
      if (index < 0) throw new Error('Selected lesson pack no longer exists.');
      settings.drafts[index] = normalized;
      settings.activePackId = normalized.id;
      saveState();
      toast('Lesson-pack draft saved · live curriculum unchanged');
    } catch (error) {
      toast(`Save failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function addLessonPack(){
    const settings = ensureLessonPackState();
    const pack = newLessonPack();
    settings.drafts.push(pack);
    settings.activePackId = pack.id;
    saveState();
    toast('New lesson-pack draft created');
  }

  function duplicateLessonPack(){
    const settings = ensureLessonPackState();
    const source = syncLessonPackRaw() || selectedLessonPack();
    if (!source) return;
    const now = new Date().toISOString();
    const copy = {
      ...source,
      id: lessonPackId('lp_copy'),
      title: `${source.title || 'Lesson pack'} · Copy`,
      status: 'draft',
      sourceDraftId: '',
      sections: (source.sections || []).map((section,index) => ({ ...section, id: `section_copy_${Date.now().toString(36)}_${index + 1}` })),
      createdAt: now,
      updatedAt: now
    };
    settings.drafts.push(copy);
    settings.activePackId = copy.id;
    saveState();
    toast('Lesson-pack draft duplicated');
  }

  function deleteLessonPack(){
    const settings = ensureLessonPackState();
    const pack = selectedLessonPack();
    if (!pack) return;
    if (!confirm(`Delete “${pack.title}”? Existing Curriculum Studio drafts and live curriculum are unaffected.`)) return;
    settings.drafts = settings.drafts.filter(item => item.id !== pack.id);
    settings.activePackId = settings.drafts[0]?.id || '';
    saveState();
    toast('Lesson-pack draft deleted');
  }

  function sectionAction(action,index){
    const pack = syncLessonPackRaw();
    if (!pack) return;
    pack.sections ||= [];
    if (action === 'section-add') pack.sections.push({ id: lessonSectionId(pack), title: 'New section', body: 'Add original student-facing content.' });
    if (action === 'section-remove' && pack.sections.length > 1) pack.sections.splice(index,1);
    if (action === 'section-up' && index > 0) [pack.sections[index - 1], pack.sections[index]] = [pack.sections[index], pack.sections[index - 1]];
    if (action === 'section-down' && index < pack.sections.length - 1) [pack.sections[index + 1], pack.sections[index]] = [pack.sections[index], pack.sections[index + 1]];
    renderLessonPackEditor();
  }

  function lessonPackFileName(pack){
    return `beaufort-learning-harbor-lesson-pack-${lessonPackSafeId(pack.title || pack.id)}-v10.37.json`;
  }

  function exportLessonPack(){
    const pack = selectedLessonPack();
    if (!pack) return;
    try {
      const normalized = window.BLHLessonPacks.normalizeLessonPackDraft(readLessonPackFormRaw(pack));
      const serialized = window.BLHLessonPacks.serializeLessonPackPackage(normalized, { productVersion: '10.37' });
      downloadText(lessonPackFileName(normalized), serialized, 'application/json');
      toast('Lesson-pack draft package exported');
    } catch (error) {
      toast(`Export failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function importLessonPack(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const settings = ensureLessonPackState();
      const prior = settings.drafts.slice();
      const priorActive = settings.activePackId;
      try {
        const lessonPackage = window.BLHLessonPacks.parseLessonPackPackage(String(reader.result || ''));
        const pack = lessonPackage.pack;
        const existing = settings.drafts.findIndex(item => item.id === pack.id);
        if (existing >= 0 && !confirm(`Replace the local draft “${settings.drafts[existing].title}” with the validated imported package?`)) return;
        if (existing >= 0) settings.drafts[existing] = pack; else settings.drafts.push(pack);
        settings.activePackId = pack.id;
        saveState();
        toast('Validated lesson-pack draft imported');
      } catch (error) {
        settings.drafts = prior;
        settings.activePackId = priorActive;
        toast(`Import failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  function legacyLessonPackTarget(area){
    const text = String(area || '').toLowerCase();
    if (/biology/.test(text)) return 'biology';
    if (/latin/.test(text)) return 'latin';
    if (/literature|composition/.test(text)) return 'literature';
    if (/trial|civic/.test(text)) return 'mocktrial';
    if (/spanish/.test(text)) return 'spanish';
    if (/botany/.test(text)) return 'botany';
    if (/ancient|history/.test(text)) return 'ancient';
    if (/logic|fallacy/.test(text)) return 'logic';
    if (/writing|narration/.test(text)) return 'writing';
    if (/life|practical|home ec/.test(text)) return 'practical';
    return 'lessonplayer';
  }

  function readLegacyLessonDrafts(){
    const output = [];
    for (const key of BLH_LESSON_PACK_LEGACY_KEYS) {
      let value;
      try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch { value = null; }
      const drafts = Array.isArray(value) ? value : (Array.isArray(value?.drafts) ? value.drafts : []);
      drafts.forEach((raw,index) => output.push({ key, raw, index }));
    }
    return output;
  }

  function normalizeLegacyLessonDraft(entry){
    const raw = entry.raw || {};
    const sourceDraftId = String(raw.id || `${entry.key}:${entry.index}`);
    const content = String(raw.lesson || raw.content || raw.changes || raw.notes || 'Review and expand this migrated Curriculum Studio draft.').trim();
    const assessment = String(raw.assessment || raw.quiz || raw.prompts || '').trim();
    const media = String(raw.media || raw.mediaNeeds || raw.visuals || '').trim();
    const title = String(raw.title || raw.topic || raw.name || 'Migrated lesson draft').trim();
    const now = new Date().toISOString();
    return window.BLHLessonPacks.normalizeLessonPackDraft({
      id: `lp_legacy_${lessonPackSafeId(sourceDraftId)}`,
      title,
      subject: String(raw.area || raw.subject || raw.kind || 'General studies'),
      track: String(raw.track || raw.learner || raw.student || 'All learners'),
      targetWeekId: String(raw.weekId || ''),
      targetScreen: legacyLessonPackTarget(`${raw.area || ''} ${raw.topic || ''}`),
      status: 'draft',
      objective: String(raw.goal || raw.objective || `Refine the migrated draft for ${title}.`),
      sections: [{ id:`section_legacy_${lessonPackSafeId(sourceDraftId)}`, title:'Lesson draft', body:content }],
      practicePrompts: splitLessonPackLines(assessment),
      labPrompts: [],
      mediaNeeds: { heroImage:!!media, supportingImages:false, diagramOrMap:/diagram|map|model/i.test(media), sourceLicenseReview:!!media, altText:!!media, notes:media },
      noEquipmentPath: { enabled:false, directions:'', evidence:'' },
      adultNotes: String(raw.reviewNotes || raw.applyNotes || raw.notes || ''),
      sourceDraftId,
      createdAt: String(raw.createdAt || raw.created || now),
      updatedAt: now
    });
  }

  function migrateLegacyLessonDrafts(){
    const settings = ensureLessonPackState();
    const existingSources = new Set(settings.drafts.map(pack => pack.sourceDraftId).filter(Boolean));
    let added = 0;
    for (const entry of readLegacyLessonDrafts()) {
      try {
        const pack = normalizeLegacyLessonDraft(entry);
        if (existingSources.has(pack.sourceDraftId) || settings.drafts.some(item => item.id === pack.id)) continue;
        settings.drafts.push(pack);
        existingSources.add(pack.sourceDraftId);
        added += 1;
      } catch (error) {
        console.warn('Lesson-pack legacy draft skipped', error);
      }
    }
    if (added) settings.activePackId = settings.drafts[settings.drafts.length - added]?.id || settings.activePackId;
    saveState();
    toast(added ? `${added} legacy Curriculum Studio draft${added === 1 ? '' : 's'} imported without modifying the source stores` : 'No new compatible legacy drafts found');
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-lp-action]');
    if (!control) return;
    if (!lessonPackCanEdit(activeRole())) return;
    const action = control.dataset.lpAction;
    if (action === 'new') addLessonPack();
    if (action === 'select') {
      ensureLessonPackState().activePackId = control.dataset.lpId || '';
      renderLessonPackEditor();
    }
    if (action === 'save') saveLessonPack();
    if (action === 'duplicate') duplicateLessonPack();
    if (action === 'delete') deleteLessonPack();
    if (action === 'export') exportLessonPack();
    if (action === 'import') document.getElementById('lpImportFile')?.click();
    if (action === 'migrate') migrateLegacyLessonDrafts();
    if (/^section-/.test(action)) sectionAction(action, Number(control.dataset.lpIndex || 0));
  });

  document.addEventListener('change', event => {
    if (event.target?.id !== 'lpImportFile') return;
    importLessonPack(event.target.files?.[0]);
    event.target.value = '';
  });

  window.BLHLessonPackUI = Object.freeze({
    release: BLH_LESSON_PACK_RELEASE,
    ensureState: ensureLessonPackState,
    migrateLegacyDrafts: migrateLegacyLessonDrafts,
    render: renderLessonPackEditor
  });

  function renderV1037ReleaseNote(){
    const list = document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.37-lesson-pack-editor"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.37-lesson-pack-editor"><b>v10.37 Lesson Pack Editor v1</b><p>Added structured lesson sections, practice/lab prompts, media-needs checks, no-equipment paths, before/after preview, deterministic draft-package import/export, and non-destructive Curriculum Studio migration. Live curriculum remains unchanged until a separately governed reversible apply step.</p></div>');
    }
  }

  const v1037BaseRenderAll = renderAll;
  renderAll = function(){
    v1037BaseRenderAll();
    renderLessonPackEditor();
    renderV1037ReleaseNote();
  };
