import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery, cancelDonation, fetchDoc } from '../core/data.js';
import { refreshDonorExpiry, donorMissionContact } from '../core/callables.js';
import { donorStats } from '../core/donorStats.js';
import { handleError, runWithState } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';

const labels = { pending: 'Naka-post', scheduled: 'May Kumuha', pickedUp: 'Nakuha na', enRoute: 'Papunta',
  delivered: 'Naihatid', verified: 'Natanggap', cancelled: 'Na-cancel', expired: 'Tapos na ang pickup window' };
const steps = ['pending','scheduled','pickedUp','enRoute','delivered','verified'];
let session, unsubscribe, refreshing = false, timer;
let previous = null;
const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

export async function initDonor(current) {
  session = current;
  try {
    const profile = await fetchDoc(`users/${session.user.uid}`);
    set('greeting-name', `Kumusta, ${profile?.fullName?.split(' ')[0] || 'Ka-ResQ'}!`);
  } catch (error) { handleError(error, { scope: 'donor.profile' }); }
  document.querySelectorAll('.donor-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.donor-tab').forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
    ['board','history','stats'].forEach(name => document.getElementById(`panel-${name}`)?.classList.toggle('hidden', name !== tab.dataset.tab));
  }));
  const modal = document.getElementById('signout-modal');
  const signOut = async () => { await signOutCurrentUser(); location.href = '/register/index.html'; };
  document.getElementById('btn-signout')?.addEventListener('click', () => modal ? modal.style.display = 'flex' : signOut());
  document.getElementById('btn-cancel-signout')?.addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('btn-confirm-signout')?.addEventListener('click', signOut);
  const toggle = document.getElementById('history-toggle-btn');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    document.getElementById('completed-list')?.classList.toggle('open', open);
  });
  subscribe();
  await refreshExpiry();
  timer = setInterval(refreshExpiry, 60000);
  window.addEventListener('online', refreshExpiry);
  window.addEventListener('pagehide', () => { unsubscribe?.(); clearInterval(timer); window.removeEventListener('online', refreshExpiry); }, { once: true });
}

async function refreshExpiry() {
  if (!navigator.onLine || refreshing) return;
  refreshing = true;
  try { await refreshDonorExpiry(); }
  catch (error) { handleError(error, { scope: 'donor.expiry' }); }
  finally { refreshing = false; }
}

function subscribe() {
  unsubscribe?.();
  ['active-list','completed-list','history-list'].forEach(id => {
    const el = document.getElementById(id); if (el) renderState(el, { kind: 'loading' });
  });
  // Small capstone dataset: one own-donations subscription drives board/history/stats.
  unsubscribe = watchQuery(donationsQuery({ donorId: session.user.uid }), {
    next: docs => {
      const active = docs.filter(d => steps.includes(d.status) && d.status !== 'verified');
      const finished = docs.filter(d => ['verified','cancelled','expired'].includes(d.status));
      set('active-count', active.length);
      renderList('active-list', active, 'Wala pang aktibong donation. Mag-post ng surplus!');
      renderList('completed-list', finished.slice(0,5), 'Wala pang natapos na donation.');
      renderList('history-list', docs, 'Wala ka pang donation sa kasaysayan.');
      const stats = donorStats(docs);
      set('stat-kg', `${Math.round(stats.totalDonatedKg * 100) / 100} kg`);
      set('stat-points', stats.points); set('stat-verified', stats.verifiedCount);
      set('stat-cancelled', stats.cancelledCount); set('stat-expired', stats.expiredCount);
      set('stat-reliability', stats.reliabilityScore);
      set('stat-badge', stats.reliabilityScore >= 30 ? 'Maaasahan' : stats.totalDonations < 3 ? 'Baguhan' : 'Neutral');
      if (previous) docs.forEach(d => {
        if (previous.has(d.id) && previous.get(d.id) !== d.status) toast(`${d.foodType}: ${labels[d.status] || d.status}`, 'info');
      });
      previous = new Map(docs.map(d => [d.id, d.status]));
    },
    error: error => {
      const handled = handleError(error, { scope: 'donor.records' });
      ['active-list','completed-list','history-list'].forEach(id => {
        const el = document.getElementById(id);
        if (el) renderState(el, { kind: 'error', message: handled.message }, { onRetry: subscribe });
      });
      ['stat-kg','stat-points','stat-verified','stat-cancelled','stat-expired','stat-reliability'].forEach(id => set(id, '—'));
    },
  });
}

function renderList(id, docs, message) {
  const list = document.getElementById(id);
  if (!list) return;
  if (!docs.length) { renderState(list, { kind: 'empty', message }); return; }
  list.innerHTML = docs.map(d => {
    const idx = steps.indexOf(d.status);
    const progress = idx >= 0 ? `<div class="stepper">${steps.map((status,i) =>
      `<div class="step ${i < idx ? 'done' : i === idx ? 'current' : ''}"><span class="dot">${i < idx ? '✓' : i+1}</span><span class="lbl">${labels[status]}</span></div>`).join('')}</div>` : '';
    const actions = d.status === 'pending' || d.status === 'scheduled'
      ? `<a class="btn btn-ghost" href="qr-display.html?donationId=${encodeURIComponent(d.id)}">Tingnan ang Pickup QR/PIN</a>` : '';
    return `<article class="donation-card status-${esc(d.status)}" data-donation="${esc(d.id)}"><div class="donation-card__head"><div>
      <div class="donation-card__food">${esc(d.foodType)} · ${esc(d.quantityKg)} kg</div>
      <div class="donation-card__meta">${esc(formatDateTime(d.createdAt))} · Tatanggap: ${esc(d.orgName || 'Hindi nakatakda')}</div>
      <div class="donation-card__meta">Pickup hanggang ${esc(formatDateTime(d.pickupWindowEnd))}</div></div>
      <span class="badge">${esc(labels[d.status] || d.status)}</span></div>${progress}${actions}
      ${d.status === 'pending' ? `<button class="btn btn-ghost" data-cancel="${esc(d.id)}">Kanselahin</button>` : ''}</article>`;
  }).join('');
  list.querySelectorAll('.status-scheduled,.status-pickedUp,.status-enRoute,.status-delivered').forEach(card => {
    const donation = docs.find(d => d.id === card.dataset.donation);
    if (!donation) return;
    const button = document.createElement('button'); button.className = 'btn btn-ghost'; button.textContent = 'Tawagan ang volunteer';
    card.append(button);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const contact = await donorMissionContact(donation.id);
        if (!contact.phone) { toast('Walang nakatalang contact number. Makipag-ugnayan sa admin.', 'info'); return; }
        const link = document.createElement('a'); link.href = `tel:${contact.phone}`;
        link.textContent = `${contact.name}: ${contact.phone}`; link.className = 'btn btn-ghost'; button.replaceWith(link);
      } catch (error) { handleError(error, { scope: 'donor.contact' }); }
      finally { button.disabled = false; }
    });
  });
  list.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', async () => {
    if (!window.confirm('Kanselahin ang donation na ito?')) return;
    await runWithState({ btn }, async () => {
      const result = await cancelDonation(btn.dataset.cancel);
      toast(result.status === 'expired' ? 'Tapos na ang pickup window.' : 'Na-cancel ang donation.', 'success');
    }, 'donor.cancel');
  }));
}

if (document.getElementById('active-list') || document.getElementById('donor-history-page')) {
  bootGuardedPage({ roles: ['donor'] }, initDonor);
}
