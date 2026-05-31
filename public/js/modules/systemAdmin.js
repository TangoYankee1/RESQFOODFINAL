// LGU System Admin dashboard — mock data, Chart.js charts, CSV export

const MOCK_ADMIN = { name: 'Maria Santos', barangay: 'Lahug' };

const MOCK_ACTIVE_MISSIONS = [
  { id:'M001', volunteer:'Juan Dela Cruz', food:'Kanin at Ulam',     qty:5.0, org:'Lahug Soup Kitchen', status:'enRoute',   eta:'3:45 PM' },
  { id:'M002', volunteer:'Maria Santos',   food:'Tinapay (assorted)', qty:2.5, org:'Apas Feeding Prog.', status:'pickedUp',  eta:'4:30 PM' },
  { id:'M003', volunteer:'Carlos Uy',      food:'Gulay (assorted)',   qty:3.0, org:'Sto. Nino Shelter',  status:'scheduled', eta:'5:00 PM' },
  { id:'M004', volunteer:'Ana Reyes',      food:'Tinapa',             qty:1.5, org:'Lahug Soup Kitchen', status:'delivered', eta:'Nakarating' },
];

// 8-week labels (most recent last)
const WEEK_LABELS = ['Apr 7','Apr 14','Apr 21','Apr 28','May 5','May 12','May 19','May 26'];
const WEEK_DATA   = [98, 145, 120, 187, 203, 178, 156, 160];

const FOOD_TYPES  = ['Kanin', 'Gulay', 'Tinapa', 'Tinapay', 'Iba pa'];
const FOOD_KG     = [450, 320, 180, 167, 130];

const DONOR_TYPES = ['Negosyo', 'Indibidwal'];
const DONOR_COUNTS = [38, 25];

const MOCK_DONATIONS_CSV = [
  { date:'May 28, 2026', donor:'Jose Cruz',  food:'Kanin at Ulam',     qty:5.0, volunteer:'Juan Dela Cruz', org:'Lahug Soup Kitchen', status:'enRoute' },
  { date:'May 28, 2026', donor:'Rosa Tan',   food:'Tinapay',           qty:1.5, volunteer:'Maria Santos',   org:'Lahug Soup Kitchen', status:'verified' },
  { date:'May 27, 2026', donor:'Jose Cruz',  food:'Gulay (assorted)',  qty:3.0, volunteer:'Pedro Diaz',     org:'Lahug Soup Kitchen', status:'verified' },
  { date:'May 27, 2026', donor:'Rosa Tan',   food:'Kanin',             qty:2.0, volunteer:'Juan Dela Cruz', org:'Apas Feeding Prog.', status:'verified' },
  { date:'May 26, 2026', donor:'Nena Lim',   food:'Tinapa',            qty:5.0, volunteer:'Carlos Uy',      org:'Lahug Soup Kitchen', status:'verified' },
];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderActiveMissions();
  initCharts();
  bindRangeBtns();
  bindExportCSV();
  bindSignOut();
  setupOnline();
});

// ── Active missions table ─────────────────────────────────────────────────────
function renderActiveMissions() {
  const tbody = document.getElementById('active-missions-body');
  if (!tbody) return;

  if (!MOCK_ACTIVE_MISSIONS.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang active missions.</td></tr>`;
    return;
  }

  const STATUS_MAP = {
    scheduled: { cls: 'badge-scheduled', label: 'Scheduled' },
    pickedUp:  { cls: 'badge-pickedup',  label: 'Picked Up' },
    enRoute:   { cls: 'badge-enroute',   label: 'En Route' },
    delivered: { cls: 'badge-delivered', label: 'Delivered' },
  };

  tbody.innerHTML = MOCK_ACTIVE_MISSIONS.map(m => {
    const s = STATUS_MAP[m.status] || { cls: 'badge-pending', label: m.status };
    return `<tr>
      <td><strong>${esc(m.volunteer)}</strong></td>
      <td>${esc(m.food)}</td>
      <td style="font-weight:700; color:var(--color-primary);">${m.qty} kg</td>
      <td>${esc(m.org)}</td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td style="color:var(--color-muted); font-size:.82rem;">${esc(m.eta)}</td>
    </tr>`;
  }).join('');
}

// ── Charts ────────────────────────────────────────────────────────────────────
function initCharts() {
  const primary  = '#396632';
  const accent   = '#fc9430';
  const success  = '#2e7d32';
  const muted    = '#94a3b8';

  // Bar: food type
  const ctxFood = document.getElementById('chart-food');
  if (ctxFood) {
    new Chart(ctxFood, {
      type: 'bar',
      data: {
        labels: FOOD_TYPES,
        datasets: [{
          label: 'kg',
          data: FOOD_KG,
          backgroundColor: [primary, accent, success, '#1d4ed8', muted],
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }

  // Pie: donor type
  const ctxDonor = document.getElementById('chart-donor');
  if (ctxDonor) {
    new Chart(ctxDonor, {
      type: 'doughnut',
      data: {
        labels: DONOR_TYPES,
        datasets: [{
          data: DONOR_COUNTS,
          backgroundColor: [primary, accent],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 16 } },
        },
        cutout: '60%',
      },
    });
  }

  // Line: weekly trend
  const ctxTrend = document.getElementById('chart-trend');
  if (ctxTrend) {
    new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: WEEK_LABELS,
        datasets: [{
          label: 'kg na-rescue',
          data: WEEK_DATA,
          borderColor: primary,
          backgroundColor: 'rgba(57,102,50,.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: primary,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, grid: { color: '#e2e8f0' }, ticks: { font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        },
      },
    });
  }
}

// ── Date range buttons (visual only for prototype) ────────────────────────────
function bindRangeBtns() {
  const labels = {
    '7':     { kg:'412', missions:'21', orgs:'10', active:'2' },
    '30':    { kg:'1,247', missions:'63', orgs:'12', active:'4' },
    'month': { kg:'1,051', missions:'55', orgs:'11', active:'4' },
  };

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const d = labels[btn.dataset.range] || labels['30'];
      setText('stat-kg',       d.kg);
      setText('stat-missions', d.missions);
      setText('stat-orgs',     d.orgs);
      setText('stat-active',   d.active);
    });
  });
}

// ── CSV export ────────────────────────────────────────────────────────────────
function bindExportCSV() {
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const rows = [['Petsa','Donor','Pagkain','Dami (kg)','Volunteer','Organisasyon','Status']];
    MOCK_DONATIONS_CSV.forEach(d => rows.push([d.date, d.donor, d.food, d.qty, d.volunteer, d.org, d.status]));
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ResQFood_Lahug_May2026.csv';
    a.click(); URL.revokeObjectURL(url);
    showToast('Na-export ang CSV!', 'success');
  });
}

// ── Sign out ──────────────────────────────────────────────────────────────────
function bindSignOut() {
  const modal = document.getElementById('signout-modal');
  document.getElementById('btn-signout')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  document.getElementById('btn-cancel-signout')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  document.getElementById('btn-confirm-signout')?.addEventListener('click', () => {
    window.location.href = '/register/index.html';
  });
  modal?.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className   = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
