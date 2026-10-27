// public/js/modules/orgAdmin.js — PRODUCTION (a: boot + incoming)
import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery } from '../core/data.js';
import { handleError } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { loadOrganizationSession } from '../core/organization.js';
import { updateOrganizationDetails } from '../core/callables.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';
import { receiptStats, receiptDate } from '../core/receiptStats.js';

let orgSession = null;
let orgProfile = null;
let unsubIncoming = null;
let unsubVerified = null;
let receivingOrgId = null;
let organizationAccess;

export async function initOrgAdmin(s) {
  orgSession = s;
  try {
    organizationAccess = await loadOrganizationSession(s);
    receivingOrgId = organizationAccess.org.orgId;
    orgProfile = organizationAccess.org;
    renderHeader(organizationAccess.user);
    if (!organizationAccess.active) {
      const banner = document.getElementById('pending-banner');
      banner.classList.remove('hidden'); banner.textContent = organizationAccess.message;
    }
  } catch (err) { handleError(err, { scope: 'orgAdmin.profile' }); throw err; }
  bindTabs();
  bindSignOut();
  if (!organizationAccess.active) {
    for (const id of ['panel-incoming', 'panel-verified', 'panel-history']) {
      renderState(document.getElementById(id), { kind: 'empty', message: organizationAccess.message });
    }
    return;
  }
  loadIncoming();
  loadVerifiedToday();
  bindDetails();
  window.addEventListener('pagehide', () => { unsubIncoming?.(); unsubVerified?.(); }, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('panel-incoming')) {
  bootGuardedPage({ roles: ['orgAdmin'] }, initOrgAdmin);
}

function renderHeader(userDoc) {
  setText('org-name', orgProfile?.orgName || userDoc?.fullName || 'Organization');
  setText('org-address', orgProfile.address || 'Kulang ang eksaktong delivery address. Kumpirmahin ito sa inyong coordinator.');
  const pill = document.getElementById('mode-pill');
  if (pill) pill.textContent = (orgProfile?.mode || 'standard') === 'standard' ? 'Standard Mode · QR' : 'Basic Mode · PIN';
}

function bindDetails() {
  setText('org-address', orgProfile.address || 'Kulang ang eksaktong delivery address. Kumpirmahin ito sa inyong coordinator.');
  const form = document.getElementById('org-details-form');
  form.hidden = !organizationAccess.primary;
  if (!organizationAccess.primary) return;
  form.elements.address.value = orgProfile.address || '';
  form.elements.mode.value = orgProfile.mode || 'standard';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'); button.disabled = true;
    const status = document.getElementById('org-details-status'); status.textContent = '';
    try {
      const result = await updateOrganizationDetails({ address: form.elements.address.value, mode: form.elements.mode.value });
      orgProfile.address = result.address; orgProfile.mode = result.mode;
      setText('org-address', result.address); renderHeader(organizationAccess.user);
      status.textContent = 'Na-save ang delivery address at verification mode.';
      toast(status.textContent, 'success');
    } catch (error) { status.textContent = handleError(error, { scope: 'orgAdmin.details' }).message; }
    finally { button.disabled = false; }
  });
}

function loadIncoming() {
  const container = document.getElementById('panel-incoming');
  if (!container || !orgSession) return;
  renderState(container, { kind: 'loading' });
  if (unsubIncoming) { unsubIncoming(); unsubIncoming = null; }
  const orgId = receivingOrgId;
  const q = donationsQuery({ orgId, statusIn: ['enRoute', 'delivered'] });
  unsubIncoming = watchQuery(q, {
    next: (docs) => {
      setText('incoming-count', docs.length);
      const dot = document.getElementById('incoming-dot');
      if (dot) dot.style.display = docs.some((d) => d.status === 'delivered') ? 'block' : 'none';
      if (orgProfile && orgProfile.status !== 'active') {
        renderState(container, { kind: 'empty', message: 'Makikita ang deliveries pagkatapos ma-approve ang organization at makumpleto ang orientation.' });
        return;
      }
      if (!docs.length) { renderState(container, { kind: 'empty', message: 'Walang paparating na delivery ngayon.' }); return; }
      const delivered = docs.filter((d) => d.status === 'delivered');
      const enroute = docs.filter((d) => d.status === 'enRoute');
      let html = '';
      if (delivered.length) html += `<div class="section-head"><span class="pulse-dot"></span> NAKARATING NA — I-verify</div>` + delivered.map(deliveryCard).join('');
      if (enroute.length) html += `<div class="section-head">PAPARATING (EN ROUTE)</div>` + enroute.map(deliveryCard).join('');
      container.innerHTML = html;
    },
    error: (err) => {
      const h = handleError(err, { scope: 'orgAdmin.incoming' });
      renderState(container, { kind: 'error', message: h.message }, { onRetry: loadIncoming });
    },
  });
}

