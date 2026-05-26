import { auth, db } from '../core/firebaseConfig.js';
import { onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, updateDoc,
  arrayUnion, serverTimestamp, getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Constants ────────────────────────────────────────────────────────────────
const STEPS = ['Posted', 'Claimed', 'Picked Up', 'En Route', 'Delivered', 'Verified'];
const STATUS_STEP = {
  pending:   0,
  scheduled: 1,
  pickedUp:  2,
  enRoute:   3,
  delivered: 4,
  verified:  5,
  cancelled: -1,
};

let activeUnsubscribe = null;

// ── Boot ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '/register/index.html';
    return;
  }

  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (!userSnap.exists() || userSnap.data().role !== 'donor') {
    await signOut(auth);
    window.location.href = '/register/index.html';
    return;
  }

  const profile = userSnap.data();
  initDashboard(user, profile);
});

// ── Dashboard init ────────────────────────────────────────────────────────────
function initDashboard(user, profile) {
  setGreeting(profile.fullName);
  setKitchenAlert();
  handleActivationGate(profile.onboardingComplete);
  setupTabs(profile.onboardingComplete);
  renderKitchenBoard(user.uid);
  renderStats(user.uid, profile);
  setupSignOut(user);
  setupHistoryToggle();
  setupOnlineStatus();
}

// ── Greeting ─────────────────────────────────────────────────────────────────
function setGreeting(fullName) {
  const el = document.getElementById('greeting-name');
  if (!el) return;
  const first = fullName ? fullName.split(' ')[0] : 'Donor';
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

  if (hour >= 11 && hour < 13) {
    msg = '🍱 Oras na ng tanghalian! Mag-post ng natirang ulam bago lumamig.';
    cls = 'alert-warning';
  } else if (hour >= 17 && hour < 19) {
    msg = '🌅 Hapon na! I-post ang surplus bago mag-araw para makarating sa nangangailangan.';
    cls = 'alert-warning';
  } else if (hour >= 19) {
    msg = '🌙 Gabi na. Mag-ingat na mag-post ng madaling masira — suriin ang Time Guardrail.';
    cls = 'alert-info';
  } else if (hour >= 6 && hour < 9) {
    msg = '☀️ Maaga pa! Magandang oras para mag-post ng pandesal o almusal surplus.';
    cls = 'alert-success';
  }

  if (msg) {
    el.textContent = msg;
    el.className = `kitchen-alert ${cls}`;
    el.classList.remove('hidden');
  }
}

// ── Activation gate ───────────────────────────────────────────────────────────
function handleActivationGate(onboardingComplete) {
  const banner = document.getElementById('activation-banner');
  if (banner && !onboardingComplete) banner.classList.remove('hidden');
}

// ── Tab navigation ────────────────────────────────────────────────────────────
function setupTabs(onboardingComplete) {
  const tabs = document.querySelectorAll('.donor-tab');

  if (!onboardingComplete) {
    ['tab-history', 'tab-stats'].forEach(id => {
      const tab = document.getElementById(id);
      if (!tab) return;
      tab.classList.add('locked');
      const lock = tab.querySelector('.lock-badge');
      if (lock) lock.classList.remove('hidden');
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('locked')) return;

      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      ['board', 'history', 'stats'].forEach(name => {
        const panel = document.getElementById(`panel-${name}`);
        if (panel) {
          panel.classList.toggle('hidden', tab.dataset.tab !== name);
        }
      });
    });
  });
}

