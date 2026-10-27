import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery, fetchDoc } from '../core/data.js';
import { receiptStats, receiptDate } from '../core/receiptStats.js';
import { esc, formatDateTime } from '../core/utils.js';
import { renderState } from '../core/ui.js';
import { handleError } from '../core/errors.js';

bootGuardedPage({ roles: ['volunteer'] }, async session => {
  const list = document.getElementById('volunteer-history');
  const profile = await fetchDoc(`users/${session.user.uid}`);
  if (profile?.status !== 'active') {
    renderState(list, { kind: 'empty', message: profile?.status === 'rejected'
      ? 'Hindi naaprubahan ang application. Makipag-ugnayan sa administrator.'
      : 'Pending ang account review. Makikita ang history pagkatapos ng activation.' });
    return;
  }
  const load = () => {
    renderState(list, { kind: 'loading' });
    return watchQuery(donationsQuery({ volunteerId: session.user.uid, status: 'verified' }), {
      next(docs) {
        docs.sort((a, b) => (receiptDate(b.verifiedAt)?.getTime() || 0) - (receiptDate(a.verifiedAt)?.getTime() || 0));
        const stats = receiptStats(docs);
        document.getElementById('history-kg').textContent = stats.totalKg;
        document.getElementById('history-missions').textContent = stats.missions;
        if (!docs.length) {
          renderState(list, { kind: 'empty', message: 'Wala pang mission na nakumpirma ng receiving organization.' });
          return;
        }
        list.innerHTML = docs.map(d => `<div class="hist-mission"><div class="hist-info">
          <div class="hist-food">${esc(d.foodType)} · ${esc(d.quantityKg)} kg</div>
          <div class="hist-meta">${esc(d.orgName || '')}</div>
          <div class="hist-meta">${esc(formatDateTime(d.verifiedAt))}</div>
          <span class="hist-status-badge s-delivered">Verified</span>
        </div></div>`).join('');
      },
      error(err) {
        const failure = handleError(err, { scope: 'volunteer.history' });
        renderState(list, { kind: 'error', message: failure.message });
      },
    });
  };
  const unsubscribe = load();
  window.addEventListener('pagehide', unsubscribe, { once: true });
});
