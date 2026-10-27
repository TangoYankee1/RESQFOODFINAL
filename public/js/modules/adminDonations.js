import { loadAdminSession } from '../core/adminSession.js';
// public/js/modules/adminDonations.js — PRODUCTION (read-only donations list)
// Wires admin/donations.html to the live `donations` collection + exportCsv.
// No MOCK_DONATIONS, no client-built CSV — the server returns the CSV string.
import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery } from '../core/data.js';
import { exportCsv } from '../core/callables.js';
import { handleError, runWithState } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';

let adminSession = null;
let unsub = null;
let allDonations = [];
let currentStatus = 'all';

export async function initAdminDonations(s) {
  if (!await loadAdminSession(s)) return;
  adminSession = s;
  loadDonations();
  bindFilters();
  bindExport();
  bindSignOut();
  setupOnline();
}

if (typeof document !== 'undefined' && document.getElementById('donations-body')) {
  bootGuardedPage({ roles: ['lguAdmin', 'systemAdmin'] }, initAdminDonations);
}

const STATUS_MAP = {
  pending: { cls: 'badge-pending', label: 'Pending' },
  scheduled: { cls: 'badge-scheduled', label: 'Scheduled' },
  pickedUp: { cls: 'badge-pickedup', label: 'Picked Up' },
  enRoute: { cls: 'badge-enroute', label: 'En Route' },
  delivered: { cls: 'badge-delivered', label: 'Delivered' },
  verified: { cls: 'badge-active', label: 'Verified' },
  cancelled: { cls: 'badge-suspended', label: 'Cancelled' },
};

function loadDonations() {
  const tbody = document.getElementById('donations-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-muted);">Loading...</td></tr>`;
  if (unsub) { unsub(); unsub = null; }
  const q = donationsQuery({ status: currentStatus === 'all' ? null : currentStatus });
  unsub = watchQuery(q, {
    next: (docs) => { allDonations = docs; renderTable(); },
    error: (err) => {
      const h = handleError(err, { scope: 'adminDonations.list' });
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-danger);">${esc(h.message)}</td></tr>`;
    },
  });
}

function renderTable() {
  const tbody = document.getElementById('donations-body');
  if (!tbody) return;
  const rows = currentStatus === 'all' ? allDonations : allDonations.filter((d) => d.status === currentStatus);
  setText('donation-count', rows.length);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang donations.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((d) => {
    const st = STATUS_MAP[d.status] || { cls: 'badge-pending', label: esc(d.status || '—') };
    return `<tr>
      <td style="font-size:.78rem;color:var(--color-muted);white-space:nowrap;">${esc(d.id)}</td>
      <td><strong>${esc(d.foodType)}</strong></td>
      <td style="font-weight:700;color:var(--color-primary);">${esc(d.quantityKg)}</td>
      <td>${esc(d.donorName || d.donorId || '—')}</td>
      <td>${esc(d.volunteerName || d.volunteerId || '—')}</td>
      <td>${esc(d.orgName || d.orgId || '—')}</td>
      <td><span class="badge ${st.cls}">${st.label}</span></td>
      <td style="font-size:.8rem;color:var(--color-muted);white-space:nowrap;">${esc(formatDateTime(d.createdAt))}</td>
    </tr>`;
  }).join('');
}

function bindFilters() {
  document.querySelectorAll('[data-status]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status || 'all';
      loadDonations();
    }));
}

function bindExport() {
  document.getElementById('btn-export-donations')?.addEventListener('click', (e) => {
    runWithState({ btn: e.currentTarget }, async () => {
      const res = await exportCsv({ kind: 'donations', status: currentStatus });
      if (!res || !res.csv) throw new Error('export_failed');
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.filename || 'ResQFood_donations.csv';
      a.click(); URL.revokeObjectURL(url);
      toast('Na-export ang donations!', 'success');
    }, 'adminDonations.export').then(result => { if (!result.ok) toast(result.error.message, 'error'); });
  });
}

function bindSignOut() {
  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    window.location.href = '/admin/login.html';
  });
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