// ── Real-time kitchen board ───────────────────────────────────────────────────
export function renderKitchenBoard(uid) {
  if (activeUnsubscribe) activeUnsubscribe();

  const activeStatuses = ['pending', 'scheduled', 'pickedUp', 'enRoute', 'delivered'];
  const q = query(
    collection(db, 'donations'),
    where('donorId', '==', uid),
    where('status', 'in', activeStatuses),
    orderBy('createdAt', 'desc'),
  );

  // Remove skeleton loaders on first data
  let firstLoad = true;

  activeUnsubscribe = onSnapshot(q, (snapshot) => {
    if (firstLoad) {
      document.getElementById('skel-1')?.remove();
      document.getElementById('skel-2')?.remove();
      firstLoad = false;
    }

    const list  = document.getElementById('active-list');
    const count = document.getElementById('active-count');
    if (!list) return;

    list.innerHTML = '';

    if (snapshot.empty) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍱</div>
          <p>Wala pang aktibong donation.</p>
          <p class="text-xs mt-2">I-tap ang "Mag-post ng Surplus" para magsimula.</p>
        </div>`;
      if (count) count.textContent = '0';
      return;
    }

    if (count) count.textContent = snapshot.size;

    snapshot.forEach(docSnap => {
      const data = { donationId: docSnap.id, ...docSnap.data() };
      list.appendChild(buildDonationCard(data, uid));
    });
  }, (err) => {
    console.error('Snapshot error:', err);
    showToast('Hindi ma-load ang mga donation. Subukan muli.', 'error');
  });

  // Also load completed (last 5)
  loadCompletedDonations(uid);
}

function buildDonationCard(data, uid) {
  const card = document.createElement('div');
  const statusClass = data.status === 'pickedUp' ? 'picked-up'
    : data.status === 'enRoute' ? 'en-route'
    : data.status;
  card.className = `donation-card status-${statusClass}`;
  card.dataset.id = data.donationId;

  const windowStr = formatPickupWindow(data.pickupWindowStart, data.pickupWindowEnd);

  card.innerHTML = `
    <div class="donation-card__head">
      <div>
        <div class="donation-card__food">${esc(data.foodType)} · ${esc(String(data.quantityKg))} kg</div>
        <div class="donation-card__meta">${windowStr}</div>
      </div>
      <span class="badge badge-${statusClass}">${statusLabel(data.status)}</span>
    </div>
    ${renderStatusStepper(data.status)}
    <div class="donation-card__actions">
      ${buildCardActions(data)}
    </div>`;

  // Wire up cancel button
  const cancelBtn = card.querySelector('.btn-cancel-inline');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => cancelDonation(data.donationId, uid, card));
  }

  return card;
}

// ── Status stepper renderer ───────────────────────────────────────────────────
export function renderStatusStepper(status) {
  const stepIdx = STATUS_STEP[status] ?? 0;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return `<div class="card-stepper">
      <div class="cs-step cancelled">
        <div class="cs-dot">✕</div>
        <div class="cs-label">Na-cancel</div>
      </div>
    </div>`;
  }

  const stepsHtml = STEPS.map((label, i) => {
    let cls = '';
    if (i < stepIdx)      cls = 'done';
    else if (i === stepIdx) cls = 'active';
    const dot = i < stepIdx ? '✓' : i + 1;
    return `<div class="cs-step ${cls}">
      <div class="cs-dot">${dot}</div>
      <div class="cs-label">${label}</div>
    </div>`;
  }).join('');

  return `<div class="card-stepper" role="list" aria-label="Status ng donation">${stepsHtml}</div>`;
}

function buildCardActions(data) {
  if (data.status === 'pending') {
    return `<button class="btn-cancel-inline" data-id="${esc(data.donationId)}">
      Kanselahin
    </button>`;
  }
  if (['scheduled', 'pickedUp', 'enRoute'].includes(data.status)) {
    return `<span class="cancel-blocked-msg">
      Hindi na maaaring kanselahin. Makipag-ugnayan sa volunteer.
    </span>`;
  }
  return '';
}

// ── Cancel donation ───────────────────────────────────────────────────────────
export async function cancelDonation(donationId, uid, cardEl) {
  const confirmed = window.confirm(
    'Kanselahin ang donation na ito? Maaapektuhan ang iyong reliability score.'
  );
  if (!confirmed) return;

  try {
    const ref = doc(db, 'donations', donationId);
    await updateDoc(ref, {
      status: 'cancelled',
      statusHistory: arrayUnion({
        status:    'cancelled',
        timestamp: new Date().toISOString(),
        actorId:   uid,
        actorRole: 'donor',
      }),
      updatedAt: serverTimestamp(),
    });
    showToast('Na-cancel ang donation.', 'info');
    if (cardEl) {
      cardEl.classList.remove(...[...cardEl.classList].filter(c => c.startsWith('status-')));
      cardEl.classList.add('status-cancelled');
    }
  } catch (err) {
    console.error('Cancel error:', err);
    showToast('Hindi ma-cancel. Subukan muli.', 'error');
  }
}

// ── Load completed donations (last 5) ────────────────────────────────────────
async function loadCompletedDonations(uid) {
  const q = query(
    collection(db, 'donations'),
    where('donorId', '==', uid),
    where('status', 'in', ['verified', 'cancelled']),
    orderBy('createdAt', 'desc'),
    limit(5),
  );

  try {
    const snap = await getDocs(q);
    const list = document.getElementById('completed-list');
    if (!list) return;
    list.innerHTML = '';

    if (snap.empty) {
      list.innerHTML = '<p class="text-muted text-sm" style="padding:.75rem 0;">Wala pang natapos na donation.</p>';
      return;
    }

    snap.forEach(docSnap => {
      const data = { donationId: docSnap.id, ...docSnap.data() };
      const item = document.createElement('div');
      const statusClass = data.status === 'verified' ? 'verified' : 'cancelled';
      item.className = `donation-card status-${statusClass}`;
      item.innerHTML = `
        <div class="donation-card__head">
          <div>
            <div class="donation-card__food">${esc(data.foodType)} · ${esc(String(data.quantityKg))} kg</div>
            <div class="donation-card__meta">${formatDate(data.createdAt)}</div>
          </div>
          <span class="badge badge-${statusClass}">${statusLabel(data.status)}</span>
        </div>`;
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Completed load error:', err);
  }
}

// ── History toggle ────────────────────────────────────────────────────────────
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

// ── Stats panel ───────────────────────────────────────────────────────────────
async function renderStats(uid, profile) {
  const kgEl = document.getElementById('stat-kg');
  if (kgEl) kgEl.textContent = `${profile.totalDonatedKg ?? 0} kg`;
  const ptEl = document.getElementById('stat-points');
  if (ptEl) ptEl.textContent = profile.points ?? 0;

  const score = await calculateReliabilityScore(uid);
  const el    = document.getElementById('stat-reliability');
  const badge = document.getElementById('stat-badge');
  if (el) el.textContent = score;
  if (badge) {
    if (score >= 30) {
      badge.textContent = '🟢 Maaasahan';
      badge.className = 'reliability-chip high';
    } else if (score > 0) {
      badge.textContent = '⚪ Neutral';
      badge.className = 'reliability-chip neutral';
    } else {
      badge.textContent = '🔴 Baguhan';
      badge.className = 'reliability-chip low';
    }
  }

  // Count verified / cancelled
  try {
    const allQ = query(collection(db, 'donations'), where('donorId', '==', uid));
    const snap = await getDocs(allQ);
    let verified = 0, cancelled = 0;
    snap.forEach(d => {
      if (d.data().status === 'verified')  verified++;
      if (d.data().status === 'cancelled') cancelled++;
    });
    const vEl = document.getElementById('stat-verified');
    const cEl = document.getElementById('stat-cancelled');
    if (vEl) vEl.textContent = verified;
    if (cEl) cEl.textContent = cancelled;
  } catch (_) {}
}

// ── Reliability score calculation ─────────────────────────────────────────────
export async function calculateReliabilityScore(donorId) {
  try {
    const q    = query(collection(db, 'donations'), where('donorId', '==', donorId));
    const snap = await getDocs(q);
    let score  = 0;

    snap.forEach(d => {
      const { status, statusHistory } = d.data();
      if (status === 'verified') {
        score += 10;
      } else if (status === 'cancelled') {
        // -20 if cancelled after scheduled, else no penalty
        const wasScheduled = (statusHistory || []).some(h => h.status === 'scheduled');
        score += wasScheduled ? -20 : 0;
      } else if (status === 'pending') {
        // Check if pickup window expired
        const winEnd = d.data().pickupWindowEnd?.toDate?.();
        if (winEnd && winEnd < new Date()) score -= 5;
      }
    });

    return Math.max(score, 0);
  } catch (_) {
    return 0;
  }
}

// ── Sign-out ───────────────────────────────────────────────────────────────────
function setupSignOut(_user) {
  const modal      = document.getElementById('signout-modal');
  const btnOpen    = document.getElementById('btn-signout');
  const btnCancel  = document.getElementById('btn-cancel-signout');
  const btnConfirm = document.getElementById('btn-confirm-signout');

  btnOpen?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });
  btnCancel?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  btnConfirm?.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '/register/index.html';
  });
}

// ── Offline banner ────────────────────────────────────────────────────────────
function setupOnlineStatus() {
  function update() {
    document.body.classList.toggle('offline', !navigator.onLine);
    const ts = document.getElementById('offline-ts');
    if (ts && !navigator.onLine) ts.textContent = new Date().toLocaleTimeString('fil');
  }
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(status) {
  const map = {
    pending:   'Naka-post',
    scheduled: 'May Kumuha',
    pickedUp:  'Nakuha na',
    enRoute:   'En Route',
    delivered: 'Naihatid',
    verified:  'Verified',
    cancelled: 'Na-cancel',
  };
  return map[status] ?? status;
}

function formatPickupWindow(start, end) {
  if (!start || !end) return 'Walang window';
  const fmt = (ts) => {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('fil', { hour: '2-digit', minute: '2-digit' });
  };
  return `Pickup: ${fmt(start)} – ${fmt(end)}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fil', { month: 'short', day: 'numeric', year: 'numeric' });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
