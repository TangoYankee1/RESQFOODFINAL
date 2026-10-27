// public/js/core/guard-boot.js
// Load in <head> of EVERY protected page (donor/volunteer/org-admin/admin):
//   <script type="module">
//     import { bootGuardedPage } from '../js/core/guard-boot.js';
//     bootGuardedPage({ roles: ['donor'] }, init);
//   </script>
// Blocks render until auth+role resolve (no flash of unauthorized content).
// Unauthenticated direct URLs redirect to login with ?next= preserved.
import { requirePage } from './router.js';
import { t } from './i18n.js';

document.documentElement.hidden = true;

function showGuardError(message) {
  document.documentElement.hidden = false;
  document.body.innerHTML =
    '<main style="max-width:480px;margin:4rem auto;padding:2rem;text-align:center;font-family:system-ui">' +
    '<h1 style="font-size:1.25rem;margin-bottom:.5rem">ResQFood</h1>' +
    '<p>' + message + '</p>' +
    '<p><a href="/register/index.html">Mag-sign in →</a></p></main>';
}

export async function bootGuardedPage(opts, init) {
  try {
    const session = await requirePage(opts);
    if (typeof init === 'function') await init(session);
    document.documentElement.dataset.pageReady = '1';
    document.documentElement.hidden = false;
    return session;
  } catch (err) {
    if (err && err.code === 'guard-redirect') return null; // redirect issued
    // Fail safely: honest error state, never a blank screen or mock data.
    showGuardError(t('common.error') + ' (' + ((err && err.code) || 'guard') + ')');
    return null;
  }
}
