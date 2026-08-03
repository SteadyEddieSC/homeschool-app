  let lessonPackPointerAction = null;
  let lessonPackPointerClickSuppressionUntil = 0;

  document.addEventListener('pointerdown', event => {
    const control = event.target.closest('[data-lpa-action="apply"],[data-lpa-action="rollback"]');
    if (!control || control.disabled || !lessonPackApplyCanManage(activeRole())) return;
    lessonPackPointerAction = {
      action:control.dataset.lpaAction || '',
      overlayId:control.dataset.overlayId || '',
      rollbackNote:control.dataset.overlayId
        ? (document.querySelector(`[data-lpa-rollback-note="${CSS.escape(control.dataset.overlayId)}"]`)?.value || '')
        : '',
      pointerId:event.pointerId,
      x:event.clientX,
      y:event.clientY
    };
  }, true);

  document.addEventListener('pointercancel', event => {
    if (lessonPackPointerAction?.pointerId === event.pointerId) lessonPackPointerAction = null;
  }, true);

  document.addEventListener('pointerup', event => {
    const pending = lessonPackPointerAction;
    lessonPackPointerAction = null;
    if (!pending || pending.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 12) return;

    const proxyHost = document.createElement('div');
    proxyHost.hidden = true;
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.dataset.lpaAction = pending.action;
    if (pending.overlayId) proxy.dataset.overlayId = pending.overlayId;
    proxyHost.appendChild(proxy);
    if (pending.overlayId) {
      const note = document.createElement('textarea');
      note.dataset.lpaRollbackNote = pending.overlayId;
      note.value = pending.rollbackNote;
      proxyHost.appendChild(note);
    }
    document.body.prepend(proxyHost);
    lessonPackPointerClickSuppressionUntil = performance.now() + 800;
    proxy.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:window }));
    proxyHost.remove();
    event.preventDefault();
  }, true);

  document.addEventListener('click', event => {
    if (!event.isTrusted || performance.now() > lessonPackPointerClickSuppressionUntil) return;
    const control = event.target.closest('[data-lpa-action="apply"],[data-lpa-action="rollback"]');
    if (!control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
