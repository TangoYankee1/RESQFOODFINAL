import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase-config.js';
import { getProfile, hasRole } from './auth.js';
import { listDonationsByStatus, escapeHtml, formatDate } from './utils.js';
import { toast } from './notifications.js';

export function initLguAdmin() {
  const root = document.getElementById('view-lgu-admin');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '1';

  root.querySelector('#lgu-refresh')?.addEventListener('click', refreshLguDashboard);
  refreshLguDashboard();
}

export async function refreshLguDashboard() {
  await Promise.all([refreshStats(), refreshUsers(), refreshReports()]);
}

async function refreshStats() {
  const statsEl = document.getElementById('lgu-stats');
  if (!statsEl) return;

  try {
    const [open, claimed, completed] = await Promise.all([
      listDonationsByStatus('open'),
      listDonationsByStatus('claimed'),
      listDonationsByStatus('completed'),
    ]);
    statsEl.innerHTML = `
      <div class="stat-card"><strong>${open.length}</strong><span>Open listings</span></div>
      <div class="stat-card"><strong>${claimed.length}</strong><span>In progress</span></div>
      <div class="stat-card"><strong>${completed.length}</strong><span>Completed</span></div>
    `;
  } catch (err) {
    statsEl.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

async function refreshUsers() {
  const table = document.getElementById('lgu-users-body');
  const adminOnly = document.getElementById('lgu-admin-tools');
  if (!table) return;

  if (adminOnly) {
    adminOnly.classList.toggle('hidden', !hasRole('Admin'));
  }

  table.innerHTML = '<tr><td colspan="4">Loading users…</td></tr>';

  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.size) {
      table.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
      return;
    }
    table.innerHTML = snap.docs
      .map((d) => {
        const u = d.data();
        return `<tr>
          <td>${escapeHtml(u.name || '—')}</td>
          <td>${escapeHtml(u.email || '—')}</td>
          <td>${escapeHtml(u.role || '—')}</td>
          <td>${formatDate(u.createdAt)}</td>
        </tr>`;
      })
      .join('');
  } catch (err) {
    table.innerHTML = `<tr><td colspan="4">${escapeHtml(err.message)}</td></tr>`;
    toast('Deploy Firestore indexes for users.createdAt if needed.', 'error');
  }
}

async function refreshReports() {
  const chart = document.getElementById('lgu-chart');
  if (!chart) return;

  const profile = getProfile();
  chart.innerHTML = `
    <p class="donation-card__meta">Analytics chart placeholder for <strong>${escapeHtml(profile?.role || 'LGU')}</strong>.</p>
    <p>Wire Chart.js from CDN here or export Firestore aggregates — no build tools required.</p>
  `;
}

export function onLguAdminViewShown() {
  refreshLguDashboard();
}
