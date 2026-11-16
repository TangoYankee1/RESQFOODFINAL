import { receiptDate } from '../core/receiptStats.js';
import { bindSignOutDialog } from '../core/role-ui.js';
// public/js/modules/lguAdmin.js — LGU Admin Dashboard (boot + metrics + missions)
import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, usersQuery, watchQuery, fetchDoc } from '../core/data.js';
import { exportCsv } from '../core/callables.js';
import { handleError, runWithState } from '../core/errors.js';
import { renderState, toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc, formatDateTime } from '../core/utils.js';

let adminSession = null;
let unsubMissions = null;
let allDonations = [];
let currentRange = '30';

export async function initLguAdmin(s) {
  adminSession = s;
  try {
    const p = await fetchDoc(`users/${s.user.uid}`);
    setText('admin-name', p?.fullName || s.user.displayName || 'LGU Admin');
  } catch (err) { handleError(err, { scope: 'lguAdmin.profile' }); }
  loadMetrics();
  loadActiveMissions();
  loadDonationsFeed();
  bindRangeBtns();
  bindExportCSV();
  bindSignOut();
  setupOnline();
}

if (typeof document !== 'undefined' && document.getElementById('active-missions-body')) {
  bootGuardedPage({ roles: ['lguAdmin'] }, initLguAdmin);
}
function loadMetrics() {
  const q = donationsQuery();
  watchQuery(q, {
    next: (docs) => { allDonations = docs; recomputeStats(); },
    error: (err) => handleError(err, { scope: 'lguAdmin.metrics' }),
  });
  watchQuery(usersQuery({ max: 0 }), {
    next: (docs) => {
      const orgs = docs.filter((u) => u.role === 'orgAdmin' && u.status === 'active').length;
      setText('stat-orgs', orgs);
    },
    error: (err) => handleError(err, { scope: 'lguAdmin.orgs' }),
  });
}

function loadActiveMissions() {
  const tbody = document.getElementById('active-missions-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-muted);">Loading...</td></tr>`;
  if (unsubMissions) { unsubMissions(); unsubMissions = null; }
  const q = donationsQuery({ statusIn: ['scheduled', 'pickedUp', 'enRoute', 'delivered'], max: 0 });
  unsubMissions = watchQuery(q, {
    next: (docs) => {
      if (!docs.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang active missions.</td></tr>`;
        setText('stat-active', 0);
        return;
      }
      setText('stat-active', docs.length);
      const STATUS_MAP = {
        scheduled: { cls: 'badge-scheduled', label: 'May Kumuha' },
        pickedUp: { cls: 'badge-pickedup', label: 'Nakuha na' },
        enRoute: { cls: 'badge-enroute', label: 'Papunta' },
        delivered: { cls: 'badge-delivered', label: 'Naihatid' },
      };
      tbody.innerHTML = docs.map((m) => {
        const st = STATUS_MAP[m.status] || { cls: 'badge-pending', label: m.status };
        return `<tr>
          <td><strong>${esc(m.volunteerName || m.volunteerId || '—')}</strong></td>
          <td>${esc(m.foodType)}</td>
          <td style="font-weight:700;color:var(--color-primary);">${esc(m.quantityKg)} kg</td>
          <td>${esc(m.orgName || m.orgId || '—')}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td style="color:var(--color-muted);font-size:.82rem;">${esc(formatDateTime(m.pickupWindowEnd))}</td>
        </tr>`;
      }).join('');
    },
    error: (err) => {
      const h = handleError(err, { scope: 'lguAdmin.missions' });
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-danger);">${esc(h.message)} — I-refresh ang pahina.</td></tr>`;
    },
  });
}

function loadDonationsFeed() {
  const q = donationsQuery();
  watchQuery(q, {
    next: (docs) => { allDonations = docs; recomputeStats(); },
    error: (err) => handleError(err, { scope: 'lguAdmin.feed' }),
  });
}

function recomputeStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const verified = allDonations.filter((d) => d.status === 'verified');
  const rangeStart = currentRange === '7' ? sevenDaysAgo : currentRange === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : thirtyDaysAgo;

  const inRange = verified.filter((d) => {
    const t = receiptDate(d.verifiedAt || d.createdAt) || new Date(NaN);
    return !isNaN(t.getTime()) && t >= rangeStart;
  });

  const totalKg = inRange.reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0);
  const missions = inRange.length;

  setText('stat-kg', Math.round(totalKg * 10) / 10);
  setText('stat-missions', missions);

  const donorCharts = allDonations.filter((d) => d.status === 'verified');
  const biz = donorCharts.filter((d) => d.donorType === 'business' || d.donorType === 'negosyo').length;
  const ind = donorCharts.filter((d) => ['individual', 'indibidwal'].includes(d.donorType)).length;
  const unknown = donorCharts.length - biz - ind;

  const donorEl = document.getElementById('chart-donor');
  if (donorEl && donorEl._chart) {
    donorEl._chart.data.datasets[0].data = [biz, ind, unknown];
    donorEl._chart.update();
  } else if (donorEl) {
    donorEl._chart = new Chart(donorEl, {
      type: 'doughnut',
      data: { labels: ['Negosyo', 'Indibidwal', 'Hindi naitala'], datasets: [{ data: [biz, ind, unknown], backgroundColor: ['#396632', '#fc9430', '#94a3b8'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  }

  const buckets = {};
  for (let i = 7; i >= 0; i--) {
    const day = new Date(); day.setDate(day.getDate() - i * 7);
    buckets[day.toISOString().slice(0, 10)] = 0;
  }
  verified.forEach((d) => {
    const t = receiptDate(d.verifiedAt || d.createdAt) || new Date(NaN);
    if (!t || isNaN(t.getTime())) return;
    const ageWeeks = Math.floor((Date.now() - t.getTime()) / (7 * 86400000));
    const key = Object.keys(buckets)[7 - ageWeeks];
    if (key && ageWeeks >= 0) buckets[key] += Number(d.quantityKg) || 0;
  });
  const trendEl = document.getElementById('chart-trend');
  const trendData = Object.values(buckets).map((v) => Math.round(v * 10) / 10);
  if (trendEl && trendEl._chart) {
    trendEl._chart.data.datasets[0].data = trendData;
    trendEl._chart.update();
  } else if (trendEl) {
    trendEl._chart = new Chart(trendEl, {
      type: 'line',
      data: { labels: Object.keys(buckets).map((k) => k.slice(5)), datasets: [{ data: trendData, borderColor: '#396632', backgroundColor: 'rgba(57,102,50,.12)', fill: true, tension: .35 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } },
    });
  }
}

function bindRangeBtns() {
  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      recomputeStats();
    });
  });
}

function bindExportCSV() {
  document.getElementById('btn-export-csv')?.addEventListener('click', (e) => {
    runWithState({ btn: e.currentTarget }, async () => {
      const res = await exportCsv({ kind: 'donations', range: currentRange });
      if (!res || !res.csv) throw new Error('export_failed');
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.filename || 'ResQFood_export.csv';
      a.click(); URL.revokeObjectURL(url);
      toast('Na-export ang CSV. Naitala sa audit log.', 'success');
    }, 'lguAdmin.export').then((result) => { if (!result.ok) toast(result.error.message, 'error'); });
  });
}

function bindSignOut() {
  bindSignOutDialog(signOutCurrentUser);
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }