  function renderOfflineRuntimeStatus(){
    const demoBand = document.getElementById('blh1033DemoNotice');
    if (!demoBand || !window.BLHOfflineRuntime) return;
    let status = demoBand.querySelector('[data-testid="offline-runtime-status"]');
    if (!status) {
      status = document.createElement('span');
      status.className = 'blh1039-offline-status';
      status.dataset.testid = 'offline-runtime-status';
      status.dataset.offlineRuntime = 'v10.39';
      const firstStatus = demoBand.querySelector('[data-testid="demo-scenario-status"]');
      if (firstStatus) firstStatus.insertAdjacentElement('afterend', status);
      else demoBand.appendChild(status);
    }
    const snapshot = window.BLHOfflineRuntime.snapshot();
    status.textContent = snapshot.blockedCount
      ? `Offline boundary active · ${snapshot.blockedCount} external attempt${snapshot.blockedCount === 1 ? '' : 's'} blocked`
      : 'Offline-ready · no external runtime requests';
    status.dataset.blockedCount = String(snapshot.blockedCount);
  }

  function renderV1039ReleaseNote(){
    const list = document.querySelector('#screen-updates .v27-release-list') || document.getElementById('screen-updates');
    if (list && !list.querySelector('[data-release="v10.39-offline-runtime"]')) {
      list.insertAdjacentHTML('afterbegin', '<div class="v27-release-item" data-release="v10.39-offline-runtime"><b>v10.39 Modularization + Offline Regression Foundation</b><p>Extracted a reusable offline/runtime request boundary, added network-blocked workflow tests and visual comparison baselines, and preserved the deterministic single-file release without changing role, reward, completion, or source-record behavior.</p></div>');
    }
  }

  const v1039BaseRenderAll = renderAll;
  renderAll = function(){
    v1039BaseRenderAll();
    renderOfflineRuntimeStatus();
    renderV1039ReleaseNote();
  };

  window.addEventListener('blh:offline-runtime', renderOfflineRuntimeStatus);
