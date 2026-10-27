// public/js/core/ui.js
// Shared accessible components. Keyboard-navigable, Tagalog copy via i18n.
import { t } from './i18n.js';
import { watchConnection } from './data.js';

export function toast(message, type = 'info', duration = 3500) {
  let host = document.getElementById('toast-container');
  if (!host) { host = document.createElement('div'); host.id = 'toast-container'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), duration);
  return el;
}

export function initOfflineBanner() {
  if (!document.getElementById('offline-banner')) {
    const b = document.createElement('div');
    b.id = 'offline-banner';
    b.hidden = true;
    b.setAttribute('role', 'alert');
    b.textContent = t('common.offline');
    b.style.cssText = 'position:sticky;top:0;z-index:50;background:#7c2d12;color:#fff;padding:.5rem 1rem;text-align:center;font-size:.9rem;';
    document.body.prepend(b);
  }
  const banner = document.getElementById('offline-banner');
  watchConnection((online) => {
    banner.hidden = online;
    if (!online) banner.textContent = t('common.offline');
    else toast(t('common.online'), 'success', 2000);
  });
}

export function renderState(container, state, opts = {}) {
  // state: { kind: 'loading'|'empty'|'error', message?, onRetry? }
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = `state state-${state.kind}`;
  wrap.setAttribute('role', 'status');
  const p = document.createElement('p');
  p.textContent = state.message || (state.kind === 'loading' ? t('common.loading') : state.kind === 'empty' ? t('common.emptyState') : t('common.error'));
  wrap.appendChild(p);
  if (state.kind === 'error' && state.onRetry !== false) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-ghost';
    btn.textContent = t('common.retry');
    btn.addEventListener('click', () => opts.onRetry && opts.onRetry());
    wrap.appendChild(btn);
  }
  container.appendChild(wrap);
  return wrap;
}

export function trapFocus(modal) {
  const focusables = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return () => {};
  const first = focusables[0]; const last = focusables[focusables.length - 1];
  function onKey(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  modal.addEventListener('keydown', onKey);
  (first).focus();
  return () => modal.removeEventListener('keydown', onKey);
}
