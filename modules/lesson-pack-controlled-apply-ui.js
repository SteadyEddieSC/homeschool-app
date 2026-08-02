  const BLH_LESSON_PACK_APPLY_RELEASE = 'v10.43';

  function ensureLessonPackApplyState(){
    state.ui ||= {};
    const current = state.ui.lessonPackControlledApply;
    try {
      state.ui.lessonPackControlledApply = window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace(current || {});
    } catch (error) {
      state.ui.lessonPackControlledApply = window.BLHLessonPackApply.normalizeLessonPackControlledApplyWorkspace({});
      toast(`Controlled-apply workspace reset: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
    state.ui.lessonPackApplyDrafts ||= {};
    if (!state.ui.lessonPackApplyDrafts || typeof state.ui.lessonPackApplyDrafts !== 'object' || Array.isArray(state.ui.lessonPackApplyDrafts)) {
      state.ui.lessonPackApplyDrafts = {};
    }
    return state.ui.lessonPackControlledApply;
  }

  function lessonPackApplyCanManage(role = activeRole()){
    return ['parent','teacher','admin'].includes(role);
  }

  function lessonPackApplyDraft(pack){
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
  }

  function lessonPackApplySelection(pack, draft){
    return {
      includeObjective:Boolean(draft.includeObjective),
      sectionIds:(draft.sectionIds || []).filter(id => (pack.sections || []).some(section => section.id === id)),
      includePractice:Boolean(draft.includePractice),
      includeLabs:Boolean(draft.includeLabs),
      includeNoEquipment:Boolean(draft.includeNoEquipment),
      includeMediaPlan:Boolean(draft.includeMediaPlan)
    };
  }

  function lessonPackApplyRequest(pack, draft){
    return {
      targetScreen:pack.targetScreen,
      targetWeekId:pack.targetWeekId || '',
      selection:lessonPackApplySelection(pack, draft),
      contentRightsAttested:Boolean(draft.contentRightsAttested),
      mediaLicenseReviewed:Boolean(draft.mediaLicenseReviewed),
      mediaProvenanceReviewed:Boolean(draft.mediaProvenanceReviewed),
      auditNote:String(draft.auditNote || '').trim()
    };
  }

  function lessonPackApplyActiveAtTarget(workspace, pack){
    return window.BLHLessonPackApply.listActiveLessonPackOverlays(workspace, {
      targetScreen:pack.targetScreen,
      targetWeekId:pack.targetWeekId || ''
    });
  }

  function lessonPackApplyComponentPreview(pack, selection){
    const chosenSections = (pack.sections || []).filter(section => selection.sectionIds.includes(section.id));
    const parts = [];
    if (selection.includeObjective) parts.push(`<section><h5>Objective</h5><p>${escapeHtml(pack.objective || '')}</p></section>`);
    if (chosenSections.length) parts.push(chosenSections.map((section,index) => `<section><h5>${index + 1}. ${escapeHtml(section.title)}</h5><p>${escapeHtml(section.body)}</p></section>`).join(''));
    if (selection.includePractice) parts.push(`<section><h5>Practice</h5>${lessonPackPromptList(pack.practicePrompts || [], 'No practice prompts.')}</section>`);
    if (selection.includeLabs) parts.push(`<section><h5>Lab / project</h5>${lessonPackPromptList(pack.labPrompts || [], 'No lab prompts.')}</section>`);
    if (selection.includeNoEquipment && pack.noEquipmentPath?.enabled) parts.push(`<section class="lpa-no-equipment"><h5>No-equipment path</h5><p>${escapeHtml(pack.noEquipmentPath.directions || '')}</p><p><b>Evidence:</b> ${escapeHtml(pack.noEquipmentPath.evidence || '')}</p></section>`);
    if (selection.includeMediaPlan) parts.push(`<section><h5>Media plan</h5><p>${escapeHtml(pack.mediaNeeds?.notes || 'Reviewed media needs from this lesson pack.')}</p></section>`);
    return parts.join('') || '<p class="muted">Choose at least one student-facing component.</p>';
  }

  function lessonPackApplyReadiness(pack, draft){
    const selection = lessonPackApplySelection(pack, draft);
    const issues = [];
    if (pack.status !== 'ready') issues.push('Mark the lesson pack Ready.');
    if (!(selection.includeObjective || selection.sectionIds.length || selection.includePractice || selection.includeLabs || selection.includeNoEquipment || selection.includeMediaPlan)) issues.push('Select at least one component.');
    if (!draft.contentRightsAttested) issues.push('Confirm original/OER/public-domain/nonprofit/government-use rights.');
    if (selection.includeMediaPlan && (!draft.mediaLicenseReviewed || !draft.mediaProvenanceReviewed)) issues.push('Complete both media license and provenance checks.');
    if (!String(draft.auditNote || '').trim()) issues.push('Add an audit note.');
    return issues;
  }

  function lessonPackApplyHistory(workspace, pack){
    const entries = workspace.overlays.filter(overlay => overlay.sourcePack.id === pack.id || (overlay.targetScreen === pack.targetScreen && overlay.targetWeekId === (pack.targetWeekId || ''))).slice().reverse();
    if (!entries.length) return '<p class="muted">No controlled-apply history for this pack or destination.</p>';
    return `<div class="lpa-history-list">${entries.map(overlay => `
      <article class="lpa-history-card" data-overlay-status="${escapeHtml(overlay.status)}">
        <div class="lpa-history-head"><div><b>${escapeHtml(overlay.sourcePack.title)}</b><p>${escapeHtml(lessonPackTargetLabel(overlay.targetScreen))} · ${escapeHtml(lessonPackWeekLabel(overlay.targetWeekId))}</p></div><span class="pill">${escapeHtml(overlay.status)}</span></div>
        <p class="tiny muted">Applied ${escapeHtml(new Date(overlay.appliedAt).toLocaleString())} · fingerprint ${escapeHtml(overlay.fingerprint)}</p>
        ${overlay.status === 'active' ? `<label class="field"><span>Rollback audit note</span><textarea data-lpa-rollback-note="${escapeHtml(overlay.id)}" rows="2" maxlength="1000" placeholder="Explain why this active overlay should be rolled back."></textarea></label><button class="btn danger" type="button" data-lpa-action="rollback" data-overlay-id="${escapeHtml(overlay.id)}" data-testid="lesson-pack-rollback">Rollback active overlay</button>` : ''}
      </article>`).join('')}</div>`;
  }

  function lessonPackApplyPanel(pack){
    const workspace = ensureLessonPackApplyState();
    const draft = lessonPackApplyDraft(pack);
    const selection = lessonPackApplySelection(pack, draft);
    const active = lessonPackApplyActiveAtTarget(workspace, pack);
    const issues = lessonPackApplyReadiness(pack, draft);
    const mediaSelected = selection.includeMediaPlan;
    return `<section class="lpa-shell" data-lesson-pack-apply="${BLH_LESSON_PACK_APPLY_RELEASE}" data-testid="lesson-pack-controlled-apply">
      <div class="lpa-heading"><div><div class="lp-kicker">Controlled Apply v1</div><h3>Review, apply, and roll back a browser-local overlay</h3><p>Source lesson packs, destination source content, progress, rewards, grades, attendance, mastery, and portfolio records remain unchanged.</p></div><span class="pill">Local device only</span></div>
      ${pack.status !== 'ready' ? '<div class="lpa-warning"><b>Not ready to apply.</b> Save this lesson pack with status Ready after adult review.</div>' : ''}
      <div class="lpa-grid">
        <section class="lpa-review-card">
          <div class="lpa-card-heading"><div><div class="lp-preview-label">1 · Select reviewed content</div><h4>${escapeHtml(pack.title)}</h4></div><span>${escapeHtml(lessonPackTargetLabel(pack.targetScreen))}</span></div>
          <div class="lpa-check-list">
            <label><input type="checkbox" data-lpa-field="includeObjective" ${draft.includeObjective ? 'checked' : ''}> Learning objective</label>
            ${(pack.sections || []).map(section => `<label><input type="checkbox" data-lpa-section="${escapeHtml(section.id)}" ${(draft.sectionIds || []).includes(section.id) ? 'checked' : ''}> Section · ${escapeHtml(section.title)}</label>`).join('')}
            <label><input type="checkbox" data-lpa-field="includePractice" ${draft.includePractice ? 'checked' : ''} ${(pack.practicePrompts || []).length ? '' : 'disabled'}> Practice prompts</label>
            <label><input type="checkbox" data-lpa-field="includeLabs" ${draft.includeLabs ? 'checked' : ''} ${(pack.labPrompts || []).length ? '' : 'disabled'}> Lab/project prompts</label>
            <label><input type="checkbox" data-lpa-field="includeNoEquipment" ${draft.includeNoEquipment ? 'checked' : ''} ${pack.noEquipmentPath?.enabled ? '' : 'disabled'}> No-equipment alternative</label>
            <label><input type="checkbox" data-lpa-field="includeMediaPlan" ${draft.includeMediaPlan ? 'checked' : ''}> Media plan</label>
          </div>
          <button class="btn small" type="button" data-lpa-action="select-all">Select all available</button>
        </section>
        <section class="lpa-review-card">
          <div class="lp-preview-label">2 · Rights and review gates</div>
          <label class="lpa-attest"><input type="checkbox" data-lpa-field="contentRightsAttested" ${draft.contentRightsAttested ? 'checked' : ''}> I reviewed this content and confirm it is original or approved OER, public-domain, nonprofit, or government-use material. It is not copied proprietary curriculum text.</label>
          <label class="lpa-attest ${mediaSelected ? '' : 'muted'}"><input type="checkbox" data-lpa-field="mediaLicenseReviewed" ${draft.mediaLicenseReviewed ? 'checked' : ''} ${mediaSelected ? '' : 'disabled'}> Media license/use terms reviewed</label>
          <label class="lpa-attest ${mediaSelected ? '' : 'muted'}"><input type="checkbox" data-lpa-field="mediaProvenanceReviewed" ${draft.mediaProvenanceReviewed ? 'checked' : ''} ${mediaSelected ? '' : 'disabled'}> Media source/provenance reviewed</label>
          <label class="field"><span>Required audit note</span><textarea data-lpa-field="auditNote" rows="3" maxlength="1000" placeholder="What was reviewed, and why should this overlay become active?">${escapeHtml(draft.auditNote || '')}</textarea></label>
        </section>
      </div>
      <section class="lpa-compare" data-testid="lesson-pack-apply-comparison">
        <article><div class="lp-preview-label">Before · active destination state</div><h4>${escapeHtml(lessonPackTargetLabel(pack.targetScreen))}</h4><p><b>${active.length}</b> active lesson-pack overlay${active.length === 1 ? '' : 's'} at ${escapeHtml(lessonPackWeekLabel(pack.targetWeekId))}.</p>${active.length ? `<ul>${active.map(item => `<li>${escapeHtml(item.sourcePack.title)}</li>`).join('')}</ul>` : '<p class="muted">Destination source content remains as authored, with no active Lesson Pack overlay.</p>'}</article>
        <article><div class="lp-preview-label">After · proposed student-safe overlay</div><h4>${escapeHtml(pack.title)}</h4>${lessonPackApplyComponentPreview(pack, selection)}</article>
      </section>
      <div class="lpa-confirm-row">
        <div>${issues.length ? `<b>Review required</b><ul>${issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>` : '<b>Ready for explicit apply.</b><p class="muted">Applying will supersede active overlays at this same destination and preserve them for rollback.</p>'}</div>
        <button class="btn primary" type="button" data-lpa-action="apply" data-testid="lesson-pack-confirm-apply" ${issues.length ? 'disabled' : ''}>Confirm controlled apply</button>
      </div>
      <section class="lpa-history"><div class="lpa-card-heading"><div><div class="lp-preview-label">Audit and rollback</div><h4>Local overlay history</h4></div><span>${workspace.audit.length} capped audit entries</span></div>${lessonPackApplyHistory(workspace, pack)}</section>
    </section>`;
  }

  function lessonPackApplyDirectorSummary(){
    const workspace = ensureLessonPackApplyState();
    const active = workspace.overlays.filter(overlay => overlay.status === 'active');
    const destinations = [...new Set(active.map(overlay => `${lessonPackTargetLabel(overlay.targetScreen)} · ${lessonPackWeekLabel(overlay.targetWeekId)}`))];
    return `<section class="lpa-director-rollup" data-testid="lesson-pack-apply-director-rollup"><div class="lpa-heading"><div><div class="lp-kicker">Lesson Pack Controlled Apply v1</div><h3>Read-only overlay rollup</h3><p>Director view reports local overlay state only. Apply, rights review, audit notes, reviewer details, and rollback controls remain with Parent, Teacher, and Admin roles.</p></div><span class="pill">Read-only</span></div><div class="lpa-stat-grid"><div><b>${active.length}</b><span>Active overlays</span></div><div><b>${workspace.overlays.filter(item => item.status === 'superseded').length}</b><span>Superseded</span></div><div><b>${workspace.overlays.filter(item => item.status === 'rolled-back').length}</b><span>Rolled back</span></div><div><b>${workspace.audit.length}</b><span>Audit entries</span></div></div><div class="lpa-destination-list">${destinations.length ? destinations.map(item => `<span>${escapeHtml(item)}</span>`).join('') : '<span>No active lesson-pack overlays</span>'}</div></section>`;
  }

  function enhanceLessonPackControlledApply(){
    const host = document.getElementById('screen-lessonpacks');
    if (!host) return;
    if (activeRole() === 'director') {
      if (!host.querySelector('[data-testid="lesson-pack-apply-director-rollup"]')) host.insertAdjacentHTML('beforeend', lessonPackApplyDirectorSummary());
      return;
    }
    if (!lessonPackApplyCanManage(activeRole())) return;
    const pack = selectedLessonPack();
    if (!pack || host.querySelector('[data-testid="lesson-pack-controlled-apply"]')) return;
    host.insertAdjacentHTML('beforeend', lessonPackApplyPanel(pack));
  }

  function lessonPackOverlayStudentHtml(model){
    const content = model.content;
    return `<article class="lpa-destination-card" data-testid="lesson-pack-active-overlay">
      <div class="lpa-destination-heading"><div><div class="lp-kicker">Lesson Pack overlay · local device</div><h3>${escapeHtml(model.source.title)}</h3><p>${escapeHtml(model.source.subject)} · ${escapeHtml(model.source.track)}</p></div><span class="pill">Reviewed</span></div>
      ${content.objective ? `<section><h4>Objective</h4><p>${escapeHtml(content.objective)}</p></section>` : ''}
      ${(content.sections || []).map((section,index) => `<section><h4>${index + 1}. ${escapeHtml(section.title)}</h4><p>${escapeHtml(section.body)}</p></section>`).join('')}
      ${(content.practicePrompts || []).length ? `<section><h4>Practice</h4>${lessonPackPromptList(content.practicePrompts, '')}</section>` : ''}
      ${(content.labPrompts || []).length ? `<section><h4>Lab / project</h4>${lessonPackPromptList(content.labPrompts, '')}</section>` : ''}
      ${content.noEquipmentPath ? `<section class="lpa-no-equipment"><h4>No-equipment option</h4><p>${escapeHtml(content.noEquipmentPath.directions)}</p><p><b>Show:</b> ${escapeHtml(content.noEquipmentPath.evidence)}</p></section>` : ''}
      ${content.mediaPlan ? `<section><h4>Media plan</h4><p>${escapeHtml(content.mediaPlan.notes || 'Reviewed media support may be used with this lesson.')}</p></section>` : ''}
      <div class="lp-copyright-note">This view contains student-facing overlay content only. Adult review notes, rights attestations, audit details, reviewer role, and rollback controls are excluded.</div>
    </article>`;
  }

  function renderLessonPackDestinationOverlays(screenId = ''){
    const workspace = ensureLessonPackApplyState();
    const targets = screenId ? [screenId] : [...new Set(workspace.overlays.map(overlay => overlay.targetScreen))];
    targets.forEach(target => {
      const host = document.getElementById(`screen-${target}`);
      if (!host) return;
      const active = window.BLHLessonPackApply.listActiveLessonPackOverlays(workspace, { targetScreen:target });
      const models = active.map(overlay => window.BLHLessonPackApply.createStudentSafeLessonPackOverlay(overlay));
      const signature = models.map(model => JSON.stringify(model)).join('|');
      let outlet = host.querySelector('[data-lpa-destination-host]');
      if (!models.length) {
        outlet?.remove();
        return;
      }
      if (outlet?.dataset.signature === signature) return;
      if (!outlet) {
        outlet = document.createElement('section');
        outlet.setAttribute('data-lpa-destination-host', '');
        host.appendChild(outlet);
      }
      outlet.dataset.signature = signature;
      outlet.innerHTML = models.map(lessonPackOverlayStudentHtml).join('');
    });
  }

  function enhanceLessonPackDirectorRollup(){
    const host = document.getElementById('screen-director');
    if (!host || activeRole() !== 'director' || host.querySelector('[data-testid="lesson-pack-apply-director-rollup"]')) return;
    host.insertAdjacentHTML('beforeend', lessonPackApplyDirectorSummary());
  }

  function lessonPackApplyRefresh(){
    renderLessonPackEditor();
    enhanceLessonPackControlledApply();
    renderLessonPackDestinationOverlays();
    enhanceLessonPackDirectorRollup();
  }

  document.addEventListener('change', event => {
    const field = event.target.closest('[data-lpa-field]');
    const section = event.target.closest('[data-lpa-section]');
    if (!field && !section) return;
    if (!lessonPackApplyCanManage(activeRole())) return;
    const pack = selectedLessonPack();
    if (!pack) return;
    const draft = lessonPackApplyDraft(pack);
    if (field) {
      const key = field.dataset.lpaField;
      draft[key] = field.type === 'checkbox' ? field.checked : field.value;
    }
    if (section) {
      const id = section.dataset.lpaSection;
      const selected = new Set(draft.sectionIds || []);
      if (section.checked) selected.add(id); else selected.delete(id);
      draft.sectionIds = [...selected];
    }
    lessonPackApplyRefresh();
  });

  document.addEventListener('input', event => {
    const field = event.target.closest('[data-lpa-field="auditNote"]');
    if (!field || !lessonPackApplyCanManage(activeRole())) return;
    const pack = selectedLessonPack();
    if (!pack) return;
    lessonPackApplyDraft(pack).auditNote = field.value;
    const button = document.querySelector('[data-testid="lesson-pack-confirm-apply"]');
    if (button) button.disabled = Boolean(lessonPackApplyReadiness(pack, lessonPackApplyDraft(pack)).length);
  });

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-lpa-action]');
    if (!control) return;
    if (!lessonPackApplyCanManage(activeRole())) return toast('Student and Director roles cannot manage Lesson Pack overlays');
    const pack = selectedLessonPack();
    const workspace = ensureLessonPackApplyState();
    const action = control.dataset.lpaAction;
    if (action === 'select-all' && pack) {
      const draft = lessonPackApplyDraft(pack);
      draft.includeObjective = true;
      draft.sectionIds = (pack.sections || []).map(section => section.id);
      draft.includePractice = Boolean((pack.practicePrompts || []).length);
      draft.includeLabs = Boolean((pack.labPrompts || []).length);
      draft.includeNoEquipment = Boolean(pack.noEquipmentPath?.enabled);
      draft.includeMediaPlan = Boolean(pack.mediaNeeds && Object.values(pack.mediaNeeds).some(Boolean));
      return lessonPackApplyRefresh();
    }
    if (action === 'apply' && pack) {
      try {
        const result = window.BLHLessonPackApply.applyLessonPackOverlay(workspace, pack, lessonPackApplyRequest(pack, lessonPackApplyDraft(pack)), {
          role:activeRole(),
          now:new Date().toISOString()
        });
        state.ui.lessonPackControlledApply = result.workspace;
        lessonPackApplyDraft(pack).auditNote = '';
        saveState();
        toast(`Controlled overlay applied · ${result.overlay.fingerprint} · source pack and progress records unchanged`);
        lessonPackApplyRefresh();
      } catch (error) {
        toast(`Controlled apply failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
      return;
    }
    if (action === 'rollback') {
      const overlayId = control.dataset.overlayId || '';
      const note = document.querySelector(`[data-lpa-rollback-note="${CSS.escape(overlayId)}"]`)?.value || '';
      try {
        const result = window.BLHLessonPackApply.rollbackLessonPackOverlay(workspace, overlayId, { auditNote:note }, {
          role:activeRole(),
          now:new Date().toISOString()
        });
        state.ui.lessonPackControlledApply = result.workspace;
        saveState();
        toast(`Overlay rolled back · ${result.restoredOverlayIds.length ? 'prior active state restored' : 'destination returned to source content only'}`);
        lessonPackApplyRefresh();
      } catch (error) {
        toast(`Rollback failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
    }
  });

  const BLH_LPA_BASE_RENDER_LESSON_PACK_EDITOR = renderLessonPackEditor;
  renderLessonPackEditor = function(){
    const result = BLH_LPA_BASE_RENDER_LESSON_PACK_EDITOR.apply(this, arguments);
    enhanceLessonPackControlledApply();
    return result;
  };

  function renderV1043ReleaseNote(){
    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.43-lesson-pack-controlled-apply"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.43-lesson-pack-controlled-apply"><b>v10.43 Lesson Pack Controlled Apply v1</b><p>Added explicit selective review, rights and media gates, browser-local student-safe overlays, deterministic fingerprints, destination comparison, audited rollback, and prior-state restoration without rewriting source lessons or learner records.</p></div>');
    }
  }

  const BLH_LPA_BASE_RENDER_ALL = renderAll;
  renderAll = function(){
    const result = BLH_LPA_BASE_RENDER_ALL.apply(this, arguments);
    renderV1043ReleaseNote();
    const activeScreen = document.querySelector('.screen.active')?.id?.replace(/^screen-/, '') || '';
    renderLessonPackDestinationOverlays(activeScreen);
    if (activeScreen === 'lessonpacks') enhanceLessonPackControlledApply();
    if (activeScreen === 'director') enhanceLessonPackDirectorRollup();
    return result;
  };

  const BLH_LPA_BASE_SHOW_SCREEN = showScreen;
  showScreen = function(id){
    const result = BLH_LPA_BASE_SHOW_SCREEN.apply(this, arguments);
    renderLessonPackDestinationOverlays(id);
    if (id === 'lessonpacks') enhanceLessonPackControlledApply();
    if (id === 'director') enhanceLessonPackDirectorRollup();
    return result;
  };

  window.BLHLessonPackApplyUI = Object.freeze({
    enhance:enhanceLessonPackControlledApply,
    renderDestinations:renderLessonPackDestinationOverlays,
    renderDirectorRollup:enhanceLessonPackDirectorRollup
  });
