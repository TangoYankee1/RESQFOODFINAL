import { getCurrentUser, getProfile } from './auth.js';
import {
  createDonation,
  listDonationsByDonor,
  getDonation,
  donationQrPayload,
  escapeHtml,
  formatDate,
} from './utils.js';
import { renderQrCode } from './qr-generate.js';
import { toast } from './notifications.js';

let selectedDonationId = null;

export function initDonor() {
  const root = document.getElementById('view-donor');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '1';

  root.querySelector('#donor-form')?.addEventListener('submit', onCreateDonation);
  root.querySelector('#donor-refresh')?.addEventListener('click', refreshDonorList);
  root.querySelector('#donor-close-qr')?.addEventListener('click', () => {
    root.querySelector('#donor-qr-panel')?.classList.add('hidden');
  });

  refreshDonorList();
}

export async function refreshDonorList() {
  const user = getCurrentUser();
  const listEl = document.getElementById('donor-donation-list');
  if (!user || !listEl) return;

  listEl.innerHTML = '<li class="donation-card">Loading…</li>';

  try {
    const list = await listDonationsByDonor(user.uid);
    if (!list.length) {
      listEl.innerHTML = '<li class="donation-card">No donations yet. Post your first surplus food listing.</li>';
      return;
    }
    listEl.innerHTML = list
      .map(
        (d) => `
      <li class="donation-card">
        <div>
          <strong>${escapeHtml(d.food_type || 'Donation')}</strong>
          <p class="donation-card__meta">${escapeHtml(d.description || '')}</p>
          <span class="badge badge--${d.status === 'open' ? 'open' : 'claimed'}">${escapeHtml(d.status)}</span>
          <span class="donation-card__meta">${formatDate(d.createdAt)}</span>
        </div>
        <button type="button" class="btn btn--ghost" data-show-qr="${d.id}">Show QR</button>
      </li>`
      )
      .join('');

    listEl.querySelectorAll('[data-show-qr]').forEach((btn) => {
      btn.addEventListener('click', () => showDonorQr(btn.dataset.showQr));
    });
  } catch (err) {
    listEl.innerHTML = `<li class="donation-card">${escapeHtml(err.message)}</li>`;
    toast(err.message, 'error');
  }
}

async function onCreateDonation(e) {
  e.preventDefault();
  const user = getCurrentUser();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const id = await createDonation(user.uid, data);
    form.reset();
    toast('Donation posted.', 'success');
    await refreshDonorList();
    showDonorQr(id);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function showDonorQr(id) {
  const panel = document.getElementById('donor-qr-panel');
  const container = document.getElementById('donor-qrcode');
  const meta = document.getElementById('donor-qr-meta');
  if (!panel || !container) return;

  const donation = await getDonation(id);
  selectedDonationId = id;
  meta.textContent = donation
    ? `${donation.food_type || 'Donation'} — scan at pickup`
    : `Donation ${id}`;
  panel.classList.remove('hidden');
  const user = getCurrentUser();
  await renderQrCode(container, donationQrPayload(id, user?.uid));
}

export function onDonorViewShown() {
  const profile = getProfile();
  const nameEl = document.getElementById('donor-greeting');
  if (nameEl && profile) nameEl.textContent = profile.name || 'Donor';
  refreshDonorList();
}
