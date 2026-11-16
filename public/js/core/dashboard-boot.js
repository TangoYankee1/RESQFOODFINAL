// Load before modules so failed imports cannot leave an empty page.
document.documentElement.dataset.dashboardLoading = 'true';
window.dashboardBoot = (() => {
  let ready = false;
  function screen(message, failed = false) {
    document.documentElement.hidden = false;
    let host = document.getElementById('dashboard-loading');
    if (!host) {
      host = document.createElement('section'); host.id = 'dashboard-loading';
      host.innerHTML = '<img class="resqfood-logo" src="/assets/resqfood-logo.png" alt="RESQFOOD" width="266" height="84" decoding="async" /><p role="status"></p><div class="boot-actions"><button type="button" class="btn btn-primary">Subukan Muli</button><a class="btn btn-ghost">Mag-sign in</a></div>';
      host.querySelector('button').onclick = () => location.reload();
      host.querySelector('a').href = new URL('login.html', location.href).href;
      document.body.append(host);
    }
    host.querySelector('p').textContent = message;
    host.querySelector('.boot-actions').hidden = !failed;
  }
  document.addEventListener('DOMContentLoaded', () => { if (!ready) screen('Inihahanda ang iyong dashboard…'); });
  const timer = setTimeout(() => { if (!ready) screen('Hindi pa ma-load ang dashboard. Suriin ang koneksyon at subukan muli.', true); }, 20000);
  return {
    ready() { ready = true; clearTimeout(timer); delete document.documentElement.dataset.dashboardLoading; document.getElementById('dashboard-loading')?.remove(); },
    fail(message) { if (!ready) { clearTimeout(timer); screen(message, true); } },
  };
})();
window.addEventListener('error', () => { if (document.documentElement.dataset.dashboardLoading) window.dashboardBoot.fail('Hindi ma-load ang dashboard. I-refresh ang pahina o mag-sign in muli.'); });
window.addEventListener('unhandledrejection', () => { if (document.documentElement.dataset.dashboardLoading) window.dashboardBoot.fail('Hindi makakonekta ang dashboard. Subukan muli.'); });
