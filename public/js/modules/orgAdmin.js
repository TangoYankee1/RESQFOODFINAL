// Org Admin dashboard — mock data, no Firebase

const MOCK_ORG = {
  name: 'Lahug Soup Kitchen',
  mode: 'standard',
  status: 'active',
  coordinator: 'Ana',
  totalKgMonth: 42.5,
  totalDeliveries: 15,
  verifiedToday: 2,
};

const MOCK_INCOMING = [
  {
    id: 'DON-2026-0041',
    food: 'Kanin at Ulam',
    qty: 5.0,
    volunteer: 'Juan Dela Cruz',
    status: 'delivered',
    eta: 'Nakarating na',
  },
  {
    id: 'DON-2026-0042',
    food: 'Tinapay (assorted)',
    qty: 2.5,
    volunteer: 'Maria Santos',
    status: 'enRoute',
    eta: 'ETA: 4:30 PM',
  },
];

const MOCK_VERIFIED_TODAY = [
  {
    id: 'DON-2026-0039',
    food: 'Gulay (assorted)',
    qty: 3.0,
    volunteer: 'Pedro Lim',
    verifiedAt: '2:30 PM',
  },
  {
    id: 'DON-2026-0040',
    food: 'Tinapay',
    qty: 1.5,
    volunteer: 'Maria Santos',
    verifiedAt: '10:15 AM',
  },
];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderGreeting();
  renderStats();
  renderIncoming();
  renderVerifiedToday();
  bindTabs();
  bindSignOut();
  setupOnline();
  checkPendingStatus();
});

// ── Greeting ──────────────────────────────────────────────────────────────────
function renderGreeting() {
  setText('org-name', MOCK_ORG.name);
  setText('incoming-count', MOCK_INCOMING.length);

  const pill = document.getElementById('mode-pill');
  if (pill) {
    pill.textContent = MOCK_ORG.mode === 'standard'
      ? 'Standard Mode · QR'
      : 'Basic Mode · PIN';
  }

  const dot = document.getElementById('incoming-dot');
  if (dot) dot.style.display = MOCK_INCOMING.some(d => d.status === 'delivered') ? 'block' : 'none';
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  setText('stat-kg',         MOCK_ORG.totalKgMonth);
  setText('stat-deliveries', MOCK_ORG.totalDeliveries);
  setText('stat-today',      MOCK_ORG.verifiedToday);
}

// ── Incoming deliveries ───────────────────────────────────────────────────────
function renderIncoming() {
  const container = document.getElementById('panel-incoming');
  if (!container) return;

  if (!MOCK_INCOMING.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📭</span>
      <p>Walang paparating na delivery ngayon.</p>
    </div>`;
    return;
  }

  const delivered = MOCK_INCOMING.filter(d => d.status === 'delivered');
  const enroute   = MOCK_INCOMING.filter(d => d.status === 'enRoute');

  let html = '';

  if (delivered.length) {
    html += `<div class="section-head"><span class="pulse-dot"></span> NAKARATING NA — I-verify</div>`;
    html += delivered.map(deliveryCard).join('');
  }

  if (enroute.length) {
    html += `<div class="section-head">PAPARATING (EN ROUTE)</div>`;
    html += enroute.map(deliveryCard).join('');
  }

  container.innerHTML = html;

  container.querySelectorAll('.btn-verify-delivery').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `verify.html?id=${encodeURIComponent(btn.dataset.id)}`;
    });
  });
}

function deliveryCard(d) {
  const isDelivered = d.status === 'delivered';
  const statusCls   = isDelivered ? 'delivered' : 'enroute';
  const statusText  = isDelivered ? '✅ Nakarating na' : '🛵 En Route';
  const cardCls     = isDelivered ? 'status-delivered' : 'status-enroute';

  return `
    <div class="delivery-card ${cardCls}">
      <div class="dc-top">
        <div>
          <div class="dc-food">${esc(d.food)}</div>
          <div class="dc-qty">${d.qty} kg</div>
        </div>
        <span class="dc-status ${statusCls}">${statusText}</span>
      </div>
      <div class="dc-meta">
        <span>👤 ${esc(d.volunteer)}</span>
        <span>⏰ ${esc(d.eta)}</span>
      </div>
      <div class="dc-actions">
        ${isDelivered
          ? `<button class="btn btn-primary btn-full btn-verify-delivery" data-id="${esc(d.id)}">
               ✅ I-verify ang Pagtanggap
             </button>`
          : `<button class="btn btn-ghost btn-full" disabled style="opacity:.5;">
               Naghihintay pa...
             </button>`
        }
      </div>
    </div>`;
}

// ── Verified today ────────────────────────────────────────────────────────────
function renderVerifiedToday() {
  const container = document.getElementById('panel-verified');
  if (!container) return;

  if (!MOCK_VERIFIED_TODAY.length) {
    container.innerHTML = `<div class="empty-state">
      <span class="empty-icon">📋</span>
      <p>Wala pang na-verify ngayon.</p>
    </div>`;
    return;
  }

  container.innerHTML = `
    <div class="section-head">NA-VERIFY NGAYON — ${MOCK_VERIFIED_TODAY.length} delivery</div>
    ${MOCK_VERIFIED_TODAY.map(v => `
      <div class="verified-card">
        <span class="vc-check">✅</span>
        <div class="vc-info">
          <div class="vc-food">${esc(v.food)} · ${v.qty} kg</div>
          <div class="vc-meta">👤 ${esc(v.volunteer)}</div>
        </div>
        <div class="vc-time">${esc(v.verifiedAt)}</div>
      </div>`).join('')}`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function bindTabs() {
  const tabs = [
    { btn: 'tab-incoming', panel: 'panel-incoming' },
    { btn: 'tab-verified', panel: 'panel-verified' },
    { btn: 'tab-history',  panel: 'panel-history'  },
  ];

  tabs.forEach(({ btn, panel }) => {
    document.getElementById(btn)?.addEventListener('click', () => {
      tabs.forEach(t => {
        document.getElementById(t.btn)?.classList.remove('active');
        document.getElementById(t.panel)?.classList.add('hidden');
      });
      document.getElementById(btn)?.classList.add('active');
      document.getElementById(panel)?.classList.remove('hidden');
    });
  });
}

// ── Pending status check ──────────────────────────────────────────────────────
function checkPendingStatus() {
  if (MOCK_ORG.status === 'pending_training') {
    document.getElementById('pending-banner')?.classList.remove('hidden');
  }
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

function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