function deliveryCard(d) {
  const isDelivered = d.status === 'delivered';
  return `<div class="delivery-card ${isDelivered ? 'arrived' : 'enroute'}">
    <div class="dc-top"><div>
      <div class="dc-food">${esc(d.foodType)} · ${esc(d.quantityKg)} kg</div>
      <div class="dc-meta">Volunteer: ${esc(d.volunteerName || d.volunteerId || '')}</div>
      <div class="dc-meta">${esc(formatDateTime(d.createdAt))}</div>
    </div><span class="badge badge-${esc(d.status)}">${isDelivered ? 'Nakarating na' : 'En Route'}</span></div>
    <div class="dc-actions">${isDelivered
      ? `<a class="btn btn-primary btn-full" href="verify.html?donationId=${encodeURIComponent(d.id)}">I-verify ang Pagtanggap</a>`
      : `<button class="btn btn-ghost btn-full" disabled style="opacity:.5;">Naghihintay pa...</button>`}</div>
  </div>`;
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
// public/js/modules/orgAdmin.js — PRODUCTION (b: history + tabs + signout)
function loadVerifiedToday() {
  const container = document.getElementById('panel-verified');
  if (!container || !orgSession) return;
  renderState(container, { kind: 'loading' });
  if (unsubVerified) { unsubVerified(); unsubVerified = null; }
  const orgId = receivingOrgId;
  const q = donationsQuery({ orgId, status: 'verified' });
  unsubVerified = watchQuery(q, {
    next: (docs) => {
      const stats = receiptStats(docs);
      setText('stat-kg', stats.monthlyKg);
      setText('stat-deliveries', stats.missions);
      setText('stat-today', stats.todayMissions);
      docs = stats.todayVerified.sort((a, b) => receiptDate(b.verifiedAt) - receiptDate(a.verifiedAt));
      if (!docs.length) { renderState(container, { kind: 'empty', message: 'Wala pang na-verify ngayong araw.' }); return; }
      container.innerHTML = docs.map((d) => `<div class="delivery-card delivered">
        <div class="dc-top"><div>
          <div class="dc-food">${esc(d.foodType)} · ${esc(d.quantityKg)} kg</div>
          <div class="dc-meta">Volunteer: ${esc(d.volunteerName || d.volunteerId || '')}</div>
          <div class="dc-meta">${esc(formatDateTime(d.verifiedAt || d.createdAt))}</div>
        </div><span class="badge badge-verified">Verified</span></div>
      </div>`).join('');
    },
    error: (err) => {
      const h = handleError(err, { scope: 'orgAdmin.history' });
      renderState(container, { kind: 'error', message: h.message }, { onRetry: loadVerifiedToday });
    },
  });
}

function bindTabs() {
  [{ btn: 'tab-incoming', panel: 'panel-incoming' }, { btn: 'tab-verified', panel: 'panel-verified' }, { btn: 'tab-history', panel: 'panel-history' }]
    .forEach(({ btn, panel }) => {
      document.getElementById(btn)?.addEventListener('click', () => {
        ['tab-incoming', 'tab-verified', 'tab-history'].forEach((b) => document.getElementById(b)?.classList.remove('active'));
        ['panel-incoming', 'panel-verified', 'panel-history'].forEach((p) => document.getElementById(p)?.classList.add('hidden'));
        document.getElementById(btn)?.classList.add('active');
        document.getElementById(panel)?.classList.remove('hidden');
      });
    });
}

function bindSignOut() {
  const modal = document.getElementById('signout-modal');
  document.getElementById('btn-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'flex'; });
  document.getElementById('btn-cancel-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  document.getElementById('btn-confirm-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    window.location.href = '/org-admin/login.html';
  });
}
