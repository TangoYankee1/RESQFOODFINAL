// public/js/modules/orgHistory.js — PRODUCTION (org-admin verified-delivery history)
// Wires org-admin/history.html to the org's own `verified` donations. Monthly
// summary is COMPUTED from real data (no MOCK_HISTORY). Read-only.
import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery } from '../core/data.js';
import { handleError } from '../core/errors.js';
import { esc, formatDateTime } from '../core/utils.js';
import { receiptStats } from '../core/receiptStats.js';
import { receiptDate } from '../core/receiptStats.js';
import { loadOrganizationSession } from '../core/organization.js';

let orgSession = null;
let unsub = null;
let receivingOrgId = null;

export async function initOrgHistory(s) {
  orgSession = s;
  const access = await loadOrganizationSession(s);
  receivingOrgId = access.org.orgId;
  if (!access.active) {
    document.getElementById('history-list').textContent = access.message;
    setupOnline();
    bindBack();
    return;
  }
  loadHistory();
  bindBack();
  setupOnline();
  window.addEventListener('pagehide', () => unsub?.(), { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('history-list')) {
  bootGuardedPage({ roles: ['orgAdmin'] }, initOrgHistory);
}

function loadHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--color-muted);">Loading…</div>`;
  if (unsub) { unsub(); unsub = null; }
  const q = donationsQuery({ orgId: receivingOrgId, status: 'verified' });
  unsub = watchQuery(q, {
    next: (docs) => {
      docs.sort((a, b) => (receiptDate(b.verifiedAt)?.getTime() || 0) - (receiptDate(a.verifiedAt)?.getTime() || 0));
      renderSummary(docs); renderList(docs);
    },
    error: (err) => {
      const h = handleError(err, { scope: 'orgHistory.list' });
      list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--color-danger);">${esc(h.message)}</div>`;
    },
  });
}

function renderSummary(docs) {
  const stats = receiptStats(docs);
  setText('sum-kg', stats.monthlyKg);
  setText('sum-deliveries', stats.missions);
  setText('sum-volunteers', stats.monthlyVolunteers);
  setText('sum-avg', stats.monthlyAverage);
}

function renderList(docs) {
  const list = document.getElementById('history-list');
  if (!list) return;
  if (!docs.length) {
    list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--color-muted);">Wala pang na-verify na delivery.</div>`;
    return;
  }
  list.innerHTML = docs.map((d) => `
    <div class="history-item">
      <span class="hi-check">✅</span>
      <div class="hi-info">
        <div class="hi-food">${esc(d.foodType)}</div>
        <div class="hi-meta">👤 ${esc(d.volunteerName || d.volunteerId || '—')}</div>
      </div>
      <div class="hi-right">
        <div class="hi-qty">${esc(d.quantityKg)} kg</div>
        <div class="hi-date">${esc(formatDateTime(d.verifiedAt))}</div>
      </div>
    </div>`).join('');
}

function bindBack() {
  document.getElementById('btn-back')?.addEventListener('click', () => history.back());
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
