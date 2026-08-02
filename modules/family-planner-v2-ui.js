  const BLH_FAMILY_PLANNER_V2_RELEASE = 'v10.42';

  function ensureFamilyPlannerV2State(){
    const settings = ensureFamilyPlannerState();
    if (!Array.isArray(settings.templates)) settings.templates = [];
    if (typeof settings.activeTemplateId !== 'string') settings.activeTemplateId = settings.templates[0]?.id || '';
    if (typeof settings.printPreview !== 'boolean') settings.printPreview = false;
    try {
      settings.templates = window.BLHFamilyPlannerV2.normalizeTemplateLibrary(settings.templates);
    } catch (error) {
      settings.templates = [];
      settings.activeTemplateId = '';
      toast(`Template library reset: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
    if (settings.activeTemplateId && !settings.templates.some(template => template.id === settings.activeTemplateId)) {
      settings.activeTemplateId = settings.templates[0]?.id || '';
    }
    return settings;
  }

  function familyPlannerV2TargetWeekOptions(activeWeekId){
    return (state.curriculum?.weeks || []).filter(week => week.id !== activeWeekId).map(week => `<option value="${escapeHtml(week.id)}">${escapeHtml(week.title || week.id)}</option>`).join('');
  }

  function familyPlannerV2TemplateOptions(settings){
    if (!settings.templates.length) return '<option value="">No saved templates</option>';
    return settings.templates.map(template => `<option value="${escapeHtml(template.id)}" ${template.id === settings.activeTemplateId ? 'selected' : ''}>${escapeHtml(template.name)}</option>`).join('');
  }

  function familyPlannerV2Analysis(week){
    return window.BLHFamilyPlannerV2.analyzeWeek({
      week,
      students:state.students || [],
      learningLevels:state.learningLevels || [],
      maxItemsPerDay:6,
      maxItemsPerTarget:8
    });
  }

  function familyPlannerV2WarningList(analysis){
    const workload = analysis.workloadWarnings.map(warning => warning.code === 'DAY_OVERLOAD'
      ? `<li><b>${escapeHtml(warning.day)}</b> has ${warning.count} active items; review whether the day is realistic.</li>`
      : `<li><b>${escapeHtml(warning.label)}</b> has ${warning.count} active items; rebalance or move work.</li>`);
    const conflicts = analysis.conflicts.map(conflict => `<li><b>${escapeHtml(conflict.day)} · ${escapeHtml(conflict.target)}</b>: ${escapeHtml(conflict.leftTitle)} overlaps ${escapeHtml(conflict.rightTitle)} (${escapeHtml(conflict.window)}).</li>`);
    const responsibilities = analysis.responsibilityGaps.map(gap => `<li><b>${escapeHtml(gap.eventName)}</b> · ${escapeHtml(gap.day)} is missing ${escapeHtml(gap.missing.join(' and '))}.</li>`);
    const warnings = [...workload, ...conflicts, ...responsibilities];
    return warnings.length ? `<ul>${warnings.join('')}</ul>` : '<p>No workload, time-overlap, or co-op responsibility warnings for this week.</p>';
  }

  function familyPlannerV2AnalysisPanel(week, readonly = false){
    const analysis = familyPlannerV2Analysis(week);
    const busiest = Object.entries(analysis.byDay).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ['Monday',0];
    return `<section class="fpv2-analysis" data-testid="family-planner-v2-analysis">
      <div class="fpv2-analysis-head"><div><div class="fp-kicker">Family Planner v2 analysis</div><h3>Workload and responsibility check</h3></div><span class="pill">${readonly ? 'Read-only rollup' : 'Planning aid only'}</span></div>
      <div class="fpv2-stat-grid">
        <div><b>${analysis.activeItems}</b><span>Active items</span></div>
        <div><b>${escapeHtml(busiest[0])}</b><span>Busiest day · ${busiest[1]}</span></div>
        <div class="${analysis.conflicts.length ? 'warn' : ''}"><b>${analysis.conflicts.length}</b><span>Time conflicts</span></div>
        <div class="${analysis.responsibilityGaps.length ? 'warn' : ''}"><b>${analysis.responsibilityGaps.length}</b><span>Responsibility gaps</span></div>
      </div>
      <div class="fpv2-targets">${analysis.targets.map(target => `<span>${escapeHtml(target.label)} · ${target.count}</span>`).join('') || '<span>No active target workload</span>'}</div>
      <div class="fpv2-warning-list">${familyPlannerV2WarningList(analysis)}</div>
    </section>`;
  }

  function familyPlannerV2Toolbar(settings, week){
    const targetOptions = familyPlannerV2TargetWeekOptions(week.weekId);
    const noTarget = !targetOptions;
    return `<section class="fpv2-tools" data-testid="family-planner-v2-tools">
      <div class="fpv2-tool-block">
        <div class="fpv2-tool-heading"><div><div class="fp-kicker">Reusable week templates</div><h3>Save once, reuse without overwriting</h3></div><span class="pill">Browser-local</span></div>
        <div class="fpv2-tool-grid">
          <label class="field"><span>Template name</span><input id="fpV2TemplateName" data-testid="family-planner-template-name" maxlength="160" placeholder="Example: Normal homeschool week"></label>
          <label class="field"><span>Saved template</span><select id="fpV2TemplateSelect" data-testid="family-planner-template-select">${familyPlannerV2TemplateOptions(settings)}</select></label>
          <div class="fpv2-actions">
            <button class="btn" type="button" data-fpv2-action="save-template" data-testid="family-planner-save-template">Save current week as template</button>
            <button class="btn" type="button" data-fpv2-action="apply-template" data-testid="family-planner-apply-template" ${settings.templates.length ? '' : 'disabled'}>Apply to current week</button>
            <button class="btn danger" type="button" data-fpv2-action="delete-template" ${settings.templates.length ? '' : 'disabled'}>Delete template</button>
          </div>
        </div>
      </div>
      <div class="fpv2-tool-block">
        <div class="fpv2-tool-heading"><div><div class="fp-kicker">Week-to-week operations</div><h3>Copy or roll active work forward</h3></div><span class="pill">Source preserved</span></div>
        <div class="fpv2-tool-grid compact">
          <label class="field"><span>Target loaded week</span><select id="fpV2TargetWeek" data-testid="family-planner-v2-target-week" ${noTarget ? 'disabled' : ''}>${targetOptions || '<option value="">No other loaded week</option>'}</select></label>
          <div class="fpv2-actions">
            <button class="btn" type="button" data-fpv2-action="duplicate-week" data-testid="family-planner-duplicate-week" ${noTarget ? 'disabled' : ''}>Duplicate active items</button>
            <button class="btn" type="button" data-fpv2-action="roll-forward" data-testid="family-planner-roll-forward" ${noTarget ? 'disabled' : ''}>Roll forward as carryover</button>
          </div>
        </div>
      </div>
      <div class="fpv2-tool-block">
        <div class="fpv2-tool-heading"><div><div class="fp-kicker">Optional support output</div><h3>Learner-safe print and CSV</h3></div><span class="pill">Adult notes excluded</span></div>
        <div class="fpv2-actions">
          <button class="btn" type="button" data-fpv2-action="toggle-print" data-testid="family-planner-print-preview">${settings.printPreview ? 'Hide print preview' : 'Preview print summary'}</button>
          <button class="btn" type="button" data-fpv2-action="csv" data-testid="family-planner-csv">Download learner-safe CSV</button>
        </div>
        <p class="muted">Print and binder output is optional support material only. It is not required for learner completion.</p>
      </div>
    </section>`;
  }

  function familyPlannerV2PrintPreview(week){
    const model = window.BLHFamilyPlannerV2.createLearnerSafePrintModel({ week, students:state.students || [], learningLevels:state.learningLevels || [] });
    const byDay = window.BLHFamilyPlanner.BLH_FAMILY_PLANNER_DAYS.map(day => ({ day, items:model.items.filter(item => item.day === day) }));
    return `<section class="fpv2-print-preview" data-testid="family-planner-print-summary">
      <div class="fpv2-print-heading"><div><div class="fp-kicker">Learner-safe weekly summary</div><h2>${escapeHtml(familyPlannerWeekLabel(model.weekId))}</h2><p>${escapeHtml(model.familyNotes || 'No family-facing week note.')}</p></div><button class="btn" type="button" data-fpv2-action="print" data-testid="family-planner-print">Print summary</button></div>
      <div class="fpv2-print-days">${byDay.map(group => `<section><h3>${group.day}</h3>${group.items.length ? group.items.map(item => `<article><div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.target)}${item.subject ? ` · ${escapeHtml(item.subject)}` : ''}</span></div><p>${escapeHtml(item.directions)}</p><small>${item.startTime ? `${escapeHtml(item.startTime)}${item.endTime ? `–${escapeHtml(item.endTime)}` : ''}` : 'Flexible time'}${item.location ? ` · ${escapeHtml(item.location)}` : ''}${item.coOpEvent ? ` · Co-op: ${escapeHtml(item.coOpEvent)}${item.coOpRole ? ` (${escapeHtml(item.coOpRole)})` : ''}` : ''}</small></article>`).join('') : '<p>No active items.</p>'}</section>`).join('')}</div>
      <div class="fp-boundary"><b>Privacy boundary:</b> adult-only coordination notes, co-op arrival/handoff notes, rewards, attendance, mastery, and portfolio state are not included.</div>
    </section>`;
  }

  function enhanceFamilyPlannerV2(){
    const host = document.getElementById('screen-familyplanner');
    if (!host || activeRole() === 'student') return;
    const settings = ensureFamilyPlannerV2State();
    const week = activeFamilyPlannerWeek();
    host.querySelectorAll('[data-family-planner]').forEach(node => node.setAttribute('data-family-planner', BLH_FAMILY_PLANNER_V2_RELEASE));
    const kicker = host.querySelector('.fp-heading .fp-kicker');
    if (kicker) kicker.textContent = 'Family/Co-op Planner v2';
    if (activeRole() === 'director') {
      const rollup = host.querySelector('[data-testid="family-planner-director-rollup"]');
      if (rollup && !host.querySelector('[data-testid="family-planner-v2-analysis"]')) rollup.insertAdjacentHTML('afterbegin', familyPlannerV2AnalysisPanel(week, true));
      return;
    }
    if (!familyPlannerCanEdit(activeRole())) return;
    const controls = host.querySelector('.fp-week-controls');
    if (controls && !host.querySelector('[data-testid="family-planner-v2-tools"]')) controls.insertAdjacentHTML('afterend', familyPlannerV2Toolbar(settings, week));
    const filters = host.querySelector('.fp-filters');
    if (filters && !host.querySelector('[data-testid="family-planner-v2-analysis"]')) filters.insertAdjacentHTML('afterend', familyPlannerV2AnalysisPanel(week));
    if (settings.printPreview && !host.querySelector('[data-testid="family-planner-print-summary"]')) {
      const analysis = host.querySelector('[data-testid="family-planner-v2-analysis"]');
      analysis?.insertAdjacentHTML('afterend', familyPlannerV2PrintPreview(week));
    }
  }

  function familyPlannerV2ReplaceWeek(settings, week){
    const index = settings.weeks.findIndex(entry => entry.weekId === week.weekId);
    if (index < 0) settings.weeks.push(week);
    else settings.weeks[index] = week;
    normalizeFamilyPlannerState();
  }

  function saveFamilyPlannerTemplate(){
    const settings = ensureFamilyPlannerV2State();
    const week = activeFamilyPlannerWeek();
    const entered = document.getElementById('fpV2TemplateName')?.value || '';
    const name = entered.trim() || `${familyPlannerWeekLabel(week.weekId)} template`;
    const templateId = `fpt_${familyPlannerSafeId(name)}_${Date.now().toString(36)}`;
    try {
      const template = window.BLHFamilyPlannerV2.createWeekTemplate({ week, id:templateId, name, description:`Saved from ${familyPlannerWeekLabel(week.weekId)}`, createdAt:new Date().toISOString() });
      settings.templates.push(template);
      settings.templates = window.BLHFamilyPlannerV2.normalizeTemplateLibrary(settings.templates);
      settings.activeTemplateId = template.id;
      saveState();
      toast(`Template saved · ${template.items.length} active item${template.items.length === 1 ? '' : 's'} · browser-local only`);
      renderFamilyPlanner();
    } catch (error) {
      toast(`Template save failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function applyFamilyPlannerTemplate(){
    const settings = ensureFamilyPlannerV2State();
    const template = settings.templates.find(entry => entry.id === settings.activeTemplateId);
    if (!template) return toast('Choose a saved template first');
    try {
      const result = window.BLHFamilyPlannerV2.applyWeekTemplate({ template, targetWeek:activeFamilyPlannerWeek(), now:new Date().toISOString() });
      familyPlannerV2ReplaceWeek(settings, result.week);
      saveState();
      toast(result.added ? `${result.added} template item${result.added === 1 ? '' : 's'} added · existing plan preserved` : 'Template already applied · no duplicates added');
      renderFamilyPlanner();
    } catch (error) {
      toast(`Template apply failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function deleteFamilyPlannerTemplate(){
    const settings = ensureFamilyPlannerV2State();
    const template = settings.templates.find(entry => entry.id === settings.activeTemplateId);
    if (!template) return;
    if (!confirm(`Delete template “${template.name}”? Planned weeks and source records remain unchanged.`)) return;
    settings.templates = settings.templates.filter(entry => entry.id !== template.id);
    settings.activeTemplateId = settings.templates[0]?.id || '';
    saveState();
    toast('Template deleted · planned weeks unchanged');
    renderFamilyPlanner();
  }

  function copyFamilyPlannerWeek(operation){
    const settings = ensureFamilyPlannerV2State();
    const targetWeekId = document.getElementById('fpV2TargetWeek')?.value || '';
    const target = ensureFamilyPlannerWeek(targetWeekId, settings);
    if (!target || target.weekId === settings.activeWeekId) return toast('Choose a different loaded week');
    if ((target.items || []).length && !confirm(`${familyPlannerWeekLabel(targetWeekId)} already has planner items. Add only non-duplicate linked copies and preserve everything already there?`)) return;
    try {
      const result = window.BLHFamilyPlannerV2.copyWeek({ sourceWeek:activeFamilyPlannerWeek(), targetWeek:target, operation, now:new Date().toISOString() });
      familyPlannerV2ReplaceWeek(settings, result.week);
      saveState();
      toast(result.added ? `${result.added} item${result.added === 1 ? '' : 's'} ${operation === 'roll-forward' ? 'rolled forward as carryover' : 'duplicated'} · source week preserved` : 'No new linked items added');
      renderFamilyPlanner();
    } catch (error) {
      toast(`Week operation failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function exportFamilyPlannerV2Csv(){
    try {
      const week = activeFamilyPlannerWeek();
      const csv = window.BLHFamilyPlannerV2.createLearnerSafeCsv({ week, students:state.students || [], learningLevels:state.learningLevels || [] });
      downloadText(`beaufort-learning-harbor-week-${familyPlannerSafeId(week.weekId)}-v10.42.csv`, csv, 'text/csv');
      toast('Learner-safe weekly CSV exported · adult notes excluded');
    } catch (error) {
      toast(`CSV export failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-fpv2-action]');
    if (!control) return;
    const action = control.dataset.fpv2Action;
    if (action === 'print') {
      document.body.classList.add('fpv2-printing');
      window.print();
      setTimeout(() => document.body.classList.remove('fpv2-printing'), 0);
      return;
    }
    if (!familyPlannerCanEdit(activeRole())) return;
    if (action === 'save-template') saveFamilyPlannerTemplate();
    if (action === 'apply-template') applyFamilyPlannerTemplate();
    if (action === 'delete-template') deleteFamilyPlannerTemplate();
    if (action === 'duplicate-week') copyFamilyPlannerWeek('duplicate');
    if (action === 'roll-forward') copyFamilyPlannerWeek('roll-forward');
    if (action === 'csv') exportFamilyPlannerV2Csv();
    if (action === 'toggle-print') {
      const settings = ensureFamilyPlannerV2State();
      settings.printPreview = !settings.printPreview;
      saveState();
      renderFamilyPlanner();
    }
  });

  document.addEventListener('change', event => {
    if (event.target?.id !== 'fpV2TemplateSelect') return;
    const settings = ensureFamilyPlannerV2State();
    settings.activeTemplateId = event.target.value || '';
    saveState();
  });

  const v1042BaseRenderFamilyPlanner = renderFamilyPlanner;
  renderFamilyPlanner = function(){
    v1042BaseRenderFamilyPlanner();
    enhanceFamilyPlannerV2();
  };

  const v1042BaseFamilyPlannerUI = window.BLHFamilyPlannerUI || {};
  window.BLHFamilyPlannerUI = Object.freeze({
    ...v1042BaseFamilyPlannerUI,
    release:BLH_FAMILY_PLANNER_V2_RELEASE,
    render:renderFamilyPlanner,
    analyze:() => familyPlannerV2Analysis(activeFamilyPlannerWeek()),
    templates:() => ensureFamilyPlannerV2State().templates.map(template => ({ id:template.id, name:template.name, items:template.items.length }))
  });

  function renderV1042ReleaseNote(){
    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.42-family-planner-v2"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.42-family-planner-v2"><b>v10.42 Family Planner v2</b><p>Added reusable browser-local week templates, non-destructive template apply, duplicate-week and roll-forward tools, workload and target balancing, target-aware time-conflict warnings, clearer co-op responsibility gaps, and optional learner-safe print/CSV views that exclude adult-only notes.</p></div>');
    }
  }

  const v1042PlannerBaseRenderAll = renderAll;
  renderAll = function(){
    v1042PlannerBaseRenderAll();
    renderV1042ReleaseNote();
  };
