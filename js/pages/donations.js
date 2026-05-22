import { getCurrentUser, getProfile } from '../auth.js';
import { createDonation, getDonation, claimDonation, completeDonation, donationQrPayload, listBeneficiaryOrgs } from '../db.js';
import { renderQrCode } from '../qr-generate.js';
import { navigate } from '../router.js';

export async function renderNewDonation(root) {
  const profile = getProfile();
  const user = getCurrentUser();
  if (!user || profile?.role !== 'Donor') {
    navigate('/dashboard');
    return;
  }

  let orgs = [];
  try {
    orgs = await listBeneficiaryOrgs();
  } catch {
    // non-fatal — show empty dropdown with fallback message
  }

  const orgOptions = orgs.length
    ? orgs.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.organization_name || o.name || o.email)}</option>`).join('')
    : '<option value="" disabled>No registered organizations yet</option>';

  root.innerHTML = `
    <section class="container dashboard">
      <div class="form-card">
        <h1>New donation</h1>
        <div id="donation-error" class="alert alert--error hidden"></div>
        <form id="donation-form">
          <div class="form-group">
            <label for="food_type">Food type</label>
            <input id="food_type" name="food_type" required />
          </div>
          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" name="description" rows="3"></textarea>
          </div>
          <div class="form-row form-row--2">
            <div class="form-group">
              <label for="quantity">Quantity</label>
              <input id="quantity" name="quantity" type="number" min="0" step="any" />
            </div>
            <div class="form-group">
              <label for="unit">Unit</label>
              <input id="unit" name="unit" placeholder="kg, trays, boxes" />
            </div>
          </div>
          <div class="form-group">
            <label for="expires_at">Best before / expiry</label>
            <input id="expires_at" name="expires_at" type="datetime-local" />
          </div>
          <div class="form-group">
            <label for="pickup_address">Pickup address</label>
            <input id="pickup_address" name="pickup_address" required />
          </div>
          <div class="form-group">
            <label for="beneficiaryOrgId">Beneficiary organization</label>
            <select id="beneficiaryOrgId" name="beneficiaryOrgId" required>
              <option value="">Select an organization…</option>
              ${orgOptions}
            </select>
          </div>
          <button type="submit" class="btn btn--primary btn--block">Create donation</button>
        </form>
      </div>
    </section>
  `;

  root.querySelector('#donation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = root.querySelector('#donation-error');
    errEl.classList.add('hidden');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    try {
      const id = await createDonation(user.uid, data);
      navigate(`/donations/${id}`);
    } catch (err) {
      errEl.textContent = err.message || 'Failed to create donation.';
      errEl.classList.remove('hidden');
    }
  });
}

export async function renderDonationDetail(root, params) {
  const { id } = params;
  const profile = getProfile();
  const user = getCurrentUser();
  const donation = await getDonation(id);

  if (!donation) {
    root.innerHTML = '<section class="container dashboard"><p>Donation not found.</p></section>';
    return;
  }

  const canClaim =
    profile?.role === 'Volunteer' && donation.status === 'open';
  const canComplete =
    profile?.role === 'Volunteer' && donation.volunteerId === user?.uid;

  root.innerHTML = `
    <section class="container dashboard">
      <h1>${escapeHtml(donation.food_type || 'Donation')}</h1>
      <p><span class="badge badge--${donation.status === 'open' ? 'open' : 'claimed'}">${donation.status}</span></p>
      <p>${escapeHtml(donation.description || '')}</p>
      <p class="donation-card__meta">Pickup: ${escapeHtml(donation.pickup_address || '—')}</p>
      <div id="donation-actions" style="margin:1.5rem 0;display:flex;gap:0.5rem;flex-wrap:wrap;"></div>
      <div class="qr-panel">
        <h2>Pickup QR code</h2>
        ${profile?.role === 'Donor'
          ? '<p class="donation-card__meta">Show this to the volunteer at pickup.</p><div id="qrcode"></div>'
          : '<p class="donation-card__meta">Ask the donor to show you the QR code at pickup.</p>'}
      </div>
      <p style="margin-top:2rem;"><a href="#/dashboard" data-nav>← Back to dashboard</a></p>
    </section>
  `;

  const actions = root.querySelector('#donation-actions');
  if (canClaim) {
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary';
    btn.textContent = 'Claim pickup';
    btn.addEventListener('click', async () => {
      await claimDonation(id, user.uid);
      navigate(`/donations/${id}`);
    });
    actions.appendChild(btn);
  }
  if (canComplete && donation.status === 'claimed') {
    const btn = document.createElement('button');
    btn.className = 'btn btn--outline';
    btn.textContent = 'Mark completed';
    btn.addEventListener('click', async () => {
      await completeDonation(id);
      navigate('/dashboard');
    });
    actions.appendChild(btn);
  }

  if (profile?.role === 'Donor') {
    await renderQrCode(root.querySelector('#qrcode'), donationQrPayload(id, user?.uid));
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
