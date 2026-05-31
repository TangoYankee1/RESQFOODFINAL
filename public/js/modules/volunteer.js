// Volunteer mission board — mock data, no Firebase

const MOCK_VOL = { nickname: 'Juan', totalKg: 8.5, missions: 3, points: 120 };

const MOCK_AVAILABLE = [
  {
    id: 'M001',
    food: 'Kanin at Ulam',
    qty: '3.5',
    barangay: 'Lahug',
    donor: "Maria's Eatery",
    reliability: 'high',
    window: 'Ngayon, 2:00 PM – 4:00 PM',
    urgent: true,
    address: 'Corner Gorordo Ave, Lahug, Cebu City',
    contact: 'Maria Santos · +639171234567',
  },
  {
    id: 'M002',
    food: 'Tinapay (assorted)',
    qty: '1.2',
    barangay: 'Mabolo',
    donor: 'Tindahan ni Aling Nena',
    reliability: 'neutral',
    window: 'Bukas, 8:00 AM – 10:00 AM',
    urgent: false,
    address: 'Mabolo cor. Juan Luna Ave',
    contact: 'Nena Cruz · +639189876543',
  },
  {
    id: 'M003',
    food: 'Gulay (assorted)',
    qty: '4.0',
    barangay: 'Banilad',
    donor: 'Kusina ni Ate Belen',
    reliability: 'high',
    window: 'Bukas, 11:00 AM – 1:00 PM',
    urgent: false,
    address: 'Banilad Road, Cebu City',
    contact: 'Belen Reyes · +639201112233',
  },
];

const MOCK_MY_MISSIONS = [
  {
    id: 'M004',
    food: 'Tinapa',
    qty: '2.0',
    barangay: 'Apas',
    status: 'scheduled',
    window: 'Ngayon, 3:30 PM – 5:00 PM',
    address: 'Apas, Cebu City',
    contact: 'Pedro Lim · +639154445566',
  },
];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderGreeting();
  renderStats();
  renderAvailableMissions();
  renderMyMissions();
  bindTabs();
  bindSignOut();
  setupOnline();
});

// ── Greeting ──────────────────────────────────────────────────────────────────
function renderGreeting() {
  const el = document.getElementById('vol-greeting-name');
  if (el) el.textContent = MOCK_VOL.nickname;
  const ac = document.getElementById('active-count');
  if (ac) ac.textContent = MOCK_MY_MISSIONS.length;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  setText('stat-kg',       MOCK_VOL.totalKg);
  setText('stat-missions', MOCK_VOL.missions);
  setText('stat-points',   MOCK_VOL.points);
}

// ── Available missions ────────────────────────────────────────────────────────
function renderAvailableMissions() {
  const container = document.getElementById('panel-available');
  if (!container) return;

  const urgent  = MOCK_AVAILABLE.filter(m => m.urgent);
  const regular = MOCK_AVAILABLE.filter(m => !m.urgent);

  let html = '';

  if (urgent.length) {
    html += `<div class="section-head"><span class="urgent-dot"></span> URGENT — Malapit na ang pickup window</div>`;
    html += urgent.map(missionCard).join('');
  }

  if (regular.length) {
    html += `<div class="section-head">AVAILABLE MISSIONS</div>`;
    html += regular.map(missionCard).join('');
  }

  if (!MOCK_AVAILABLE.length) {
    html = `<div class="empty-state"><span class="empty-icon">📭</span>Walang available missions ngayon.</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.btn-accept').forEach(btn => {
    btn.addEventListener('click', () => acceptMission(btn.dataset.id));
  });
}

function missionCard(m) {
  const rel = reliabilityChip(m.reliability);
  const urgencyClass = m.urgent ? 'urgency-high' : 'urgency-normal';
  const urgencyText  = m.urgent ? '🔴 URGENT' : '✅ Available';
  const cardClass    = m.urgent ? 'urgent' : 'regular';

  return `
    <div class="mission-card ${cardClass}" data-id="${m.id}">
      <div class="mc-top">
        <div>
          <div class="mc-food">${esc(m.food)}</div>
          <div class="mc-qty">${esc(m.qty)} kg</div>
        </div>
        <span class="mc-urgency ${urgencyClass}">${urgencyText}</span>
      </div>
      <div class="mc-meta">
        <span>📍 ${esc(m.barangay)}</span>
        <span>🏪 ${esc(m.donor)}</span>
      </div>
      ${rel}
      <div class="mc-window">⏰ <strong>${esc(m.window)}</strong></div>
      <button class="btn btn-primary btn-full btn-accept" data-id="${m.id}">
        Tanggapin ang Mission →
      </button>
    </div>`;
}

function reliabilityChip(level) {
  const map = {
    high:    { cls: 'rel-high',    text: '🟢 Maaasahan' },
    neutral: { cls: 'rel-neutral', text: '⚪ Baguhan donor' },
    new:     { cls: 'rel-new',     text: '🔴 Bago pa lang' },
  };
  const r = map[level] || map.neutral;
  return `<div class="mc-reliability ${r.cls}">${r.text}</div>`;
}

// ── Accept mission ─────────────────────────────────────────────────────────────
function acceptMission(id) {
  const mission = MOCK_AVAILABLE.find(m => m.id === id);
  if (!mission) return;
  sessionStorage.setItem('active_mission', JSON.stringify(mission));
  window.location.href = 'active-mission.html';
}

// ── My missions ───────────────────────────────────────────────────────────────
function renderMyMissions() {
  const container = document.getElementById('panel-my');
  if (!container) return;

  if (!MOCK_MY_MISSIONS.length) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span>Wala ka pang active mission. Pumili mula sa available list.</div>`;
    return;
  }

  container.innerHTML = MOCK_MY_MISSIONS.map(m => `
    <div class="mission-card regular" data-id="${m.id}">
      <div class="mc-top">
        <div>
          <div class="mc-food">${esc(m.food)}</div>
          <div class="mc-qty">${esc(m.qty)} kg · ${esc(m.barangay)}</div>
        </div>
        <span class="mc-urgency urgency-normal">${statusLabel(m.status)}</span>
      </div>
      <div class="mc-window">⏰ <strong>${esc(m.window)}</strong></div>
      <a class="btn btn-primary btn-full" href="active-mission.html"
         onclick="sessionStorage.setItem('active_mission', JSON.stringify(${JSON.stringify(m).replace(/"/g, '&quot;')}))">
        Tingnan ang Mission →
      </a>
    </div>`).join('');
}

function statusLabel(s) {
  return { scheduled: '📅 Scheduled', pickedUp: '📦 Picked Up', enRoute: '🛵 En Route', delivered: '✅ Delivered' }[s] || s;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function bindTabs() {
  const tabs = [
    { btn: 'tab-available', panel: 'panel-available' },
    { btn: 'tab-my',        panel: 'panel-my' },
    { btn: 'tab-history',   panel: 'panel-history' },
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

// ── Sign out ──────────────────────────────────────────────────────────────────
function bindSignOut() {
  document.getElementById('btn-signout')?.addEventListener('click', () => {
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
