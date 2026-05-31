// Donor dashboard — prototype / mock data (no Firebase)

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_USER = { displayName: 'Maria Santos' };

const MOCK_ACTIVE = [
  { id: 'D001', food: 'Kanin at Ulam',   qty: '3.5', status: 'en-route',  meta: 'Lahug · Kanina lang',       pickupWindow: 'Pickup: 12:00 PM – 1:00 PM' },
  { id: 'D002', food: 'Tinapay',          qty: '1.2', status: 'pending',   meta: 'Lahug · 2 oras na ang nakalipas', pickupWindow: 'Pickup: 3:00 PM – 4:00 PM' },
];

const MOCK_HISTORY = [
  { id: 'D003', food: 'Gulay (Mixed)',    qty: '2.0', status: 'delivered', meta: 'Kahapon' },
  { id: 'D004', food: 'Tinapa',           qty: '0.8', status: 'verified',  meta: '3 araw na ang nakalipas' },
];

const MOCK_STATS = { totalKg: 12.5, points: 45, verified: 3, cancelled: 0 };

const STEPS = ['Posted', 'Claimed', 'Picked Up', 'En Route', 'Delivered', 'Verified'];
const STATUS_STEP = {
  pending: 0, scheduled: 1, pickedUp: 2, enRoute: 3, delivered: 4, verified: 5, cancelled: -1,
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setGreeting();
  setKitchenAlert();
  setupTabs();
  renderActiveBoard();
  renderCompletedHistory();
  renderStats();
  setupSignOut();
  setupHistoryToggle();
  setupOnlineStatus();
});

// ── Greeting ──────────────────────────────────────────────────────────────────
function setGreeting() {
  const el   = document.getElementById('greeting-name');
  if (!el) return;
  const first = MOCK_USER.displayName.split(' ')[0];
  const hour  = new Date().getHours();
  const salut = hour < 12 ? 'Magandang umaga' : hour < 18 ? 'Magandang hapon' : 'Magandang gabi';
  el.textContent = `${salut}, ${first}!`;
}

// ── Kitchen time alert ────────────────────────────────────────────────────────
function setKitchenAlert() {
  const el   = document.getElementById('kitchen-alert');
  if (!el) return;
  const hour = new Date().getHours();
  let msg = '', cls = '';

  if      (hour >= 11 && hour < 13) { msg = '🍱 Oras na ng tanghalian! Mag-post ng natirang ulam bago lumamig.';           cls = 'alert-warning'; }
  else if (hour >= 17 && hour < 19) { msg = '🌅 Hapon na! I-post ang surplus bago mag-araw.';                             cls = 'alert-warning'; }
  else if (hour >= 19)              { msg = '🌙 Gabi na. Suriin ang Time Guardrail bago mag-post.';                       cls = 'alert-info'; }
  else if (hour >= 6 && hour < 9)   { msg = '☀️ Maaga pa! Magandang oras para mag-post ng almusal surplus.';             cls = 'alert-success'; }

  if (msg) {
    el.textContent = msg;
    el.className   = `kitchen-alert ${cls}`;
    el.classList.remove('hidden');
  }
}

// ── Tab navigation ────────────────────────────────────────────────────────────
function setupTabs() {
  // Remove all lock badges for demo — all tabs accessible
  document.querySelectorAll('.lock-badge').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.donor-tab.locked').forEach(el => el.classList.remove('locked'));

  document.querySelectorAll('.donor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.donor-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      ['board', 'history', 'stats'].forEach(name => {
        const panel = document.getElementById(`panel-${name}`);
        if (panel) panel.classList.toggle('hidden', tab.dataset.tab !== name);
      });
    });
  });
}

