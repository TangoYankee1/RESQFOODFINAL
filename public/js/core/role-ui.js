// Shared interactions for role dashboards. This module has no backend dependencies.
export function bindRoleTabs(pairs) {
  const tabs = pairs.map(({ tab, panel }) => ({
    tab: document.getElementById(tab), panel: document.getElementById(panel),
  })).filter(pair => pair.tab && pair.panel);
  if (!tabs.length) return;
  function select(index, focus = false, remember = true) {
    if(remember){const url=new URL(location.href);url.searchParams.set('tab',tabs[index].tab.id);history.replaceState(null,'',url);}
    tabs.forEach(({ tab, panel }, i) => {
      const selected = i === index;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panel.classList.toggle('hidden', !selected);
      panel.hidden = !selected;
    });
    if (focus) tabs[index].tab.focus();
  }
  tabs.forEach(({ tab, panel }, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.tabIndex = 0;
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });
  const saved = new URL(location.href).searchParams.get('tab');
  const chosen = tabs.findIndex(({tab})=>tab.id===saved);
  select(chosen>=0?chosen:Math.max(0,tabs.findIndex(({tab})=>tab.classList.contains('active'))),false,false);
}

export function bindSignOutDialog(signOut) {
  const trigger = document.getElementById('btn-signout');
  if (!trigger || trigger.dataset.signoutBound) return;
  trigger.dataset.signoutBound = 'true';
  const dialog = document.createElement('dialog');
  dialog.id = 'signout-modal';
  dialog.className = 'signout-dialog';
  dialog.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', 'signout-title');
  dialog.setAttribute('aria-describedby', 'signout-description');
  dialog.innerHTML = `<h2 id="signout-title">Mag-sign out?</h2>
    <p id="signout-description">Mag-sign in muli para makabalik sa iyong account.</p>
    <p id="signout-error" class="signout-error" role="alert"></p>
    <div class="signout-actions">
      <button type="button" class="btn btn-ghost" id="btn-cancel-signout" autofocus>Huwag na</button>
      <button type="button" class="btn btn-danger" id="btn-confirm-signout">Sign Out</button>
    </div>`;
  document.body.appendChild(dialog);
  const cancel = dialog.querySelector('#btn-cancel-signout');
  const confirm = dialog.querySelector('#btn-confirm-signout');
  const error = dialog.querySelector('#signout-error');
  let busy = false;
  trigger.addEventListener('click', () => {
    error.textContent = '';
    if (!dialog.open) dialog.showModal();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && busy) { event.preventDefault(); return; }
    if (event.key !== 'Tab') return;
    const controls = [cancel, confirm].filter(button => !button.disabled);
    if (!controls.length) { event.preventDefault(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => trigger.focus());
  confirm.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    cancel.disabled = confirm.disabled = true;
    dialog.focus();
    dialog.setAttribute('aria-busy', 'true');
    confirm.textContent = 'Nagsa-sign out…';
    error.textContent = '';
    try {
      await signOut();
      window.location.assign(new URL('login.html', window.location.href).href);
    } catch {
      error.textContent = 'Hindi makapag-sign out. Subukan muli.';
    } finally {
      busy = false;
      cancel.disabled = confirm.disabled = false;
      dialog.removeAttribute('aria-busy');
      confirm.textContent = 'Sign Out';
      if (dialog.open) confirm.focus();
    }
  });
}
