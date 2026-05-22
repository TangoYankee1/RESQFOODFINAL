import { getCurrentUser } from './auth.js';
import {
  listOpenDonations,
  listActiveMissionsByVolunteer,
  listMissionHistoryByVolunteer,
  claimDonation,
  pickupDonation,
  enRouteDonation,
  deliveredDonation,
  getDonation,
  parseDonationQr,
  parseDeliveryQr,
  escapeHtml,
  formatDate,
} from './utils.js';
import { startScanner, stopScanner } from './qr-scanner.js';
import { toast, notifyLocal } from './notifications.js';

const SCAN_STAGES = [
  { key: 'picked-up', label: 'Scan at Pickup',   qrType: 'donation', preStatus: 'claimed',   fn: pickupDonation,    next: true  },
  { key: 'en-route',  label: 'Scan En-Route',     qrType: 'donation', preStatus: 'picked-up', fn: enRouteDonation,   next: true  },
  { key: 'delivered', label: 'Scan Delivery QR',  qrType: 'delivery', preStatus: 'en-route',  fn: deliveredDonation, next: false },
];

const STATUS_LABELS = {
  'claimed':   'Claimed',
  'picked-up': 'Picked Up',
  'en-route':  'En-Route',
  'delivered': 'Delivered',
  'completed': 'Completed',
  'verified':  'Verified',
};

let scannerVideo = null;
let scannerHandled = false;
let activeScanStage = 0;

export function initVolunteer() {
  const root = document.getElementById('view-volunteer');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '1';

  root.querySelector('#volunteer-refresh')?.addEventListener('click', () => {
    refreshMissionBoard();
    refreshActiveMissions();
    refreshHistory();
    refreshStats();
  });
  root.querySelector('#volunteer-start-scan')?.addEventListener('click', startVolunteerScanner);
  root.querySelector('#volunteer-stop-scan')?.addEventListener('click', stopVolunteerScanner);

  refreshMissionBoard();
  refreshActiveMissions();
  refreshHistory();
  refreshStats();
}

// ─── Mission Board (open, unclaimed) ────────────────────────────────────────

export async function refreshMissionBoard() {
  const listEl = document.getElementById('volunteer-missions');
  if (!listEl) return;

  listEl.innerHTML = '<li class="donation-card">Loading missions…</li>';

  try {
    const list = await listOpenDonations();
    if (!list.length) {
      listEl.innerHTML = '<li class="donation-card">No open missions right now.</li>';
      return;
    }
    listEl.innerHTML = list.map((d) => `
      <li class="donation-card">
        <div>
          <strong>${escapeHtml(d.food_type || 'Pickup')}</strong>
          <p class="donation-card__meta">${escapeHtml(d.pickup_address || '')}</p>
          <span class="donation-card__meta">${formatDate(d.expires_at || d.createdAt)}</span>
        </div>
        <button type="button" class="btn btn--primary" data-accept="${d.id}">Accept</button>
      </li>`).join('');

    listEl.querySelectorAll('[data-accept]').forEach((btn) => {
      btn.addEventListener('click', () => acceptMission(btn.dataset.accept));
    });
  } catch (err) {
    listEl.innerHTML = `<li class="donation-card">${escapeHtml(err.message)}</li>`;
    toast(err.message, 'error');
  }
}

async function acceptMission(id) {
  const user = getCurrentUser();
  try {
    await claimDonation(id, user.uid);
    toast('Mission accepted!', 'success');
    notifyLocal('ResQFood', 'You accepted a food rescue mission.');
    activeScanStage = 0;
    const stageLabelEl = document.getElementById('volunteer-scan-stage');
    if (stageLabelEl) stageLabelEl.textContent = SCAN_STAGES[0].label;
    await Promise.all([refreshMissionBoard(), refreshActiveMissions(), refreshStats()]);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ─── Active Missions ─────────────────────────────────────────────────────────

export async function refreshActiveMissions() {
  const listEl = document.getElementById('volunteer-active-list');
  if (!listEl) return;

  listEl.innerHTML = '<li class="donation-card">Loading…</li>';

  try {
    const user = getCurrentUser();
    const list = await listActiveMissionsByVolunteer(user.uid);

    if (!list.length) {
      listEl.innerHTML = '<li class="donation-card">No active missions. Accept one from the board below.</li>';
      return;
    }

    listEl.innerHTML = list.map((d) => {
      const statusLabel = STATUS_LABELS[d.status] || d.status;
      const badgeClass = d.status === 'en-route' ? 'badge--open' : 'badge--claimed';
      return `
        <li class="donation-card">
          <div>
            <strong>${escapeHtml(d.food_type || 'Pickup')}</strong>
            <p class="donation-card__meta">${escapeHtml(d.pickup_address || '')}</p>
            <span class="badge ${badgeClass}">${statusLabel}</span>
          </div>
          <a href="#/donations/${d.id}" class="btn btn--ghost" data-nav>Details</a>
        </li>`;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<li class="donation-card">${escapeHtml(err.message)}</li>`;
  }
}

// ─── Mission History ──────────────────────────────────────────────────────────

export async function refreshHistory() {
  const listEl = document.getElementById('volunteer-history-list');
  if (!listEl) return;

  listEl.innerHTML = '<li class="donation-card">Loading…</li>';

  try {
    const user = getCurrentUser();
    const list = await listMissionHistoryByVolunteer(user.uid);

    if (!list.length) {
      listEl.innerHTML = '<li class="donation-card">No completed missions yet.</li>';
      return;
    }

    listEl.innerHTML = list.map((d) => `
      <li class="donation-card">
        <div>
          <strong>${escapeHtml(d.food_type || 'Pickup')}</strong>
          <p class="donation-card__meta">${escapeHtml(d.pickup_address || '')}</p>
          <span class="donation-card__meta">${formatDate(d.completedAt || d.updatedAt)}</span>
        </div>
        <div>
          ${d.quantity ? `<span class="donation-card__meta">${escapeHtml(String(d.quantity))} ${escapeHtml(d.unit || 'kg')}</span>` : ''}
          <span class="badge badge--open">${STATUS_LABELS[d.status] || d.status}</span>
        </div>
      </li>`).join('');
  } catch (err) {
    listEl.innerHTML = `<li class="donation-card">${escapeHtml(err.message)}</li>`;
  }
}

// ─── Personal Stats ───────────────────────────────────────────────────────────

export async function refreshStats() {
  const statsEl = document.getElementById('volunteer-stats');
  if (!statsEl) return;

  try {
    const user = getCurrentUser();
    const history = await listMissionHistoryByVolunteer(user.uid);

    const totalMissions = history.length;
    const totalKg = history.reduce((sum, d) => {
      const qty = parseFloat(d.quantity);
      return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);

    statsEl.innerHTML = `
      <div class="stat-card">
        <strong>${totalMissions}</strong>
        <span>Missions completed</span>
      </div>
      <div class="stat-card">
        <strong>${totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)}</strong>
        <span>kg rescued</span>
      </div>`;
  } catch (err) {
    statsEl.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

// ─── QR Scanner (3-stage) ────────────────────────────────────────────────────

async function startVolunteerScanner() {
  const video = document.getElementById('volunteer-scanner-video');
  const canvas = document.getElementById('volunteer-scanner-canvas');
  const result = document.getElementById('volunteer-scan-result');
  const stageLabel = document.getElementById('volunteer-scan-stage');
  if (!video || !canvas) return;

  scannerVideo = video;
  scannerHandled = false;
  result?.classList.add('hidden');

  const stage = SCAN_STAGES[activeScanStage];
  if (stageLabel) stageLabel.textContent = stage.label;

  try {
    await startScanner(video, canvas, async (data) => {
      if (scannerHandled) return;

      // Parse QR based on expected type for this stage
      let donationId;
      if (stage.qrType === 'delivery') {
        const parsed = parseDeliveryQr(data);
        if (!parsed) {
          result?.classList.remove('hidden');
          result.textContent = 'Wrong QR type — ask the org admin to show the delivery QR.';
          return;
        }
        donationId = parsed.id;
      } else {
        donationId = parseDonationQr(data);
        if (!donationId) {
          result?.classList.remove('hidden');
          result.textContent = `Unrecognized QR: ${data}`;
          return;
        }
      }

      scannerHandled = true;
      stopVolunteerScanner();
      result?.classList.remove('hidden');

      try {
        const user = getCurrentUser();
        const donation = await getDonation(donationId);
        if (!donation) throw new Error('Donation not found.');
        if (donation.volunteerId !== user.uid) throw new Error('This QR belongs to a different volunteer\'s mission.');
        if (donation.status !== stage.preStatus) throw new Error(`Cannot scan here — donation status is "${donation.status}", expected "${stage.preStatus}".`);

        // For delivery stage, also validate the org matches
        if (stage.qrType === 'delivery') {
          const parsed = parseDeliveryQr(data);
          if (parsed.orgId !== donation.beneficiaryOrgId) throw new Error('This delivery QR is for a different organization.');
        }

        await stage.fn(donationId);

        const messages = {
          'picked-up': 'Pickup confirmed. Tap "Scan En-Route" when heading to delivery.',
          'en-route':  'En-route confirmed — the recipient has been notified. Tap "Scan Delivery QR" on arrival.',
          'delivered': 'Delivery confirmed. Mission complete!',
        };
        result.textContent = messages[stage.key] || `Status updated to ${stage.key}.`;
        toast(result.textContent, 'success');

        if (stage.key === 'en-route') {
          notifyLocal('ResQFood', 'Delivery en-route — the recipient org has been notified.');
        }

        if (stage.next) {
          activeScanStage = Math.min(activeScanStage + 1, SCAN_STAGES.length - 1);
          if (stageLabel) stageLabel.textContent = SCAN_STAGES[activeScanStage].label;
        } else {
          activeScanStage = 0;
          await Promise.all([refreshMissionBoard(), refreshActiveMissions(), refreshHistory(), refreshStats()]);
        }
      } catch (err) {
        result.textContent = err.message;
        toast(err.message, 'error');
        scannerHandled = false;
      }
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function stopVolunteerScanner() {
  const video = document.getElementById('volunteer-scanner-video');
  stopScanner(video || scannerVideo);
}

export function onVolunteerViewHidden() {
  stopVolunteerScanner();
}

export function onVolunteerViewShown() {
  refreshMissionBoard();
  refreshActiveMissions();
  refreshHistory();
  refreshStats();
}
