  const BLH_KNOWLEDGE_CHECK_RELEASE = 'v10.36';
  const BLH_KNOWLEDGE_CHECK_FILE = 'beaufort-learning-harbor-knowledge-checks-v10.36.json';
  const BLH_KNOWLEDGE_CHECK_LABELS = Object.freeze({
    'recitation': 'Recitation',
    'discussion': 'Discussion',
    'notebook': 'Notebook check',
    'project': 'Project evidence',
    'oral-tell-back': 'Oral tell-back',
    'mastery-proof': 'Mastery proof'
  });

  function ensureKnowledgeCheckState(){
    state.ui ||= {};
    const current = state.ui.knowledgeCheckBuilder;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      state.ui.knowledgeCheckBuilder = {
        version: BLH_KNOWLEDGE_CHECK_RELEASE,
        activePromptId: '',
        prompts: []
      };
    }
    const settings = state.ui.knowledgeCheckBuilder;
    settings.version = BLH_KNOWLEDGE_CHECK_RELEASE;
    if (!Array.isArray(settings.prompts)) settings.prompts = [];
    if (typeof settings.activePromptId !== 'string') settings.activePromptId = '';
    return settings;
  }

  function knowledgeCheckCanEdit(role = activeRole()){
    return ['parent','teacher','admin'].includes(role);
  }

  function knowledgeCheckPromptById(id){
    return ensureKnowledgeCheckState().prompts.find(prompt => prompt.id === id) || null;
  }

  function selectedKnowledgeCheckPrompt(){
    const settings = ensureKnowledgeCheckState();
    return knowledgeCheckPromptById(settings.activePromptId) || settings.prompts[0] || null;
  }

  function knowledgeCheckId(prefix = 'kc'){
    const existing = new Set(ensureKnowledgeCheckState().prompts.map(prompt => prompt.id));
    const base = `${prefix}_${Date.now().toString(36)}`;
    let candidate = base;
    let suffix = 2;
    while (existing.has(candidate)) candidate = `${base}_${suffix++}`;
    return candidate;
  }

  function newKnowledgeCheckPrompt(){
    const now = new Date().toISOString();
    return {
      id: knowledgeCheckId(),
      title: 'New knowledge check',
      type: 'recitation',
      subject: 'General studies',
      track: 'All learners',
      status: 'draft',
      studentDirections: 'Explain what you learned in your own words.',
      evidenceExpectations: 'Provide a clear response using the assigned lesson or course notes.',
      criteria: ['Accurate understanding', 'Clear explanation'],
      returnLanguage: 'Please revise the areas noted by your adult reviewer and submit again.',
      approvalLanguage: 'Approved after adult review.',
      adultNotes: '',
      createdAt: now,
      updatedAt: now
    };
  }

  function knowledgeCheckTypeOptions(selected){
    return window.BLHKnowledgeChecks.BLH_KNOWLEDGE_CHECK_TYPES.map(type =>
      `<option value="${escapeHtml(type)}" ${type === selected ? 'selected' : ''}>${escapeHtml(BLH_KNOWLEDGE_CHECK_LABELS[type] || type)}</option>`
    ).join('');
  }

  function knowledgeCheckStatusOptions(selected){
    return ['draft','ready','archived'].map(status =>
      `<option value="${status}" ${status === selected ? 'selected' : ''}>${status[0].toUpperCase() + status.slice(1)}</option>`
    ).join('');
  }

  function knowledgeCheckStudentPreview(prompt){
    if (!prompt) {
      return '<div class="kc-empty"><h3>No student preview yet</h3><p>Create or select a prompt to preview exactly what a learner will see.</p></div>';
    }
    const criteria = (prompt.criteria || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    return `<article class="kc-student-card" data-testid="knowledge-student-preview">
      <div class="kc-preview-kicker">Student-ready preview · adult reviewed</div>
      <h3>${escapeHtml(prompt.title)}</h3>
      <div class="kc-meta"><span>${escapeHtml(BLH_KNOWLEDGE_CHECK_LABELS[prompt.type] || prompt.type)}</span><span>${escapeHtml(prompt.subject)}</span><span>${escapeHtml(prompt.track)}</span></div>
      <section><h4>What to do</h4><p>${escapeHtml(prompt.studentDirections)}</p></section>
      <section><h4>What to show</h4><p>${escapeHtml(prompt.evidenceExpectations)}</p></section>
      <section><h4>Success looks like</h4><ul>${criteria}</ul></section>
      <p class="kc-review-note">Your work is reviewed by an adult. This prompt is not auto-graded and does not award points just for opening it.</p>
    </article>`;
  }

  function knowledgeCheckPromptList(prompts, activeId, editable){
    if (!prompts.length) {
      return '<div class="kc-empty"><h3>No knowledge checks yet</h3><p>Create a recitation, discussion, notebook, project, oral tell-back, or mastery-proof prompt.</p></div>';
    }
    return `<div class="kc-prompt-list">${prompts.map(prompt => `
      <button class="kc-prompt-row ${prompt.id === activeId ? 'active' : ''}" type="button" data-kc-action="select" data-kc-id="${escapeHtml(prompt.id)}">
        <span class="kc-prompt-title">${escapeHtml(prompt.title)}</span>
        <span class="kc-prompt-meta">${escapeHtml(BLH_KNOWLEDGE_CHECK_LABELS[prompt.type] || prompt.type)} · ${escapeHtml(prompt.subject)} · ${escapeHtml(prompt.status)}</span>
        ${editable ? '<span class="kc-edit-hint">Edit</span>' : ''}
      </button>`).join('')}</div>`;
  }

  function knowledgeCheckEditor(prompt){
    if (!prompt) {
      return '<div class="kc-empty kc-editor-empty"><h3>Select or create a prompt</h3><p>The builder keeps subjective proof separate from formal Quiz/Test scoring.</p></div>';
    }
    return `<form class="kc-editor" data-testid="knowledge-editor" onsubmit="return false">
      <div class="kc-form-grid">
        <label class="field kc-span-2"><span>Prompt title</span><input id="kcTitle" data-testid="knowledge-title" maxlength="240" value="${escapeHtml(prompt.title)}"></label>
        <label class="field"><span>Prompt type</span><select id="kcType" data-testid="knowledge-type">${knowledgeCheckTypeOptions(prompt.type)}</select></label>
        <label class="field"><span>Status</span><select id="kcStatus">${knowledgeCheckStatusOptions(prompt.status)}</select></label>
        <label class="field"><span>Subject</span><input id="kcSubject" maxlength="160" value="${escapeHtml(prompt.subject)}"></label>
        <label class="field"><span>Learner track</span><input id="kcTrack" maxlength="160" value="${escapeHtml(prompt.track)}"></label>
        <label class="field kc-span-2"><span>Student directions</span><textarea id="kcDirections" data-testid="knowledge-directions" rows="5" maxlength="6000">${escapeHtml(prompt.studentDirections)}</textarea></label>
        <label class="field kc-span-2"><span>Evidence expectations</span><textarea id="kcEvidence" data-testid="knowledge-evidence" rows="4" maxlength="4000">${escapeHtml(prompt.evidenceExpectations)}</textarea></label>
        <label class="field kc-span-2"><span>Success criteria · one per line</span><textarea id="kcCriteria" rows="4">${escapeHtml((prompt.criteria || []).join('\n'))}</textarea></label>
        <label class="field kc-span-2 kc-adult-field"><span>Return-for-revision language · adult only</span><textarea id="kcReturn" data-testid="knowledge-return-language" rows="3" maxlength="2000">${escapeHtml(prompt.returnLanguage || '')}</textarea></label>
        <label class="field kc-span-2 kc-adult-field"><span>Approval language · adult only</span><textarea id="kcApproval" data-testid="knowledge-approval-language" rows="3" maxlength="2000">${escapeHtml(prompt.approvalLanguage || '')}</textarea></label>
        <label class="field kc-span-2 kc-adult-field"><span>Adult planning notes · never shown in student preview</span><textarea id="kcAdultNotes" data-testid="knowledge-adult-notes" rows="4" maxlength="4000">${escapeHtml(prompt.adultNotes || '')}</textarea></label>
      </div>
      <div class="kc-actions">
        <button class="btn primary" type="button" data-kc-action="save" data-testid="knowledge-save">Save prompt</button>
        <button class="btn" type="button" data-kc-action="duplicate">Duplicate</button>
        <button class="btn danger" type="button" data-kc-action="delete">Delete</button>
      </div>
    </form>`;
  }

  function knowledgeCheckDirectorRollup(prompts){
    const ready = prompts.filter(prompt => prompt.status === 'ready').length;
    const draft = prompts.filter(prompt => prompt.status === 'draft').length;
    const archived = prompts.filter(prompt => prompt.status === 'archived').length;
    const byType = window.BLHKnowledgeChecks.BLH_KNOWLEDGE_CHECK_TYPES.map(type => ({
      type,
      count: prompts.filter(prompt => prompt.type === type).length
    })).filter(item => item.count);
    return `<div class="kc-director" data-testid="knowledge-director-rollup">
      <div class="kc-stat-grid">
        <div class="kc-stat"><b>${prompts.length}</b><span>Total prompts</span></div>
        <div class="kc-stat"><b>${ready}</b><span>Ready</span></div>
        <div class="kc-stat"><b>${draft}</b><span>Draft</span></div>
        <div class="kc-stat"><b>${archived}</b><span>Archived</span></div>
      </div>
      <div class="panel"><h3>Prompt mix</h3>${byType.length ? `<ul>${byType.map(item => `<li>${escapeHtml(BLH_KNOWLEDGE_CHECK_LABELS[item.type] || item.type)}: ${item.count}</li>`).join('')}</ul>` : '<p>No prompts have been created.</p>'}</div>
      <div class="panel"><h3>Governance boundary</h3><p>Director view summarizes the prompt bank. Authoring remains with Parent, Teacher, and Admin roles; student work remains adult-reviewed and is never auto-graded here.</p></div>
    </div>`;
  }

  function renderKnowledgeCheckBuilder(){
    const el = document.getElementById('screen-knowledge');
    if (!el) return;
    const role = activeRole();
    const settings = ensureKnowledgeCheckState();
    if (role === 'student') {
      el.innerHTML = roleLimitedPanel('Adult knowledge-check workspace', 'Students receive only assigned proof prompts. Authoring, bank import/export, adult notes, and approval language remain hidden.');
      return;
    }
    if (role === 'director') {
      el.innerHTML = `<div class="kc-shell" data-knowledge-check-builder="v10.36">
        <div class="kc-heading"><div><div class="kc-kicker">Knowledge Check Builder v1</div><h2>Adult-reviewed proof rollup</h2><p>See the mix and readiness of subjective prompts without editing family-level authoring details.</p></div></div>
        ${knowledgeCheckDirectorRollup(settings.prompts)}
      </div>`;
      return;
    }
    if (!knowledgeCheckCanEdit(role)) {
      el.innerHTML = roleLimitedPanel('Knowledge-check workspace unavailable', 'This role does not author subjective proof prompts.');
      return;
    }

    const active = selectedKnowledgeCheckPrompt();
    if (active && settings.activePromptId !== active.id) settings.activePromptId = active.id;
    el.innerHTML = `<div class="kc-shell" data-knowledge-check-builder="v10.36">
      <div class="kc-heading">
        <div><div class="kc-kicker">Knowledge Check Builder v1</div><h2>Build adult-reviewed learning proof</h2><p>Create recitations, discussions, notebook checks, projects, oral tell-backs, and mastery proof without mixing them into formal Quiz/Test scoring.</p></div>
        <div class="kc-heading-actions">
          <button class="btn primary" type="button" data-kc-action="new" data-testid="knowledge-new">New prompt</button>
          <button class="btn" type="button" data-kc-action="export" data-testid="knowledge-export">Export bank</button>
          <button class="btn" type="button" data-kc-action="import" data-testid="knowledge-import">Import bank</button>
          <input id="kcImportFile" data-testid="knowledge-import-file" type="file" accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="kc-boundary"><b>Boundary:</b> no auto-grading, no route-only rewards, and no student access to adult notes, return language, approval language, or bank controls.</div>
      <div class="kc-workspace">
        <aside class="kc-bank-panel"><div class="kc-panel-title"><h3>Prompt bank</h3><span>${settings.prompts.length}</span></div>${knowledgeCheckPromptList(settings.prompts, settings.activePromptId, true)}</aside>
        <main class="kc-editor-panel">${knowledgeCheckEditor(active)}${knowledgeCheckStudentPreview(active)}</main>
      </div>
    </div>`;
  }

  function readKnowledgeCheckForm(prompt){
    const criteria = String(document.getElementById('kcCriteria')?.value || '')
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean);
    return window.BLHKnowledgeChecks.normalizeKnowledgeCheckPrompt({
      ...prompt,
      title: document.getElementById('kcTitle')?.value || '',
      type: document.getElementById('kcType')?.value || '',
      status: document.getElementById('kcStatus')?.value || 'draft',
      subject: document.getElementById('kcSubject')?.value || '',
      track: document.getElementById('kcTrack')?.value || '',
      studentDirections: document.getElementById('kcDirections')?.value || '',
      evidenceExpectations: document.getElementById('kcEvidence')?.value || '',
      criteria,
      returnLanguage: document.getElementById('kcReturn')?.value || '',
      approvalLanguage: document.getElementById('kcApproval')?.value || '',
      adultNotes: document.getElementById('kcAdultNotes')?.value || '',
      updatedAt: new Date().toISOString()
    });
  }

  function saveKnowledgeCheckPrompt(){
    const settings = ensureKnowledgeCheckState();
    const prompt = selectedKnowledgeCheckPrompt();
    if (!prompt) return;
    try {
      const normalized = readKnowledgeCheckForm(prompt);
      const index = settings.prompts.findIndex(item => item.id === prompt.id);
      if (index < 0) throw new Error('Selected prompt no longer exists.');
      settings.prompts[index] = normalized;
      settings.activePromptId = normalized.id;
      saveState();
      toast('Knowledge check saved · adult review required');
    } catch (error) {
      toast(`Save failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function addKnowledgeCheckPrompt(){
    const settings = ensureKnowledgeCheckState();
    const prompt = newKnowledgeCheckPrompt();
    settings.prompts.push(prompt);
    settings.activePromptId = prompt.id;
    saveState();
    toast('New knowledge check created');
  }

  function duplicateKnowledgeCheckPrompt(){
    const settings = ensureKnowledgeCheckState();
    const source = selectedKnowledgeCheckPrompt();
    if (!source) return;
    const now = new Date().toISOString();
    const duplicate = {
      ...source,
      id: knowledgeCheckId('kc_copy'),
      title: `${source.title} · Copy`,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    };
    settings.prompts.push(duplicate);
    settings.activePromptId = duplicate.id;
    saveState();
    toast('Knowledge check duplicated');
  }

  function deleteKnowledgeCheckPrompt(){
    const settings = ensureKnowledgeCheckState();
    const prompt = selectedKnowledgeCheckPrompt();
    if (!prompt) return;
    if (!confirm(`Delete “${prompt.title}”? This removes the local draft only.`)) return;
    settings.prompts = settings.prompts.filter(item => item.id !== prompt.id);
    settings.activePromptId = settings.prompts[0]?.id || '';
    saveState();
    toast('Knowledge check deleted');
  }

  function serializeCurrentKnowledgeCheckBank(){
    const settings = ensureKnowledgeCheckState();
    return window.BLHKnowledgeChecks.serializeKnowledgeCheckBank(settings.prompts, { productVersion: '10.36' });
  }

  function exportKnowledgeCheckBank(){
    try {
      downloadText(BLH_KNOWLEDGE_CHECK_FILE, serializeCurrentKnowledgeCheckBank(), 'application/json');
      toast('Knowledge-check bank exported');
    } catch (error) {
      toast(`Export failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
    }
  }

  function importKnowledgeCheckBank(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const settings = ensureKnowledgeCheckState();
      const prior = settings.prompts;
      const priorActive = settings.activePromptId;
      try {
        const bank = window.BLHKnowledgeChecks.parseKnowledgeCheckBank(String(reader.result || ''));
        if (!confirm(`Replace the local prompt bank with ${bank.prompts.length} validated prompt${bank.prompts.length === 1 ? '' : 's'}?`)) return;
        settings.prompts = bank.prompts;
        settings.activePromptId = bank.prompts[0]?.id || '';
        saveState();
        toast('Validated knowledge-check bank imported');
      } catch (error) {
        settings.prompts = prior;
        settings.activePromptId = priorActive;
        toast(`Import failed: ${error.code ? `${error.code}: ` : ''}${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-kc-action]');
    if (!control) return;
    const role = activeRole();
    if (!knowledgeCheckCanEdit(role)) return;
    const action = control.dataset.kcAction;
    if (action === 'new') addKnowledgeCheckPrompt();
    if (action === 'select') {
      ensureKnowledgeCheckState().activePromptId = control.dataset.kcId || '';
      renderKnowledgeCheckBuilder();
    }
    if (action === 'save') saveKnowledgeCheckPrompt();
    if (action === 'duplicate') duplicateKnowledgeCheckPrompt();
    if (action === 'delete') deleteKnowledgeCheckPrompt();
    if (action === 'export') exportKnowledgeCheckBank();
    if (action === 'import') document.getElementById('kcImportFile')?.click();
  });

  document.addEventListener('change', event => {
    if (event.target?.id !== 'kcImportFile') return;
    importKnowledgeCheckBank(event.target.files?.[0]);
    event.target.value = '';
  });

  window.BLHKnowledgeCheckUI = Object.freeze({
    release: BLH_KNOWLEDGE_CHECK_RELEASE,
    ensureState: ensureKnowledgeCheckState,
    serializeCurrentBank: serializeCurrentKnowledgeCheckBank,
    render: renderKnowledgeCheckBuilder
  });

  function renderV1036ReleaseNote(){
    const list = document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.36-knowledge-check-builder"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.36-knowledge-check-builder"><b>v10.36 Knowledge Check Builder v1</b><p>Added adult-only authoring, deterministic prompt-bank import/export, student-safe preview, role boundaries, and fail-closed validation for recitations, discussions, notebooks, projects, oral tell-backs, and mastery proof. Subjective work remains adult-reviewed and is never auto-graded.</p></div>');
    }
  }

  const v1036BaseRenderAll = renderAll;
  renderAll = function(){
    v1036BaseRenderAll();
    renderKnowledgeCheckBuilder();
    renderV1036ReleaseNote();
  };
