import { loadAdminSession } from '../core/adminSession.js';
// public/js/modules/systemAdmin.js — PRODUCTION (a: boot + missions + stats)
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

export async function initSystemAdmin(s) {
  if (!await loadAdminSession(s)) return;
  adminSession = s;
  try {
    const p = await fetchDoc(`users/${s.user.uid}`);
    setText('admin-name', p?.fullName || s.user.displayName || 'Admin');
  } catch (err) { handleError(err, { scope: 'systemAdmin.profile' }); }
  loadActiveMissions();
  loadDonationsFeed();
  loadUsersCount();
  bindRangeBtns();
  bindExportCSV();
  bindSignOut();
  setupOnline();
}

if (typeof document !== 'undefined' && document.getElementById('active-missions-body')) {
  bootGuardedPage({ roles: ['lguAdmin', 'systemAdmin'] }, initSystemAdmin);
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
        scheduled: { cls: 'badge-scheduled', label: 'Scheduled' },
        pickedUp: { cls: 'badge-pickedup', label: 'Picked Up' },
        enRoute: { cls: 'badge-enroute', label: 'En Route' },
        delivered: { cls: 'badge-delivered', label: 'Delivered' },
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
      const h = handleError(err, { scope: 'systemAdmin.missions' });
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-danger);">${esc(h.message)} — I-refresh ang pahina.</td></tr>`;
    },
  });
}

function loadDonationsFeed() {
  const q = donationsQuery();
  watchQuery(q, {
    next: (docs) => { allDonations = docs; recomputeStats(); },
    error: (err) => handleError(err, { scope: 'systemAdmin.feed' }),
  });
}

function loadUsersCount() {
  const q = usersQuery({ max: 0 });
  watchQuery(q, {
    next: (docs) => {
      const active = docs.filter((u) => u.status === 'active');
      setText('users-total', active.length);
    },
    error: (err) => handleError(err, { scope: 'systemAdmin.users' }),
  });
}
// public/js/modules/systemAdmin.js — PRODUCTION (b: stats + charts + export)
function rangeStart(range) {
  const now = new Date();
  if (range === '7') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (range === 'month') {
    const manila = new Date(now.getTime() + 8 * 3600000);
    return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1) - 8 * 3600000);
  }
  const d = new Date(now); d.setDate(d.getDate() - 30); return d;
}

function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function recomputeStats() {
  const start = rangeStart(currentRange);
  const inRange = allDonations.filter((d) => { const t = toDate(d.createdAt); return t && t >= start; });
  const verified = inRange.filter((d) => d.status === 'verified');
  const kg = verified.reduce((s, d) => s + (Number(d.quantityKg) || 0), 0);
  setText('stat-kg', `${Math.round(kg * 10) / 10} kg`);
  setText('stat-missions', verified.length);
  setText('stat-orgs', new Set(verified.map(d => d.orgId).filter(Boolean)).size);
  renderCharts(inRange, verified, kg);
}

function bindRangeBtns() {
  document.querySelectorAll('.range-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range || '30';
      recomputeStats();
    });
  });
}

function renderCharts(inRange, verified, totalKg) {
  if (typeof Chart === 'undefined') return;
  const FOOD_TYPES = ['Kanin', 'Gulay', 'Tinapa', 'Tinapay', 'Manok', 'Baboy', 'Processed', 'Iba pa'];
  const foodKg = FOOD_TYPES.map(() => 0);
  verified.forEach(d => {
    const index = FOOD_TYPES.indexOf(d.foodType);
    foodKg[index < 0 ? FOOD_TYPES.length - 1 : index] += Number(d.quantityKg) || 0;
  });

  const foodEl = document.getElementById('chart-food');
  if (foodEl && foodEl._chart) { foodEl._chart.data.datasets[0].data = foodKg; foodEl._chart.update(); }
  else if (foodEl) {
    foodEl._chart = new Chart(foodEl, {
      type: 'bar',
      data: { labels: FOOD_TYPES, datasets: [{ data: foodKg, backgroundColor: '#396632', borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } },
    });
  }

  const biz = verified.filter((d) => d.donorType === 'business' || d.donorType === 'negosyo').length;
  const ind = verified.filter(d => ['individual','indibidwal'].includes(d.donorType)).length;
  const unknown = verified.length - biz - ind;
  const donorEl = document.getElementById('chart-donor');
  if (donorEl && donorEl._chart) { donorEl._chart.data.datasets[0].data = [biz, ind, unknown]; donorEl._chart.update(); }
  else if (donorEl) {
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
  allDonations.filter(d => d.status === 'verified').forEach((d) => {
    const t = toDate(d.createdAt); if (!t) return;
    const ageWeeks = Math.floor((Date.now() - t.getTime()) / (7 * 86400000));
    const key = Object.keys(buckets)[7 - ageWeeks];
    if (key && ageWeeks >= 0) buckets[key] += Number(d.quantityKg) || 0;
  });
  const trendEl = document.getElementById('chart-trend');
  const trendData = Object.values(buckets).map((v) => Math.round(v * 10) / 10);
  if (trendEl && trendEl._chart) { trendEl._chart.data.datasets[0].data = trendData; trendEl._chart.update(); }
  else if (trendEl) {
    trendEl._chart = new Chart(trendEl, {
      type: 'line',
      data: { labels: Object.keys(buckets).map((k) => k.slice(5)), datasets: [{ data: trendData, borderColor: '#396632', backgroundColor: 'rgba(57,102,50,.12)', fill: true, tension: .35 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } },
    });
  }
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
    }, 'systemAdmin.export').then(result => { if (!result.ok) toast(result.error.message, 'error'); });
  });
}

function bindSignOut() {
  const modal = document.getElementById('signout-modal');
  document.getElementById('btn-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'flex'; });
  document.getElementById('btn-cancel-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  document.getElementById('btn-confirm-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser(); window.location.href = '/admin/login.html';
  });
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
