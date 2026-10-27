// public/js/modules/volunteer.js — PRODUCTION (a: boot + available)
import { bootGuardedPage } from '../core/guard-boot.js';
import { pendingDonationsQuery, donationsQuery, watchQuery, fetchDoc } from '../core/data.js';
import { claimDonation } from '../core/callables.js';
import { handleError } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';
import { receiptStats } from '../core/receiptStats.js';

let volSession = null;
let unsubAvail = null;
let unsubMine = null;
let unsubStats = null;

export async function initVolunteer(s) {
  volSession = s;
  bindTabs();
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser(); window.location.href = '/volunteer/login.html';
  });
  try {
    const p = await fetchDoc(`users/${s.user.uid}`);
    const el = document.getElementById('vol-greeting-name');
    if (el) el.textContent = (p?.fullName || p?.nickname || s.user.displayName || 'Volunteer').split(' ')[0];
    document.getElementById('orientation-banner')?.classList.toggle('hidden', p?.status === 'active');
    if (p?.status !== 'active') {
      const message = p?.status === 'rejected' ? 'Hindi naaprubahan ang application. Makipag-ugnayan sa administrator.'
        : 'Pending ang account review at orientation. I-refresh ang pahina pagkatapos ng approval.';
      for (const id of ['panel-available', 'panel-my', 'panel-history']) {
        renderState(document.getElementById(id), { kind: 'empty', message });
      }
      if (p?.status === 'rejected') document.getElementById('orientation-banner').textContent = message;
      return;
    }
  } catch (err) { handleError(err, { scope: 'volunteer.profile' }); throw err; }
  loadAvailable();
  loadMine();
  const refresh = setInterval(loadAvailable, 30000);
  window.addEventListener('pagehide', () => {
    clearInterval(refresh); unsubAvail?.(); unsubMine?.(); unsubStats?.();
  }, { once: true });
  if (unsubStats) unsubStats();
  unsubStats = watchQuery(donationsQuery({ volunteerId: s.user.uid, status: 'verified' }), {
    next(docs) {
      const stats = receiptStats(docs);
      setText('stat-kg', stats.totalKg);
      setText('stat-missions', stats.missions);
    },
    error(err) { handleError(err, { scope: 'volunteer.stats' }); },
  });
}

if (typeof document !== 'undefined' && document.getElementById('panel-available')) {
  bootGuardedPage({ roles: ['volunteer'] }, initVolunteer);
}

function loadAvailable() {
  const container = document.getElementById('panel-available');
  if (!container || !volSession) return;
  renderState(container, { kind: 'loading' });
  if (unsubAvail) { unsubAvail(); unsubAvail = null; }
  unsubAvail = watchQuery(pendingDonationsQuery(50), {
    next: (docs) => {
      docs = docs.filter(d => typeof d.orgId === 'string' && d.orgId && !d.orgId.includes('/'));
      if (!docs.length) { renderState(container, { kind: 'empty', message: 'Walang available missions ngayon.' }); return; }
      const urgent = docs.filter((m) => isUrgent(m));
      const regular = docs.filter((m) => !isUrgent(m));
      let html = '';
      if (urgent.length) html += `<div class="section-head"><span class="urgent-dot"></span> URGENT — Malapit na ang pickup window</div>` + urgent.map(missionCard).join('');
      if (regular.length) html += `<div class="section-head">AVAILABLE MISSIONS</div>` + regular.map(missionCard).join('');
      container.innerHTML = html;
      container.querySelectorAll('.btn-accept').forEach((btn) => btn.addEventListener('click', () => acceptMission(btn.dataset.id, btn)));
    },
    error: (err) => {
      const h = handleError(err, { scope: 'volunteer.available' });
      renderState(container, { kind: 'error', message: h.message }, { onRetry: loadAvailable });
    },
  });
}

function isUrgent(m) {
  try {
    const end = m.pickupWindowEnd && m.pickupWindowEnd.toDate ? m.pickupWindowEnd.toDate().getTime() : new Date(m.pickupWindowEnd).getTime();
    return end - Date.now() < 2 * 60 * 60 * 1000;
  } catch { return false; }
}

function missionCard(m) {
  return `<div class="mission-card ${isUrgent(m) ? 'urgent' : 'regular'}" data-id="${esc(m.id)}">
    <div class="mc-top"><div>
      <div class="mc-food">${esc(m.foodType)}</div>
      <div class="mc-qty">${esc(m.quantityKg)} kg · ${esc(m.barangay || '')}</div>
    </div></div>
    <div class="mc-window">Pickup hanggang: <strong>${esc(formatDateTime(m.pickupWindowEnd))}</strong></div>
    <div class="mc-addr">${esc(m.pickupAddress || '')}</div>
    <button class="btn btn-primary btn-full btn-accept" data-id="${esc(m.id)}">Tanggapin ang Mission</button>
  </div>`;
}

async function acceptMission(id, btn) {
  if (btn.disabled) return;
  btn.disabled = true;
  const messages = { expired: 'Tapos na ang pickup window.', not_pending: 'Nakuha na o hindi na available ang mission.',
    not_found: 'Hindi na makita ang mission.', destination_required: 'Wala pang receiving organization ang donation.',
    destination_inactive: 'Hindi aktibo ang receiving organization.' };
  try {
    const res = await claimDonation({ donationId: id });
    if (!res || res.success === false) {
      const message = messages[res?.reason];
      if (message) { toast(message, 'error'); loadAvailable(); return; }
      throw new Error(res?.reason || 'claim_failed');
    }
    toast('Mission tinanggap! Tingnan ang Aking Missions.', 'success');
  } catch (error) {
    toast(messages[error.details?.reason] || handleError(error, { scope: 'volunteer.claim' }).message, 'error');
    if (messages[error.details?.reason]) loadAvailable();
  } finally { btn.disabled = false; }
}
// public/js/modules/volunteer.js — PRODUCTION (b: my missions + tabs)
function loadMine() {
  const container = document.getElementById('panel-my');
  if (!container || !volSession) return;
  renderState(container, { kind: 'loading' });
  if (unsubMine) { unsubMine(); unsubMine = null; }
  const q = donationsQuery({ volunteerId: volSession.user.uid, statusIn: ['scheduled', 'pickedUp', 'enRoute', 'delivered'] });
  unsubMine = watchQuery(q, {
    next: (docs) => {
      const ac = document.getElementById('active-count');
      if (ac) ac.textContent = docs.length;
      setText('stat-awaiting', docs.filter(d => d.status === 'delivered').length);
      if (!docs.length) { renderState(container, { kind: 'empty', message: 'Wala ka pang active mission. Pumili mula sa available list.' }); return; }
      container.innerHTML = docs.map((m) => `<div class="mission-card regular" data-id="${esc(m.id)}">
        <div class="mc-top"><div>
          <div class="mc-food">${esc(m.foodType)}</div>
          <div class="mc-qty">${esc(m.quantityKg)} kg · ${esc(m.barangay || '')}</div>
        </div><span class="mc-urgency urgency-normal">${esc(statusLabel(m.status))}</span></div>
        <div class="mc-window">Pickup hanggang: <strong>${esc(formatDateTime(m.pickupWindowEnd))}</strong></div>
        <a class="btn btn-primary btn-full" href="active-mission.html?donationId=${encodeURIComponent(m.id)}">Tingnan ang Mission</a>
      </div>`).join('');
    },
    error: (err) => {
      const h = handleError(err, { scope: 'volunteer.mine' });
      renderState(container, { kind: 'error', message: h.message }, { onRetry: loadMine });
    },
  });
}

function statusLabel(s) {
  return { scheduled: 'Scheduled', pickedUp: 'Picked Up', enRoute: 'En Route', delivered: 'Delivered' }[s] || s;
}

function bindTabs() {
  [{ btn: 'tab-available', panel: 'panel-available' }, { btn: 'tab-my', panel: 'panel-my' }, { btn: 'tab-history', panel: 'panel-history' }]
    .forEach(({ btn, panel }) => {
      document.getElementById(btn)?.addEventListener('click', () => {
        ['tab-available', 'tab-my', 'tab-history'].forEach((b) => document.getElementById(b)?.classList.remove('active'));
        ['panel-available', 'panel-my', 'panel-history'].forEach((p) => document.getElementById(p)?.classList.add('hidden'));
        document.getElementById(btn)?.classList.add('active');
        document.getElementById(panel)?.classList.remove('hidden');
      });
    });
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
