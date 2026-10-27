import { loadAdminSession } from '../core/adminSession.js';
// public/js/modules/adminAudit.js — PRODUCTION (immutable audit trail viewer)
// Wires admin/audit.html to the live `auditLogs` collection + exportCsv.
// No BASE_AUDIT, no sessionStorage — the log is the real, server-written trail.
import { bootGuardedPage } from '../core/guard-boot.js';
import { auditLogsQuery, watchQuery } from '../core/data.js';
import { exportCsv } from '../core/callables.js';
import { handleError, runWithState } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';

let adminSession = null;
let unsub = null;
let allLogs = [];
let currentAction = 'all';

export async function initAdminAudit(s) {
  if (!await loadAdminSession(s)) return;
  adminSession = s;
  loadAudit();
  bindFilters();
  bindExport();
  bindSignOut();
  setupOnline();
}

if (typeof document !== 'undefined' && document.getElementById('audit-body')) {
  bootGuardedPage({ roles: ['lguAdmin', 'systemAdmin'] }, initAdminAudit);
}

const ACTION_LABEL = {
  user_suspended: 'Suspended',
  org_activated: 'Org Activated',
  report_exported: 'Exported',
  user_viewed: 'Viewed',
  account_activated: 'Account Created',
  verify_qr: 'QR Verified',
  verify_pin: 'PIN Verified',
  donationStatusChanged: 'Status Changed',
  set_user_status: 'Status Set',
};

function loadAudit() {
  const tbody = document.getElementById('audit-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-muted);">Loading...</td></tr>`;
  if (unsub) { unsub(); unsub = null; }
  const q = auditLogsQuery({ includeLegacy: true });
  unsub = watchQuery(q, {
    next: (docs) => {
      allLogs = docs.map(d => ({ ...d, action: d.action || d.type || '',
        actorUid: d.actorUid || d.uid || '', entityId: d.entityId || d.donationId || d.targetUid || '',
        createdAt: d.createdAt || d.at || null }))
        .sort((a, b) => auditTime(b.createdAt) - auditTime(a.createdAt));
      renderAudit();
    },
    error: (err) => {
      const h = handleError(err, { scope: 'adminAudit.list' });
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-danger);">${esc(h.message)}</td></tr>`;
    },
  });
}

function auditTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function actionChip(action) {
  const label = ACTION_LABEL[action] || action;
  return `<span class="audit-chip audit-${esc(action)}">${esc(label)}</span>`;
}

function renderAudit() {
  const tbody = document.getElementById('audit-body');
  if (!tbody) return;
  const rows = currentAction === 'all' ? allLogs : allLogs.filter((e) => e.action === currentAction);
  setText('audit-count', rows.length);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang rekord.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((e) => `
    <tr>
      <td style="white-space:nowrap;font-size:.8rem;color:var(--color-muted);">${esc(formatDateTime(e.createdAt))}</td>
      <td><strong>${esc(e.actorUid || '—')}</strong></td>
      <td>${actionChip(e.action)}</td>
      <td>${esc(e.entityId || '—')}</td>
      <td style="color:var(--color-muted);font-size:.82rem;">${esc(e.details ? JSON.stringify(e.details) : '—')}</td>
    </tr>`).join('');
}

function bindFilters() {
  document.querySelectorAll('[data-action]').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-action]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentAction = btn.dataset.action || 'all';
      renderAudit();
    }));
}

function bindExport() {
  document.getElementById('btn-export-audit')?.addEventListener('click', (e) => {
    runWithState({ btn: e.currentTarget }, async () => {
      const res = await exportCsv({ kind: 'audit', action: currentAction });
      if (!res || !res.csv) throw new Error('export_failed');
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.filename || 'ResQFood_audit.csv';
      a.click(); URL.revokeObjectURL(url);
      toast('Na-export ang audit trail!', 'success');
    }, 'adminAudit.export').then(result => { if (!result.ok) toast(result.error.message, 'error'); });
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
