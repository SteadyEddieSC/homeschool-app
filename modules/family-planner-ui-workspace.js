        <label class="field"><span>Day</span><select id="fpDay">${familyPlannerDayOptions(item.day)}</select></label>
        <label class="field"><span>Item type</span><select id="fpType">${familyPlannerTypeOptions(item.itemType)}</select></label>
        <label class="field"><span>Start time</span><input id="fpStart" type="time" value="${escapeHtml(item.startTime || '')}"></label>
        <label class="field"><span>End time</span><input id="fpEnd" type="time" value="${escapeHtml(item.endTime || '')}"></label>
        <label class="field"><span>Learner / track target</span><select id="fpTarget">${familyPlannerTargetOptions(item)}</select></label>
        <label class="field"><span>Status</span><select id="fpStatus">${familyPlannerStatusOptions(item.status)}</select></label>
        <label class="field"><span>Subject</span><input id="fpSubject" maxlength="180" value="${escapeHtml(item.subject || '')}"></label>
        <label class="field"><span>Location</span><input id="fpLocation" maxlength="240" value="${escapeHtml(item.location || '')}"></label>
        <label class="field"><span>Linked source</span><select id="fpSourceScreen">${familyPlannerSourceOptions(item.sourceScreen)}</select></label>
        <label class="field"><span>Source record ID</span><input id="fpSourceId" maxlength="180" value="${escapeHtml(item.sourceId || '')}" placeholder="Optional source identifier"></label>
        <label class="field fp-span-2"><span>Student-safe directions</span><textarea id="fpDirections" data-testid="family-planner-directions" rows="4" maxlength="6000">${escapeHtml(item.studentDirections || '')}</textarea></label>
      </div>
      <section class="fp-editor-block"><div class="fp-block-heading"><div><h4>Optional co-op coordination</h4><p>Use roles and logistics only when the week includes a shared class, presentation, lab, or event.</p></div><label class="fp-toggle"><input id="fpCoOpEnabled" data-testid="family-planner-coop" type="checkbox" ${coOp.enabled ? 'checked' : ''}> Include co-op details</label></div>
        <div class="fp-form-grid">
          <label class="field"><span>Class / event</span><input id="fpCoOpEvent" maxlength="240" value="${escapeHtml(coOp.eventName || '')}"></label>
          <label class="field"><span>Responsible adult role</span><input id="fpCoOpRole" maxlength="160" value="${escapeHtml(coOp.role || '')}" placeholder="Teacher, parent helper, setup lead…"></label>
          <label class="field"><span>Materials</span><textarea id="fpCoOpMaterials" rows="3" maxlength="2000">${escapeHtml(coOp.materials || '')}</textarea></label>
          <label class="field"><span>Arrival / handoff notes</span><textarea id="fpCoOpArrival" rows="3" maxlength="2000">${escapeHtml(coOp.arrivalNotes || '')}</textarea></label>
          <label class="field fp-span-2"><span>Follow-up owner</span><input id="fpCoOpFollowUp" maxlength="160" value="${escapeHtml(coOp.followUpOwner || '')}"></label>
        </div>
      </section>
      <label class="field fp-adult-only"><span>Adult-only coordination notes</span><textarea id="fpAdultNotes" data-testid="family-planner-adult-notes" rows="4" maxlength="5000">${escapeHtml(item.adultNotes || '')}</textarea></label>
      <div class="fp-carry-row"><label class="field"><span>Carry over to</span><select id="fpCarryTarget">${familyPlannerWeekOptions((state.curriculum?.weeks || []).find(candidate => candidate.id !== week.weekId)?.id || week.weekId)}</select></label><button class="btn" type="button" data-fp-action="carryover" data-testid="family-planner-carryover">Create linked carryover</button></div>
      <div class="fp-actions">
        <button class="btn primary" type="button" data-fp-action="save" data-testid="family-planner-save">Save item</button>
        <button class="btn" type="button" data-fp-action="duplicate">Duplicate</button>
        <button class="btn" type="button" data-fp-action="archive">${item.status === 'archived' ? 'Restore' : 'Archive'}</button>
        <button class="btn danger" type="button" data-fp-action="delete">Delete</button>
      </div>
    </form>`;
  }

  function familyPlannerFilters(){
    const settings = ensureFamilyPlannerState();
    const targetOptions = [`<option value="all">All learners</option>`];
    (state.students || []).forEach(student => targetOptions.push(`<option value="student:${escapeHtml(student.id)}" ${settings.filters.target === `student:${student.id}` ? 'selected' : ''}>${escapeHtml(student.name)}</option>`));
    (state.learningLevels || []).forEach(level => targetOptions.push(`<option value="track:${escapeHtml(level.id)}" ${settings.filters.target === `track:${level.id}` ? 'selected' : ''}>Track · ${escapeHtml(level.name || level.id)}</option>`));
    const trackOptions = `<option value="all">All tracks</option>${(state.learningLevels || []).map(level => `<option value="${escapeHtml(level.id)}" ${settings.filters.track === level.id ? 'selected' : ''}>${escapeHtml(level.name || level.id)}</option>`).join('')}`;
    return `<div class="fp-filters" data-testid="family-planner-filters">
      <label>Target<select id="fpFilterTarget">${targetOptions.join('')}</select></label>
      <label>Track<select id="fpFilterTrack">${trackOptions}</select></label>
      <label>Day<select id="fpFilterDay">${familyPlannerDayOptions(settings.filters.day, true)}</select></label>
      <label>Type<select id="fpFilterType">${familyPlannerTypeOptions(settings.filters.itemType, true)}</select></label>
      <label>Status<select id="fpFilterStatus">${familyPlannerStatusOptions(settings.filters.status, true)}</select></label>
    </div>`;
  }

  function familyPlannerShortcutBar(){
    return `<div class="fp-shortcuts">${BLH_FAMILY_PLANNER_SHORTCUTS.map(([id,label]) => `<button class="btn small" type="button" data-fp-action="open-source" data-fp-source="${id}">${escapeHtml(label)}</button>`).join('')}</div>`;
  }

  function familyPlannerStats(week){
    const active = (week.items || []).filter(item => item.status !== 'archived');
    return {
      total: active.length,
      ready: active.filter(item => item.status === 'ready').length,
      carryover: active.filter(item => item.status === 'carryover').length,
      coOp: active.filter(item => item.coOp?.enabled).length,
      unassigned: active.filter(item => item.coOp?.enabled && !item.coOp.role).length
    };
  }

  function plannerWorkspaceForPackage(){
    const settings = ensureFamilyPlannerState();
    return { activeWeekId: settings.activeWeekId, weeks: settings.weeks };
  }

  function normalizeFamilyPlannerState(){
    const normalized = window.BLHFamilyPlanner.normalizeFamilyPlannerWorkspace(plannerWorkspaceForPackage());
    const settings = ensureFamilyPlannerState();
    settings.activeWeekId = normalized.activeWeekId;
    settings.weeks = normalized.weeks;
    if (settings.activeItemId && !familyPlannerItemById(settings.activeItemId)) settings.activeItemId = '';
    return normalized;
  }

  function renderFamilyPlannerDirectorRollup(settings){
    const allItems = settings.weeks.flatMap(week => (week.items || []).map(item => ({ ...item, weekId:week.weekId, weekMode:week.mode })));
    const active = allItems.filter(item => item.status !== 'archived');
    const byDay = window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS.map(day => ({ day, count:active.filter(item => item.day === day).length }));
    const targets = new Map();
    active.forEach(item => { const label = familyPlannerTargetLabel(item); targets.set(label, (targets.get(label) || 0) + 1); });
    const coOp = active.filter(item => item.coOp?.enabled);
    const unassigned = coOp.filter(item => !item.coOp.role);
    const catchUp = active.filter(item => item.status === 'carryover' || item.itemType === 'flex' || item.weekMode === 'catch-up');
    return `<div class="fp-director" data-testid="family-planner-director-rollup">
      <div class="fp-stat-grid">
        <div class="fp-stat"><b>${settings.weeks.length}</b><span>Planned weeks</span></div>
        <div class="fp-stat"><b>${active.length}</b><span>Active items</span></div>
        <div class="fp-stat"><b>${coOp.length}</b><span>Co-op items</span></div>
        <div class="fp-stat"><b>${catchUp.length}</b><span>Catch-up / flex</span></div>
        <div class="fp-stat ${unassigned.length ? 'warn' : ''}"><b>${unassigned.length}</b><span>Unassigned co-op roles</span></div>
      </div>
      <div class="grid two">
        <section class="panel"><h3>Workload by learner / track</h3>${targets.size ? `<ul>${[...targets.entries()].sort((a,b)=>b[1]-a[1]).map(([label,count]) => `<li><b>${escapeHtml(label)}</b> · ${count} item(s)</li>`).join('')}</ul>` : '<p>No planner workload yet.</p>'}</section>
        <section class="panel"><h3>Workload by day</h3><div class="fp-day-rollup">${byDay.map(item => `<div><b>${item.count}</b><span>${item.day}</span></div>`).join('')}</div></section>
      </div>
      <section class="panel"><h3>Co-op responsibility warnings</h3>${unassigned.length ? `<ul>${unassigned.map(item => `<li><b>${escapeHtml(item.coOp.eventName)}</b> · ${escapeHtml(familyPlannerWeekLabel(item.weekId))} · ${escapeHtml(item.day)} · role unassigned</li>`).join('')}</ul>` : '<p>Every enabled co-op item has a responsible role.</p>'}</section>
      <section class="fp-boundary"><b>Director boundary:</b> rollup only. Editing, carryover, source seeding, package import/export, and adult coordination notes remain with Parent, Teacher, and Admin.</section>
    </div>`;
  }

  function renderFamilyPlanner(){
    const el = document.getElementById('screen-familyplanner');
    if (!el) return;
    const role = activeRole();
    const settings = ensureFamilyPlannerState();
    if (role === 'student') {
      el.innerHTML = roleLimitedPanel('Adult weekly coordination workspace', 'Student mode stays focused on Daily Plan, Assignments, Lesson Player, and This Week pacing. Family/co-op authoring and package controls remain hidden.');
      return;
    }
    if (role === 'director') {
      el.innerHTML = `<div class="fp-shell" data-family-planner="v10.38"><div class="fp-heading"><div><div class="fp-kicker">Family/Co-op Planner v1</div><h2>Weekly coordination rollup</h2><p>Review workload, co-op responsibilities, and catch-up pressure without exposing adult notes or changing learner records.</p></div></div>${renderFamilyPlannerDirectorRollup(settings)}</div>`;
      return;
    }
    if (!familyPlannerCanEdit(role)) {
      el.innerHTML = roleLimitedPanel('Family/Co-op Planner unavailable', 'This role does not author the weekly family plan.');
      return;
    }
    const week = activeFamilyPlannerWeek();
    const item = selectedFamilyPlannerItem();
    if (item && settings.activeItemId !== item.id) settings.activeItemId = item.id;
    const stats = familyPlannerStats(week);
    el.innerHTML = `<div class="fp-shell" data-family-planner="v10.38">
      <div class="fp-heading">
        <div><div class="fp-kicker">Family/Co-op Planner v1</div><h2>Coordinate one realistic week</h2><p>Assemble assignments, lesson packs, co-op logistics, family-wide work, and learner-specific plans without changing source records or awarding completion.</p></div>
        <div class="fp-heading-actions">
          <button class="btn primary" type="button" data-fp-action="new" data-testid="family-planner-new">New item</button>
          <button class="btn" type="button" data-fp-action="seed" data-testid="family-planner-seed">Seed current sources</button>
          <button class="btn" type="button" data-fp-action="export" data-testid="family-planner-export">Export planner</button>
          <button class="btn" type="button" data-fp-action="import" data-testid="family-planner-import">Import planner</button>
          <input id="fpImportFile" data-testid="family-planner-import-file" type="file" accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="fp-boundary"><b>Reward and record boundary:</b> planning, filtering, source seeding, carryover, copying, and package operations do not complete assignments or change XP, coins, attendance, mastery, portfolio approval, or lesson-pack status. No external calendar sync occurs.</div>
      ${familyPlannerShortcutBar()}
      <section class="fp-week-controls">
        <label>Planning week<select id="fpWeek" data-testid="family-planner-week">${familyPlannerWeekOptions(settings.activeWeekId)}</select></label>
        <label>Week mode<select id="fpWeekMode" data-testid="family-planner-mode">${familyPlannerModeOptions(week.mode)}</select></label>
        <div class="fp-week-stats"><span>${stats.total} active</span><span>${stats.ready} ready</span><span>${stats.carryover} carryover</span><span>${stats.coOp} co-op</span>${stats.unassigned ? `<span class="warn">${stats.unassigned} role warning</span>` : ''}</div>
      </section>
      <section class="fp-week-notes"><label class="field"><span>Family week notes</span><textarea id="fpFamilyNotes" rows="2" maxlength="5000">${escapeHtml(week.familyNotes || '')}</textarea></label><label class="field"><span>Co-op coordination notes</span><textarea id="fpCoOpNotes" rows="2" maxlength="5000">${escapeHtml(week.coOpNotes || '')}</textarea></label><button class="btn" type="button" data-fp-action="save-week">Save week setup</button></section>
      ${familyPlannerFilters()}
      <div class="fp-workspace"><main class="fp-main">${familyPlannerBoard(week)}</main><aside class="fp-side">${familyPlannerEditor(item, week)}</aside></div>
    </div>`;
  }

  function readFamilyPlannerEditorRaw(item){
    const targetValue = document.getElementById('fpTarget')?.value || 'all:';
    const separator = targetValue.indexOf(':');
    const targetKind = separator >= 0 ? targetValue.slice(0, separator) : 'all';
    const targetId = separator >= 0 ? targetValue.slice(separator + 1) : '';
    return {
      ...item,
      title: document.getElementById('fpTitle')?.value || '',
      day: document.getElementById('fpDay')?.value || 'Monday',
      startTime: document.getElementById('fpStart')?.value || '',
      endTime: document.getElementById('fpEnd')?.value || '',
      targetKind,
      targetId,
      subject: document.getElementById('fpSubject')?.value || '',
      itemType: document.getElementById('fpType')?.value || 'lesson',
      status: document.getElementById('fpStatus')?.value || 'planned',
      location: document.getElementById('fpLocation')?.value || '',
      sourceScreen: document.getElementById('fpSourceScreen')?.value || '',
      sourceId: document.getElementById('fpSourceId')?.value || '',
      studentDirections: document.getElementById('fpDirections')?.value || '',
      adultNotes: document.getElementById('fpAdultNotes')?.value || '',
      coOp: {
        enabled: !!document.getElementById('fpCoOpEnabled')?.checked,
        eventName: document.getElementById('fpCoOpEvent')?.value || '',
        role: document.getElementById('fpCoOpRole')?.value || '',
        materials: document.getElementById('fpCoOpMaterials')?.value || '',
        arrivalNotes: document.getElementById('fpCoOpArrival')?.value || '',
        followUpOwner: document.getElementById('fpCoOpFollowUp')?.value || ''
      },
      updatedAt: new Date().toISOString()
    };
  }

  function saveFamilyPlannerItem(){
    const settings = ensureFamilyPlannerState();
    const week = activeFamilyPlannerWeek();
    const item = selectedFamilyPlannerItem();
    if (!item) return;
    const previousProgress = JSON.stringify(state.progress || {});
    const previousAssignments = JSON.stringify(state.assignments || []);
    const previousLessonPacks = JSON.stringify(state.ui?.lessonPackEditor?.drafts || []);
    try {
      const normalized = window.BLHFamilyPlanner.normalizeFamilyPlannerItem(readFamilyPlannerEditorRaw(item));
      const index = week.items.findIndex(entry => entry.id === item.id);
      if (index < 0) throw new Error('Selected planner item no longer exists.');
      week.items[index] = normalized;
      week.updatedAt = new Date().toISOString();
      settings.activeItemId = normalized.id;
      normalizeFamilyPlannerState();
      if (JSON.stringify(state.progress || {}) !== previousProgress || JSON.stringify(state.assignments || []) !== previousAssignments || JSON.stringify(state.ui?.lessonPackEditor?.drafts || []) !== previousLessonPacks) {
        throw new Error('Planner boundary violation detected; source state changed unexpectedly.');
      }
      saveState();
      toast('Weekly plan item saved · rewards and source records unchanged');
    } catch (error) {
      toast(`Save failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function addFamilyPlannerItem(day = 'Monday', overrides = {}){
    const settings = ensureFamilyPlannerState();
    const week = activeFamilyPlannerWeek();
    const maxOrder = Math.max(-1, ...week.items.filter(item => item.day === day).map(item => Number(item.order || 0)));
    const item = newFamilyPlannerItem({ day, order:maxOrder + 1, ...overrides });
    week.items.push(item);
    week.updatedAt = new Date().toISOString();
    settings.activeItemId = item.id;
    saveState();
    toast('Planning item created');
  }

  function duplicateFamilyPlannerItem(){
    const settings = ensureFamilyPlannerState();
    const week = activeFamilyPlannerWeek();
    const source = selectedFamilyPlannerItem();
    if (!source) return;
    const now = new Date().toISOString();
    const copy = newFamilyPlannerItem({ ...source, id:familyPlannerUniqueId('fp_copy'), title:`${source.title} · Copy`, status:'planned', carriedFromId:'', createdAt:now, updatedAt:now, order:Number(source.order || 0) + 1 });
    week.items.push(copy);
    settings.activeItemId = copy.id;
    normalizeFamilyPlannerState();
    saveState();
    toast('Planning item duplicated');
  }

  function archiveFamilyPlannerItem(){
    const item = selectedFamilyPlannerItem();
    if (!item) return;
    item.status = item.status === 'archived' ? 'planned' : 'archived';
    item.updatedAt = new Date().toISOString();
    normalizeFamilyPlannerState();
    saveState();
    toast(item.status === 'archived' ? 'Planning item archived' : 'Planning item restored');
  }

  function deleteFamilyPlannerItem(){
    const settings = ensureFamilyPlannerState();
    const week = activeFamilyPlannerWeek();
    const item = selectedFamilyPlannerItem();
    if (!item) return;
    if (!confirm(`Delete “${item.title}” from the planner? Linked source records remain unchanged.`)) return;
    week.items = week.items.filter(entry => entry.id !== item.id);
    settings.activeItemId = week.items[0]?.id || '';
    saveState();
    toast('Planning item deleted · source records unchanged');
  }

  function carryOverFamilyPlannerItem(){
    const settings = ensureFamilyPlannerState();
    const sourceWeek = activeFamilyPlannerWeek();
    const source = selectedFamilyPlannerItem();
    const targetWeekId = document.getElementById('fpCarryTarget')?.value || '';
    if (!source || !targetWeekId || targetWeekId === sourceWeek.weekId) {
