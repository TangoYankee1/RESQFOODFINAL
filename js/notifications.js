let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message, type = 'info', durationMs = 4000) {
  const root = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}

export async function requestPushPermission() {
  if (!('Notification' in window)) {
    toast('Push notifications are not supported in this browser.', 'error');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    toast('Notifications enabled.', 'success');
    return true;
  }
  toast('Notification permission denied.', 'error');
  return false;
}

export function notifyLocal(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/assets/icons/icon-192.png' });
  }
}
