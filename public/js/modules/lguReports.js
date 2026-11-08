// public/js/modules/lguReports.js — LGU Admin Reports (rescue totals, charts, CSV export)
import { bootGuardedPage } from '../core/guard-boot.js';
import { donationsQuery, watchQuery, fetchDoc } from '../core/data.js';
import { exportCsv } from '../core/callables.js';
import { handleError, runWithState } from '../core/errors.js';
import { toast } from '../core/ui.js';
import { signOutCurrentUser } from '../core/auth.js';
import { esc } from '../core/utils.js';

let allDonations = [];
let unsub = null;

if (typeof document !== 'undefined' && document.getElementById('stat-total-kg')) {
  bootGuardedPage({ roles: ['lguAdmin'] }, initLguReports);
}

async function initLguReports(s) {
  loadStats();
  loadDonationsFeed();
  bindExportCSV();
  bindSignOut();
  setupOnline();
}

function loadStats() {
  const q = donationsQuery();
  unsub = watchQuery(q, {
    next: (docs) => {
      allDonations = docs;
      recomputeStats(docs);
    },
    error: (err) => handleError(err, { scope: 'lguReports.stats' }),
  });
}

function loadDonationsFeed() {
  const q = donationsQuery();
  watchQuery(q, {
    next: (docs) => { recomputeStats(docs); },
    error: (err) => handleError(err, { scope: 'lguReports.feed' }),
  });
}

function recomputeStats(docs) {
  const verified = docs.filter((d) => d.status === 'verified');
  const pending = docs.filter((d) => d.status === 'pending');

  const totalKg = verified.reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0);
  setText('stat-total-kg', Math.round(totalKg * 10) / 10);
  setText('stat-total-donations', docs.length);
  setText('stat-verified', verified.length);
  setText('stat-pending', pending.length);

  const biz = verified.filter((d) => d.donorType === 'business' || d.donorType === 'negosyo').length;
  const ind = verified.filter((d) => ['individual', 'indibidwal'].includes(d.donorType)).length;
  const unknown = verified.length - biz - ind;

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
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const day = new Date(); day.setDate(day.getDate() - i * 7);
    buckets[day.toISOString().slice(0, 10)] = 0;
  }
  verified.forEach((d) => {
    const t = new Date(d.createdAt || d.verifiedAt || 0);
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

function bindExportCSV() {
  document.getElementById('btn-export-csv')?.addEventListener('click', (e) => {
    runWithState({ btn: e.currentTarget }, async () => {
      const res = await exportCsv({ kind: 'donations', range: '30' });
      if (!res || !res.csv) throw new Error('export_failed');
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = res.filename || 'ResQFood_donations.csv';
      a.click(); URL.revokeObjectURL(url);
      toast('Na-export ang donations! Naitala sa audit log.', 'success');
    }, 'lguReports.export').then((result) => { if (!result.ok) toast(result.error.message, 'error'); });
  });
}

function bindSignOut() {
  const modal = document.getElementById('signout-modal');
  document.getElementById('btn-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'flex'; });
  document.getElementById('btn-cancel-signout')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
  document.getElementById('btn-confirm-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    window.location.href = '/lgu-admin/login.html';
  });
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }