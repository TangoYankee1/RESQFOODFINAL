import { getCurrentUser } from './auth.js';
import {
  listDonationsByStatusForOrg,
  verifyDonationHandoff,
  getDonation,
  parseDeliveryQr,
  deliveryQrPayload,
  escapeHtml,
  formatDate,
} from './utils.js';
import { startScanner, stopScanner } from './qr-scanner.js';
import { renderQrCode } from './qr-generate.js';
import { toast } from './notifications.js';

let verifyHandled = false;

export function initOrgAdmin() {
  const root = document.getElementById('view-org-admin');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '1';

  root.querySelector('#org-refresh')?.addEventListener('click', refreshPending);
  root.querySelector('#org-start-verify')?.addEventListener('click', startVerifyScanner);
  root.querySelector('#org-stop-verify')?.addEventListener('click', stopVerifyScanner);
  root.querySelector('#org-close-qr')?.addEventListener('click', () => {
    document.getElementById('org-delivery-qr-panel')?.classList.add('hidden');
  });

  refreshPending();
}

export async function refreshPending() {
  const listEl = document.getElementById('org-pending-list');
  if (!listEl) return;

  listEl.innerHTML = '<li class="donation-card">Loading…</li>';

  try {
    const user = getCurrentUser();
    const [claimed, completed] = await Promise.all([
      listDonationsByStatusForOrg('claimed', user.uid),
      listDonationsByStatusForOrg('completed', user.uid),
    ]);
    const pending = [...claimed, ...completed.filter((d) => d.status !== 'verified')];

    if (!pending.length) {
      listEl.innerHTML = '<li class="donation-card">No pickups awaiting verification.</li>';
      return;
    }

    listEl.innerHTML = pending
      .map(
        (d) => `
      <li class="donation-card">
        <div>
          <strong>${escapeHtml(d.food_type || 'Donation')}</strong>
          <p class="donation-card__meta">${escapeHtml(d.pickup_address || '')}</p>
          <span class="badge badge--claimed">${escapeHtml(d.status)}</span>
          <span class="donation-card__meta">${formatDate(d.claimedAt || d.createdAt)}</span>
        </div>
        ${d.status === 'en-route' || d.status === 'completed'
          ? `<button type="button" class="btn btn--primary" data-show-delivery-qr="${d.id}">Show QR</button>`
          : ''}
      </li>`
      )
      .join('');

    listEl.querySelectorAll('[data-show-delivery-qr]').forEach((btn) => {
      btn.addEventListener('click', () => showDeliveryQr(btn.dataset.showDeliveryQr));
    });
  } catch (err) {
    listEl.innerHTML = `<li class="donation-card">${escapeHtml(err.message)}</li>`;
  }
}

async function showDeliveryQr(donationId) {
  const user = getCurrentUser();
  const panel = document.getElementById('org-delivery-qr-panel');
  const container = document.getElementById('org-delivery-qrcode');
  const meta = document.getElementById('org-delivery-qr-meta');
  if (!panel || !container) return;

  const donation = await getDonation(donationId);
  if (meta) meta.textContent = donation ? `${donation.food_type || 'Donation'} — show to volunteer on arrival` : donationId;
  panel.classList.remove('hidden');
  await renderQrCode(container, deliveryQrPayload(donationId, user.uid));
}

async function startVerifyScanner() {
  const video = document.getElementById('org-scanner-video');
  const canvas = document.getElementById('org-scanner-canvas');
  const result = document.getElementById('org-scan-result');
  if (!video || !canvas) return;

  verifyHandled = false;
  result?.classList.add('hidden');

  try {
    await startScanner(video, canvas, async (data) => {
      if (verifyHandled) return;
      const parsed = parseDeliveryQr(data);
      if (!parsed) {
        result?.classList.remove('hidden');
        result.textContent = 'Unrecognized QR — scan the delivery QR shown per incoming item.';
        return;
      }
      verifyHandled = true;
      stopVerifyScanner();
      const user = getCurrentUser();
      try {
        const donation = await getDonation(parsed.id);
        if (!donation) throw new Error('Donation not found.');
        if (parsed.orgId !== user.uid) throw new Error('This delivery QR is for a different organization.');
        if (donation.status !== 'completed') throw new Error(`Cannot verify: donation status is "${donation.status}", expected "completed".`);
        await verifyDonationHandoff(parsed.id, user.uid);
        result?.classList.remove('hidden');
        result.textContent = `Verified handoff: ${donation.food_type || parsed.id}`;
        toast('Pickup verified.', 'success');
        refreshPending();
      } catch (err) {
        verifyHandled = false;
        result?.classList.remove('hidden');
        result.textContent = err.message;
        toast(err.message, 'error');
      }
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

function stopVerifyScanner() {
  stopScanner(document.getElementById('org-scanner-video'));
}

export function onOrgAdminViewHidden() {
  stopVerifyScanner();
}

export function onOrgAdminViewShown() {
  refreshPending();
}
