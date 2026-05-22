import { getProfile } from '../auth.js';
import { listDonationsByDonor } from '../db.js';
import { initLguAdmin } from '../lgu-admin.js';
import { initOrgAdmin } from '../org-admin.js';
import { initVolunteer } from '../volunteer.js';

export async function renderDashboard(root) {
  const profile = getProfile();
  if (!profile) return;

  // Role-specific full dashboards
  if (profile.role === 'Volunteer') {
    renderVolunteerDashboard(root, profile);
    return;
  }
  if (profile.role === 'Beneficiary') {
    renderBeneficiaryDashboard(root, profile);
    return;
  }

  root.innerHTML = `<section class="container dashboard"><div class="app-loading">Loading dashboard…</div></section>`;

  let donationsHtml = '';
  try {
    if (profile.role === 'Donor') {
      const list = await listDonationsByDonor(profile.id);
      donationsHtml = renderDonationList(list, true, 'Your donations');
    }
  } catch (err) {
    donationsHtml = `<div class="alert alert--error">${err.message}. Ensure Firestore indexes are deployed.</div>`;
  }

  const actions = roleActions(profile.role);

  root.innerHTML = `
    <section class="container dashboard">
      <div class="dashboard__header">
        <div>
          <h1>Hello, ${escapeHtml(profile.name || 'there')}</h1>
          <p>Role: ${escapeHtml(profile.role)}</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${actions}
        </div>
      </div>
      ${donationsHtml || lguAdminHtml(profile.role)}
    </section>
  `;

  if (profile.role === 'Admin' || profile.role === 'LGU Personnel') {
    initLguAdmin();
  }
}

function renderBeneficiaryDashboard(root, profile) {
  root.innerHTML = `
    <section class="container dashboard">
      <div class="dashboard__header">
        <div>
          <h1>Hello, ${escapeHtml(profile.name || 'there')}</h1>
          <p>Role: Beneficiary</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn--ghost" id="org-refresh">Refresh</button>
        </div>
      </div>

      <div id="view-org-admin">
        <!-- Delivery QR panel (shown when volunteer arrives) -->
        <div id="org-delivery-qr-panel" class="qr-panel hidden">
          <p id="org-delivery-qr-meta" class="donation-card__meta"></p>
          <div id="org-delivery-qrcode"></div>
          <button type="button" class="btn btn--ghost" id="org-close-qr" style="margin-top:0.75rem;">Close</button>
        </div>

        <!-- Pending verifications -->
        <h2>Incoming deliveries</h2>
        <ul id="org-pending-list" class="donation-list">
          <li class="donation-card">Loading…</li>
        </ul>

        <!-- Verify scanner -->
        <h2>Verify receipt</h2>
        <p class="donation-card__meta">Scan the delivery QR after the volunteer hands over the food.</p>
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button type="button" class="btn btn--primary" id="org-start-verify">Start camera</button>
          <button type="button" class="btn btn--ghost" id="org-stop-verify">Stop camera</button>
        </div>
        <div class="scanner-wrap">
          <video id="org-scanner-video" playsinline muted aria-label="Camera preview"></video>
          <canvas id="org-scanner-canvas"></canvas>
        </div>
        <div id="org-scan-result" class="scan-result hidden"></div>
      </div>
    </section>
  `;

  initOrgAdmin();
}

function renderVolunteerDashboard(root, profile) {
  root.innerHTML = `
    <section class="container dashboard">
      <div class="dashboard__header">
        <div>
          <h1>Hello, ${escapeHtml(profile.name || 'there')}</h1>
          <p>Role: Volunteer</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn--ghost" id="volunteer-refresh">Refresh</button>
        </div>
      </div>

      <div id="view-volunteer">
        <!-- Personal stats -->
        <h2>Your stats</h2>
        <div id="volunteer-stats" class="stats-row">
          <div class="stat-card"><strong>—</strong><span>Missions completed</span></div>
          <div class="stat-card"><strong>—</strong><span>kg rescued</span></div>
        </div>

        <!-- Active missions -->
        <h2>Active missions</h2>
        <ul id="volunteer-active-list" class="donation-list">
          <li class="donation-card">Loading…</li>
        </ul>

        <!-- QR Scanner -->
        <h2>Scan QR code</h2>
        <p class="donation-card__meta">Current stage: <strong id="volunteer-scan-stage">Scan at Pickup</strong></p>
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button type="button" class="btn btn--primary" id="volunteer-start-scan">Start camera</button>
          <button type="button" class="btn btn--ghost" id="volunteer-stop-scan">Stop camera</button>
        </div>
        <div class="scanner-wrap">
          <video id="volunteer-scanner-video" playsinline muted aria-label="Camera preview"></video>
          <canvas id="volunteer-scanner-canvas"></canvas>
        </div>
        <div id="volunteer-scan-result" class="scan-result hidden"></div>

        <!-- Mission board -->
        <h2>Mission board <span class="donation-card__meta">(available pickups)</span></h2>
        <ul id="volunteer-missions" class="donation-list">
          <li class="donation-card">Loading…</li>
        </ul>

        <!-- Mission history -->
        <h2>Mission history</h2>
        <ul id="volunteer-history-list" class="donation-list">
          <li class="donation-card">Loading…</li>
        </ul>
      </div>
    </section>
  `;

  initVolunteer();
}

function roleActions(role) {
  const links = [];
  if (role === 'Donor') {
    links.push('<a href="#/donations/new" class="btn btn--primary" data-nav>New donation</a>');
  }
  return links.join('');
}

function renderDonationList(list, isDonor, heading = '') {
  const headingHtml = heading ? `<h2>${heading}</h2>` : '';
  if (!list.length) return `${headingHtml}<p>No donations yet.</p>`;
  return `${headingHtml}<ul class="donation-list">${list
    .map(
      (d) => `
    <li class="donation-card">
      <div>
        <strong>${escapeHtml(d.food_type || 'Donation')}</strong>
        <p class="donation-card__meta">${escapeHtml(d.description || '')}</p>
        <span class="badge badge--${d.status === 'open' ? 'open' : 'claimed'}">${d.status}</span>
      </div>
      <div>
        ${isDonor ? `<a href="#/donations/${d.id}" class="btn btn--ghost" data-nav>View / QR</a>` : `<a href="#/donations/${d.id}" class="btn btn--primary" data-nav>View</a>`}
      </div>
    </li>`
    )
    .join('')}</ul>`;
}

function lguAdminHtml(role) {
  if (role === 'Admin' || role === 'LGU Personnel') {
    return `
      <div id="view-lgu-admin">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;">
          <h2 style="margin:0;">LGU Dashboard</h2>
          <button type="button" class="btn btn--ghost" id="lgu-refresh">Refresh</button>
        </div>
        <div id="lgu-stats" class="stats-row"></div>
        <h3>All Users</h3>
        <div id="lgu-admin-tools" class="hidden"></div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody id="lgu-users-body"><tr><td colspan="4">Loading…</td></tr></tbody>
          </table>
        </div>
        <h3>Reports</h3>
        <div id="lgu-chart"></div>
      </div>`;
  }
  return '<p>No listings yet. Check back soon.</p>';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