// ── Active board ──────────────────────────────────────────────────────────────
function renderActiveBoard() {
  // Remove skeleton loaders
  document.getElementById('skel-1')?.remove();
  document.getElementById('skel-2')?.remove();

  const list  = document.getElementById('active-list');
  const count = document.getElementById('active-count');
  if (!list) return;

  list.innerHTML = '';
  if (count) count.textContent = MOCK_ACTIVE.length;

  if (MOCK_ACTIVE.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍱</div>
        <p>Wala pang aktibong donation.</p>
        <p class="text-xs mt-2">I-tap ang "Mag-post ng Surplus" para magsimula.</p>
      </div>`;
    return;
  }

  MOCK_ACTIVE.forEach(d => list.appendChild(buildDonationCard(d)));
}

function buildDonationCard(data) {
  const card = document.createElement('div');
  const statusClass = data.status === 'pickedUp' ? 'picked-up'
    : data.status === 'enRoute' ? 'en-route' : data.status;
  card.className  = `donation-card status-${statusClass}`;
  card.dataset.id = data.id;

  card.innerHTML = `
    <div class="donation-card__head">
      <div>
        <div class="donation-card__food">${esc(data.food)} · ${esc(data.qty)} kg</div>
        <div class="donation-card__meta">${esc(data.pickupWindow || data.meta)}</div>
      </div>
      <span class="badge badge-${statusClass}">${statusLabel(data.status)}</span>
    </div>
    ${renderStatusStepper(data.status)}
    <div class="donation-card__actions">
      ${data.status === 'pending'
        ? `<button class="btn-cancel-inline" data-id="${esc(data.id)}">Kanselahin</button>`
        : ['scheduled', 'pickedUp', 'enRoute'].includes(data.status)
          ? `<span class="cancel-blocked-msg">Hindi na maaaring kanselahin.</span>`
          : ''}
    </div>`;

  card.querySelector('.btn-cancel-inline')?.addEventListener('click', () => {
    if (window.confirm('Kanselahin ang donation na ito?')) {
      card.remove();
      showToast('Na-cancel ang donation.', 'info');
      const count = document.getElementById('active-count');
      if (count) count.textContent = Math.max(0, Number(count.textContent) - 1);
    }
  });

  return card;
}

function renderStatusStepper(status) {
  if (status === 'cancelled') {
    return `<div class="card-stepper">
      <div class="cs-step cancelled"><div class="cs-dot">✕</div><div class="cs-label">Na-cancel</div></div>
    </div>`;
  }
  const stepIdx   = STATUS_STEP[status] ?? 0;
  const stepsHtml = STEPS.map((label, i) => {
    const cls = i < stepIdx ? 'done' : i === stepIdx ? 'active' : '';
    const dot = i < stepIdx ? '✓' : i + 1;
    return `<div class="cs-step ${cls}"><div class="cs-dot">${dot}</div><div class="cs-label">${label}</div></div>`;
  }).join('');
  return `<div class="card-stepper" role="list">${stepsHtml}</div>`;
}

// ── Completed / history ───────────────────────────────────────────────────────
function renderCompletedHistory() {
  const list = document.getElementById('completed-list');
  if (!list) return;
  list.innerHTML = '';

  MOCK_HISTORY.forEach(d => {
    const statusClass = d.status === 'verified' ? 'verified' : 'delivered';
    const item = document.createElement('div');
    item.className = `donation-card status-${statusClass}`;
    item.innerHTML = `
      <div class="donation-card__head">
        <div>
          <div class="donation-card__food">${esc(d.food)} · ${esc(d.qty)} kg</div>
          <div class="donation-card__meta">${esc(d.meta)}</div>
        </div>
        <span class="badge badge-${statusClass}">${statusLabel(d.status)}</span>
      </div>`;
    list.appendChild(item);
  });
}

function setupHistoryToggle() {
  const btn  = document.getElementById('history-toggle-btn');
  const list = document.getElementById('completed-list');
  if (!btn || !list) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    list.classList.toggle('open', !open);
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-kg',        `${MOCK_STATS.totalKg} kg`);
  set('stat-points',    MOCK_STATS.points);
  set('stat-verified',  MOCK_STATS.verified);
  set('stat-cancelled', MOCK_STATS.cancelled);

  const badge = document.getElementById('stat-badge');
  if (badge) { badge.textContent = '🟢 Maaasahan'; badge.className = 'reliability-chip high'; }

  const scoreEl = document.getElementById('stat-reliability');
  if (scoreEl) scoreEl.textContent = 30;
}

// ── Sign-out ──────────────────────────────────────────────────────────────────
function setupSignOut() {
  const modal      = document.getElementById('signout-modal');
  const btnOpen    = document.getElementById('btn-signout');
  const btnCancel  = document.getElementById('btn-cancel-signout');
  const btnConfirm = document.getElementById('btn-confirm-signout');

  btnOpen?.addEventListener('click',    () => { if (modal) modal.style.display = 'flex'; });
  btnCancel?.addEventListener('click',  () => { if (modal) modal.style.display = 'none'; });
  btnConfirm?.addEventListener('click', () => { window.location.href = '/register/index.html'; });
}

// ── Offline banner ────────────────────────────────────────────────────────────
function setupOnlineStatus() {
  const update = () => {
    document.body.classList.toggle('offline', !navigator.onLine);
    const ts = document.getElementById('offline-ts');
    if (ts && !navigator.onLine) ts.textContent = new Date().toLocaleTimeString('fil');
  };
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(status) {
  return { pending:'Naka-post', scheduled:'May Kumuha', pickedUp:'Nakuha na',
           enRoute:'En Route', delivered:'Naihatid', verified:'Verified', cancelled:'Na-cancel' }[status] ?? status;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
