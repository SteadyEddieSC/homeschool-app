  const BLH_FAMILY_PLANNER_RELEASE = 'v10.38';
  const BLH_FAMILY_PLANNER_WEEK_MODES = Object.freeze([
    ['standard','Standard week'],
    ['catch-up','Catch-up week'],
    ['flex','Flex week'],
    ['co-op-heavy','Co-op-heavy week'],
    ['break-light','Break / light week']
  ]);
  const BLH_FAMILY_PLANNER_ITEM_TYPES = Object.freeze([
    ['lesson','Lesson'],
    ['assignment','Assignment'],
    ['co-op','Co-op'],
    ['project','Project'],
    ['review','Review'],
    ['admin','Adult/admin'],
    ['flex','Flex / catch-up'],
    ['life-skill','Life skill']
  ]);
  const BLH_FAMILY_PLANNER_STATUSES = Object.freeze([
    ['planned','Planned'],
    ['ready','Ready'],
    ['carryover','Carryover'],
    ['archived','Archived']
  ]);
  const BLH_FAMILY_PLANNER_SHORTCUTS = Object.freeze([
    ['assignments','Assignments'],
    ['lessonpacks','Lesson Packs'],
    ['missionplanner','Mission Planner'],
    ['schedule','Schedule / Rhythm'],
    ['pacing','Year Pacing'],
    ['yearplan','Year Plan'],
    ['insights','Insights']
  ]);

  function ensureFamilyPlannerState(){
    state.ui ||= {};
    const current = state.ui.familyPlanner;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      state.ui.familyPlanner = {
        version: BLH_FAMILY_PLANNER_RELEASE,
        activeWeekId: state.currentWeekId || state.curriculum?.weeks?.[0]?.id || '',
        activeItemId: '',
        filters: { target:'all', track:'all', day:'all', itemType:'all', status:'active' },
        weeks: []
      };
    }
    const settings = state.ui.familyPlanner;
    settings.version = BLH_FAMILY_PLANNER_RELEASE;
    if (!Array.isArray(settings.weeks)) settings.weeks = [];
    if (typeof settings.activeWeekId !== 'string') settings.activeWeekId = state.currentWeekId || '';
    if (typeof settings.activeItemId !== 'string') settings.activeItemId = '';
    if (!settings.filters || typeof settings.filters !== 'object' || Array.isArray(settings.filters)) {
      settings.filters = { target:'all', track:'all', day:'all', itemType:'all', status:'active' };
    }
    settings.filters.target ||= 'all';
    settings.filters.track ||= 'all';
    settings.filters.day ||= 'all';
    settings.filters.itemType ||= 'all';
    settings.filters.status ||= 'active';
    if (!settings.activeWeekId) settings.activeWeekId = state.currentWeekId || state.curriculum?.weeks?.[0]?.id || '';
    ensureFamilyPlannerWeek(settings.activeWeekId, settings);
    return settings;
  }

  function familyPlannerCanEdit(role = activeRole()){
    return ['parent','teacher','admin'].includes(role);
  }

  function ensureFamilyPlannerWeek(weekId, settings = ensureFamilyPlannerState()){
    if (!weekId) return null;
    let week = settings.weeks.find(item => item.weekId === weekId);
    if (!week) {
      week = { weekId, mode:'standard', familyNotes:'', coOpNotes:'', items:[], updatedAt:new Date().toISOString() };
      settings.weeks.push(week);
    }
    if (!Array.isArray(week.items)) week.items = [];
    week.mode ||= 'standard';
    week.familyNotes ||= '';
    week.coOpNotes ||= '';
    return week;
  }

  function familyPlannerWeekById(weekId){
    return ensureFamilyPlannerState().weeks.find(week => week.weekId === weekId) || null;
  }

  function activeFamilyPlannerWeek(){
    const settings = ensureFamilyPlannerState();
    return ensureFamilyPlannerWeek(settings.activeWeekId || state.currentWeekId, settings);
  }

  function familyPlannerItemById(itemId){
    for (const week of ensureFamilyPlannerState().weeks) {
      const item = (week.items || []).find(entry => entry.id === itemId);
      if (item) return { item, week };
    }
    return null;
  }

  function selectedFamilyPlannerItem(){
    const settings = ensureFamilyPlannerState();
    const found = familyPlannerItemById(settings.activeItemId);
    if (found?.week?.weekId === settings.activeWeekId) return found.item;
    return activeFamilyPlannerWeek()?.items?.[0] || null;
  }

  function familyPlannerSafeId(value){
    const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9._:-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
    return normalized || 'item';
  }

  function familyPlannerUniqueId(prefix = 'fp'){
    const ids = new Set(ensureFamilyPlannerState().weeks.flatMap(week => (week.items || []).map(item => item.id)));
    const base = `${prefix}_${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 2;
    while (ids.has(candidate)) candidate = `${base}_${suffix++}`;
    return candidate;
  }

  function newFamilyPlannerItem(overrides = {}){
    const now = new Date().toISOString();
    return {
      id: familyPlannerUniqueId(),
      title: 'New weekly plan item',
      day: 'Monday',
      startTime: '',
      endTime: '',
      targetKind: 'all',
      targetId: '',
      subject: '',
      itemType: 'lesson',
      status: 'planned',
      location: 'Home',
      sourceScreen: '',
      sourceId: '',
      coOp: { enabled:false, eventName:'', role:'', materials:'', arrivalNotes:'', followUpOwner:'' },
      studentDirections: 'Describe what the learner should do.',
      adultNotes: '',
      order: 0,
      carriedFromId: '',
      createdAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  function familyPlannerWeekLabel(weekId){
    const week = (state.curriculum?.weeks || []).find(item => item.id === weekId);
    return week?.title || weekId || 'No week';
  }

  function familyPlannerDayFromDate(dateText, fallback = 'Friday'){
    if (!dateText) return fallback;
    const date = new Date(`${dateText}T12:00:00`);
    if (Number.isNaN(date.getTime())) return fallback;
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getDay()];
    return window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS.includes(day) ? day : fallback;
  }

  function familyPlannerTargetLabel(item){
    if (item.targetKind === 'student') {
      return state.students?.find(student => student.id === item.targetId)?.name || item.targetId || 'Learner';
    }
    if (item.targetKind === 'track') {
      return state.learningLevels?.find(level => level.id === item.targetId)?.name || item.targetId || 'Track';
    }
    return 'Family / all learners';
  }

  function familyPlannerTargetOptions(item){
    const options = [`<option value="all:" ${item.targetKind === 'all' ? 'selected' : ''}>Family / all learners</option>`];
    (state.students || []).forEach(student => options.push(`<option value="student:${escapeHtml(student.id)}" ${item.targetKind === 'student' && item.targetId === student.id ? 'selected' : ''}>${escapeHtml(student.avatar || '👤')} ${escapeHtml(student.name)}</option>`));
    (state.learningLevels || []).forEach(level => options.push(`<option value="track:${escapeHtml(level.id)}" ${item.targetKind === 'track' && item.targetId === level.id ? 'selected' : ''}>Track · ${escapeHtml(level.name || level.id)}</option>`));
    return options.join('');
  }

  function familyPlannerWeekOptions(selected){
    return (state.curriculum?.weeks || []).map(week => `<option value="${escapeHtml(week.id)}" ${week.id === selected ? 'selected' : ''}>${escapeHtml(week.title || week.id)}</option>`).join('');
  }

  function familyPlannerModeOptions(selected){
    return BLH_FAMILY_PLANNER_WEEK_MODES.map(([id,label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('');
  }

  function familyPlannerTypeOptions(selected, includeAll = false){
    return `${includeAll ? '<option value="all">All types</option>' : ''}${BLH_FAMILY_PLANNER_ITEM_TYPES.map(([id,label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('')}`;
  }

  function familyPlannerStatusOptions(selected, includeFilter = false){
    return `${includeFilter ? '<option value="active">Active only</option><option value="all">All statuses</option>' : ''}${BLH_FAMILY_PLANNER_STATUSES.map(([id,label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('')}`;
  }

  function familyPlannerDayOptions(selected, includeAll = false){
    return `${includeAll ? '<option value="all">All days</option>' : ''}${window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS.map(day => `<option value="${day}" ${day === selected ? 'selected' : ''}>${day}</option>`).join('')}`;
  }

  function familyPlannerSourceLabel(screen){
    return BLH_FAMILY_PLANNER_SHORTCUTS.find(item => item[0] === screen)?.[1] || screen || 'No source';
  }

  function familyPlannerSourceOptions(selected){
    return `<option value="">No linked source</option>${BLH_FAMILY_PLANNER_SHORTCUTS.map(([id,label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`).join('')}`;
  }

  function familyPlannerVisibleItems(week){
    const filters = ensureFamilyPlannerState().filters;
    return (week?.items || []).filter(item => {
      if (filters.status === 'active' && item.status === 'archived') return false;
      if (filters.status !== 'all' && filters.status !== 'active' && item.status !== filters.status) return false;
      if (filters.day !== 'all' && item.day !== filters.day) return false;
      if (filters.itemType !== 'all' && item.itemType !== filters.itemType) return false;
      if (filters.target !== 'all') {
        const [kind,id] = filters.target.split(':');
        if (item.targetKind !== kind || item.targetId !== id) return false;
      }
      if (filters.track !== 'all') {
        if (item.targetKind === 'track' && item.targetId !== filters.track) return false;
        if (item.targetKind === 'student') {
          const student = state.students?.find(entry => entry.id === item.targetId);
          if (student?.levelId !== filters.track) return false;
        }
        if (item.targetKind === 'all') return false;
      }
      return true;
    }).sort((a,b) => a.day.localeCompare(b.day) || Number(a.order || 0) - Number(b.order || 0) || String(a.startTime).localeCompare(String(b.startTime)) || a.title.localeCompare(b.title));
  }

  function familyPlannerItemCard(item, index, dayItems){
    const coOp = item.coOp || {};
    const source = item.sourceScreen ? `<button class="btn small" type="button" data-fp-action="open-source" data-fp-source="${escapeHtml(item.sourceScreen)}">Open ${escapeHtml(familyPlannerSourceLabel(item.sourceScreen))}</button>` : '';
    return `<article class="fp-item-card ${item.status === 'archived' ? 'archived' : ''}" data-fp-item-id="${escapeHtml(item.id)}" data-testid="family-planner-item">
      <div class="fp-item-head"><div><span class="fp-type">${escapeHtml(item.itemType)}</span><h4>${escapeHtml(item.title)}</h4></div><span class="pill">${escapeHtml(item.status)}</span></div>
      <p>${escapeHtml(item.studentDirections)}</p>
      <div class="fp-item-meta"><span>${escapeHtml(familyPlannerTargetLabel(item))}</span>${item.subject ? `<span>${escapeHtml(item.subject)}</span>` : ''}${item.startTime ? `<span>${escapeHtml(item.startTime)}${item.endTime ? `–${escapeHtml(item.endTime)}` : ''}</span>` : ''}${item.location ? `<span>${escapeHtml(item.location)}</span>` : ''}</div>
      ${coOp.enabled ? `<div class="fp-coop-chip"><b>Co-op:</b> ${escapeHtml(coOp.eventName)} · ${escapeHtml(coOp.role || 'role unassigned')}</div>` : ''}
      <div class="fp-item-actions">
        <button class="btn small" type="button" data-fp-action="select" data-fp-id="${escapeHtml(item.id)}">Edit</button>
        <button class="btn small" type="button" data-fp-action="move-up" data-fp-id="${escapeHtml(item.id)}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn small" type="button" data-fp-action="move-down" data-fp-id="${escapeHtml(item.id)}" ${index === dayItems.length - 1 ? 'disabled' : ''}>↓</button>
        ${source}
      </div>
    </article>`;
  }

  function familyPlannerBoard(week){
    const visible = familyPlannerVisibleItems(week);
    return `<div class="fp-board" data-testid="family-planner-board">${window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS.map(day => {
      const dayItems = visible.filter(item => item.day === day);
      return `<section class="fp-day" data-fp-day="${day}"><div class="fp-day-head"><h3>${day}</h3><span>${dayItems.length}</span></div><div class="fp-day-list">${dayItems.map((item,index) => familyPlannerItemCard(item,index,dayItems)).join('') || '<div class="fp-day-empty">No matching items</div>'}</div><button class="btn small" type="button" data-fp-action="new-day" data-fp-day="${day}">Add to ${day}</button></section>`;
    }).join('')}</div>`;
  }

  function familyPlannerEditor(item, week){
    if (!item) return `<div class="fp-empty"><h3>Create or select a planning item</h3><p>Planner items coordinate work only. They do not complete assignments, award rewards, or modify source records.</p></div>`;
    const coOp = item.coOp || {};
    return `<form class="fp-editor" data-testid="family-planner-editor" onsubmit="return false">
      <div class="fp-editor-heading"><div><div class="fp-kicker">Planning item</div><h3>${escapeHtml(item.title)}</h3></div><span class="pill">${escapeHtml(familyPlannerWeekLabel(week.weekId))}</span></div>
      <div class="fp-form-grid">
        <label class="field fp-span-2"><span>Title</span><input id="fpTitle" data-testid="family-planner-title" maxlength="240" value="${escapeHtml(item.title)}"></label>
