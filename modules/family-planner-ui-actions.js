      toast('Choose a different loaded week for carryover');
      return;
    }
    const targetWeek = ensureFamilyPlannerWeek(targetWeekId, settings);
    const now = new Date().toISOString();
    const carry = newFamilyPlannerItem({ ...source, id:familyPlannerUniqueId('fp_carry'), title:`${source.title} · Carryover`, status:'carryover', carriedFromId:source.id, createdAt:now, updatedAt:now, order:targetWeek.items.filter(item => item.day === source.day).length });
    targetWeek.items.push(carry);
    normalizeFamilyPlannerState();
    saveState();
    toast(`Carryover created in ${familyPlannerWeekLabel(targetWeekId)} · source item preserved`);
  }

  function moveFamilyPlannerItem(itemId, direction){
    const week = activeFamilyPlannerWeek();
    const item = week.items.find(entry => entry.id === itemId);
    if (!item) return;
    const sameDay = week.items.filter(entry => entry.day === item.day).sort((a,b) => Number(a.order || 0) - Number(b.order || 0));
    const index = sameDay.findIndex(entry => entry.id === itemId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sameDay.length) return;
    [sameDay[index].order, sameDay[targetIndex].order] = [Number(sameDay[targetIndex].order || targetIndex), Number(sameDay[index].order || index)];
    sameDay.forEach((entry, order) => { entry.order = order; entry.updatedAt = new Date().toISOString(); });
    normalizeFamilyPlannerState();
    saveState();
  }

  function assignmentTarget(assignment){
    const target = assignment.assignedTo || assignment.target || 'all';
    if (target === 'all') return { targetKind:'all', targetId:'' };
    if ((state.students || []).some(student => student.id === target)) return { targetKind:'student', targetId:target };
    if ((state.learningLevels || []).some(level => level.id === target)) return { targetKind:'track', targetId:target };
    return { targetKind:'all', targetId:'' };
  }

  function seedFamilyPlannerSources(){
    const settings = ensureFamilyPlannerState();
    const week = activeFamilyPlannerWeek();
    const sourceKeys = new Set(week.items.map(item => `${item.sourceScreen}:${item.sourceId}`));
    const today = new Date().toISOString().slice(0,10);
    let added = 0;
    (state.assignments || []).filter(assignment => assignment.active !== false && assignment.weekId === week.weekId).forEach((assignment,index) => {
      const key = `assignments:${assignment.id}`;
      if (sourceKeys.has(key)) return;
      const overdue = assignment.dueDate && assignment.dueDate < today;
      const target = assignmentTarget(assignment);
      week.items.push(newFamilyPlannerItem({
        id:familyPlannerUniqueId('fp_assignment'),
        title:assignment.title || 'Assignment',
        day:familyPlannerDayFromDate(assignment.dueDate, window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS[index % 5]),
        targetKind:target.targetKind,
        targetId:target.targetId,
        subject:assignment.subject || '',
        itemType:overdue ? 'flex' : 'assignment',
        status:overdue ? 'carryover' : 'planned',
        location:'Home',
        sourceScreen:'assignments',
        sourceId:assignment.id,
        studentDirections:assignment.description || 'Complete the linked assignment requirements.',
        adultNotes:overdue ? 'Seeded as catch-up because the linked assignment due date has passed.' : 'Seeded from the current-week assignment board.',
        order:index
      }));
      sourceKeys.add(key);
      added += 1;
    });
    const lessonPacks = state.ui?.lessonPackEditor?.drafts || [];
    lessonPacks.filter(pack => !pack.targetWeekId || pack.targetWeekId === week.weekId).forEach((pack,index) => {
      const key = `lessonpacks:${pack.id}`;
      if (sourceKeys.has(key)) return;
      const trackText = String(pack.track || '').toLowerCase();
      const level = (state.learningLevels || []).find(entry => trackText.includes(String(entry.id).toLowerCase()) || trackText.includes(String(entry.name || '').toLowerCase()));
      week.items.push(newFamilyPlannerItem({
        id:familyPlannerUniqueId('fp_lesson'),
        title:pack.title || 'Lesson pack',
        day:window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS[index % 5],
        targetKind:level ? 'track' : 'all',
        targetId:level?.id || '',
        subject:pack.subject || '',
        itemType:'lesson',
        status:pack.status === 'ready' ? 'ready' : 'planned',
        location:'Home',
        sourceScreen:'lessonpacks',
        sourceId:pack.id,
        studentDirections:pack.objective || 'Complete the linked lesson pack.',
        adultNotes:'Seeded from Lesson Pack Editor without changing the source draft.',
        order:index + 20
      }));
      sourceKeys.add(key);
      added += 1;
    });
    week.updatedAt = new Date().toISOString();
    normalizeFamilyPlannerState();
    saveState();
    toast(added ? `${added} current-week source item${added === 1 ? '' : 's'} added without changing source records` : 'No new current-week assignment or lesson-pack sources found');
  }

  function saveFamilyPlannerWeek(){
    const week = activeFamilyPlannerWeek();
    week.mode = document.getElementById('fpWeekMode')?.value || week.mode;
    week.familyNotes = document.getElementById('fpFamilyNotes')?.value || '';
    week.coOpNotes = document.getElementById('fpCoOpNotes')?.value || '';
    week.updatedAt = new Date().toISOString();
    try {
      normalizeFamilyPlannerState();
      saveState();
      toast('Week setup saved · no learner records changed');
    } catch (error) {
      toast(`Week setup failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function familyPlannerFileName(){
    return `beaufort-learning-harbor-family-planner-v10.38.json`;
  }

  function exportFamilyPlanner(){
    try {
      const serialized = window.BLHFamilyPlanner.serializeFamilyPlannerPackage(plannerWorkspaceForPackage(), { productVersion:'10.38' });
      downloadText(familyPlannerFileName(), serialized, 'application/json');
      toast('Family/co-op planner package exported');
    } catch (error) {
      toast(`Export failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function importFamilyPlanner(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const settings = ensureFamilyPlannerState();
      const beforeWeeks = JSON.stringify(settings.weeks);
      const beforeActive = settings.activeWeekId;
      const beforeProgress = JSON.stringify(state.progress || {});
      const beforeAssignments = JSON.stringify(state.assignments || []);
      const beforeLessonPacks = JSON.stringify(state.ui?.lessonPackEditor?.drafts || []);
      try {
        const plannerPackage = window.BLHFamilyPlanner.parseFamilyPlannerPackage(String(reader.result || ''));
        if (settings.weeks.length && !confirm('Replace the local Family/Co-op Planner workspace with this validated package? Assignments, Lesson Packs, rewards, and records remain unchanged.')) return;
        settings.weeks = plannerPackage.planner.weeks;
        settings.activeWeekId = plannerPackage.planner.activeWeekId || settings.weeks[0]?.weekId || state.currentWeekId || '';
        settings.activeItemId = settings.weeks.find(week => week.weekId === settings.activeWeekId)?.items?.[0]?.id || '';
        if (JSON.stringify(state.progress || {}) !== beforeProgress || JSON.stringify(state.assignments || []) !== beforeAssignments || JSON.stringify(state.ui?.lessonPackEditor?.drafts || []) !== beforeLessonPacks) {
          throw new Error('Planner import boundary violation detected.');
        }
        saveState();
        toast('Validated Family/Co-op Planner package imported');
      } catch (error) {
        settings.weeks = JSON.parse(beforeWeeks);
        settings.activeWeekId = beforeActive;
        toast(`Import failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  function updateFamilyPlannerFilter(){
    const settings = ensureFamilyPlannerState();
    settings.filters.target = document.getElementById('fpFilterTarget')?.value || 'all';
    settings.filters.track = document.getElementById('fpFilterTrack')?.value || 'all';
    settings.filters.day = document.getElementById('fpFilterDay')?.value || 'all';
    settings.filters.itemType = document.getElementById('fpFilterType')?.value || 'all';
    settings.filters.status = document.getElementById('fpFilterStatus')?.value || 'active';
    saveState();
    renderFamilyPlanner();
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-fp-action]');
    if (!control) return;
    const action = control.dataset.fpAction;
    if (action === 'open-source') {
      const screen = control.dataset.fpSource;
      if (screen && roleCanAccess(screen, activeRole())) setScreen(screen);
      else toast('That linked source is not available in this role');
      return;
    }
    if (!familyPlannerCanEdit(activeRole())) return;
    if (action === 'new') addFamilyPlannerItem('Monday');
    if (action === 'new-day') addFamilyPlannerItem(control.dataset.fpDay || 'Monday');
    if (action === 'select') { ensureFamilyPlannerState().activeItemId = control.dataset.fpId || ''; renderFamilyPlanner(); }
    if (action === 'save') saveFamilyPlannerItem();
    if (action === 'duplicate') duplicateFamilyPlannerItem();
    if (action === 'archive') archiveFamilyPlannerItem();
    if (action === 'delete') deleteFamilyPlannerItem();
    if (action === 'carryover') carryOverFamilyPlannerItem();
    if (action === 'move-up') moveFamilyPlannerItem(control.dataset.fpId || '', 'up');
    if (action === 'move-down') moveFamilyPlannerItem(control.dataset.fpId || '', 'down');
    if (action === 'seed') seedFamilyPlannerSources();
    if (action === 'save-week') saveFamilyPlannerWeek();
    if (action === 'export') exportFamilyPlanner();
    if (action === 'import') document.getElementById('fpImportFile')?.click();
  });

  document.addEventListener('change', event => {
    if (event.target?.id === 'fpImportFile') {
      importFamilyPlanner(event.target.files?.[0]);
      event.target.value = '';
      return;
    }
    if (event.target?.id === 'fpWeek') {
      const settings = ensureFamilyPlannerState();
      settings.activeWeekId = event.target.value || state.currentWeekId || '';
      ensureFamilyPlannerWeek(settings.activeWeekId, settings);
      settings.activeItemId = familyPlannerWeekById(settings.activeWeekId)?.items?.[0]?.id || '';
      saveState();
      renderFamilyPlanner();
      return;
    }
    if (event.target?.id === 'fpWeekMode') {
      activeFamilyPlannerWeek().mode = event.target.value || 'standard';
      saveState();
      renderFamilyPlanner();
      return;
    }
    if (['fpFilterTarget','fpFilterTrack','fpFilterDay','fpFilterType','fpFilterStatus'].includes(event.target?.id)) updateFamilyPlannerFilter();
  });

  function renderFamilyPlannerEntryLinks(){
    if (activeRole() === 'student' || !roleCanAccess('familyplanner', activeRole())) return;
    const targets = [
      ['screen-briefing','Coordinate the week'],
      ['screen-focus','Move adult actions into the week'],
      ['screen-insights','Plan the recommended follow-up'],
      ['screen-assignments','Coordinate linked assignments'],
      ['screen-lessonpacks','Schedule lesson-pack drafts'],
      ['screen-yearplan','Connect the cycle plan to this week']
    ];
    targets.forEach(([screenId,label]) => {
      const host = document.getElementById(screenId);
      if (!host || host.querySelector('[data-fp-entry-link]')) return;
      host.insertAdjacentHTML('afterbegin', `<div class="fp-entry-link" data-fp-entry-link><div><b>🗓️ Family/Co-op Planner</b><span>${escapeHtml(label)} without changing source records or rewards.</span></div><button class="btn small" type="button" data-screen="familyplanner">Open weekly planner</button></div>`);
    });
  }

  window.BLHFamilyPlannerUI = Object.freeze({
    release: BLH_FAMILY_PLANNER_RELEASE,
    ensureState: ensureFamilyPlannerState,
    render: renderFamilyPlanner,
    seedCurrentSources: seedFamilyPlannerSources
  });

  function renderV1038ReleaseNote(){
    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.38-family-coop-planner"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.38-family-coop-planner"><b>v10.38 Family/Co-op Planner v1</b><p>Added a Monday–Friday adult coordination board with learner/track filters, standard/catch-up/flex/co-op-heavy/light week modes, source-safe Assignment and Lesson Pack seeding, optional co-op roles and logistics, non-destructive carryover, deterministic package import/export, Director rollups, and strict reward/record boundaries.</p></div>');
    }
  }

  const v1038BaseRenderAll = renderAll;
  renderAll = function(){
    v1038BaseRenderAll();
    renderFamilyPlanner();
    renderFamilyPlannerEntryLinks();
    renderV1038ReleaseNote();
  };
