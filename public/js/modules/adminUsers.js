import { signOutCurrentUser } from '../core/auth.js';
import { loadAdminSession } from '../core/adminSession.js';
// public/js/modules/adminUsers.js
// Admin "Mga User" page — live Firestore-backed table + suspend/activate.
// Replaces the MOCK_USERS prototype (sessionStorage audit + hardcoded rows).
// Roles allowed: lguAdmin / systemAdmin. Guards on the users table id so this
// module only boots on users.html.
import { bootGuardedPage } from '../core/guard-boot.js';
import { usersQuery, watchQuery } from '../core/data.js';
import { setUserStatus } from '../core/callables.js';
import { handleError, runWithState } from '../core/errors.js';
import { toast } from '../core/ui.js';
import { esc } from '../core/utils.js';

let adminSession;
let currentFilter = 'all';
let currentDocs = [];
let unsub = null;

if (document.getElementById('users-body')) {
  bootGuardedPage({ roles: ['lguAdmin', 'systemAdmin'] }, initAdminUsers);
}

async function initAdminUsers(s) {
  if (!await loadAdminSession(s)) return;
  adminSession = s;
  loadUsers();

  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadUsers();
    })
  );

  document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
  document.getElementById('user-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    window.location.href = '/admin/login.html';
  });
}

function loadUsers() {
  const container = document.getElementById('users-body');
  if (!container) return;
  if (unsub) { unsub(); unsub = null; }
  container.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

  // Role filter is queried; pending statuses are filtered from the complete list.
  const role = ['donor', 'volunteer', 'orgAdmin'].includes(currentFilter) ? currentFilter : null;

  unsub = watchQuery(usersQuery({ role, max: 0 }), {
    next: (docs) => {
      currentDocs = docs;
      const rows = currentFilter === 'pending'
        ? docs.filter((u) => ['pending_training','pending_orientation','pending_review'].includes(u.status))
        : docs;
      renderRows(rows);
    },
    error: (err) => {
      const h = handleError(err, { scope: 'admin.users' });
      container.innerHTML = `<tr><td colspan="6" role="alert">${esc(h.message)}</td></tr>`;
    },
  });
}

function renderRows(docs) {
  const tbody = document.getElementById('users-body');
  const countEl = document.getElementById('user-count');
  if (countEl) countEl.textContent = docs.length;
  if (!tbody) return;

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang user ang nahanap.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map((u) => `
    <tr>
      <td><strong>${esc(u.fullName || u.nickname || u.id)}</strong></td>
      <td>${esc(roleLabel(u.role || u.requestedRole))}</td>
      <td>${esc(u.barangay || '—')}</td>
      <td>${statusBadge(u.status)}</td>
      <td style="font-size:.78rem;color:var(--color-muted);">${esc(u.phoneNumber || u.phone || u.email || '—')}</td>
      <td><button class="btn btn-ghost btn-view" data-id="${esc(u.id)}">Tingnan</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-view').forEach((b) =>
    b.addEventListener('click', () => openModal(b.dataset.id))
  );
}

function openModal(uid) {
  const u = currentDocs.find((x) => x.id === uid);
  if (!u) return;

  const nameEl = document.getElementById('modal-user-name');
  if (nameEl) nameEl.textContent = u.fullName || u.nickname || uid;

  const fields = document.getElementById('modal-fields');
  if (fields) {
    fields.innerHTML = `
      <div class="modal-field"><div class="mf-label">Role</div><div class="mf-val">${esc(roleLabel(u.role || u.requestedRole))}</div></div>
      <div class="modal-field"><div class="mf-label">Barangay</div><div class="mf-val">${esc(u.barangay || '—')}</div></div>
      <div class="modal-field"><div class="mf-label">Status</div><div class="mf-val">${statusBadge(u.status)}</div></div>
      <div class="modal-field"><div class="mf-label">Contact</div><div class="mf-val">${esc(u.phoneNumber || u.phone || u.email || '—')}</div></div>`;
  }

  // Pending review is never an activation shortcut.
  const manageable = uid !== adminSession.user.uid && (adminSession.role === 'systemAdmin' || ['donor','volunteer','orgAdmin'].includes(u.role));
  const mayActivate = manageable && u.status === 'suspended' && (u.role === 'donor' || u.trustStatus === 'approved');
  const suspendBtn = document.getElementById('btn-modal-suspend');
  const activateBtn = document.getElementById('btn-modal-activate');
  suspendBtn?.classList.toggle('hidden', !manageable || u.status !== 'active');
  activateBtn?.classList.toggle('hidden', !mayActivate);
  if (suspendBtn) suspendBtn.onclick = () => changeStatus(uid, 'suspended');
  if (activateBtn) activateBtn.onclick = () => changeStatus(uid, 'active');

  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'none';
}

async function changeStatus(uid, status) {
  const reason = window.prompt('Dahilan ng pagbabago:');
  if (!reason?.trim()) return;
  const result = await runWithState({}, async () => {
    const res = await setUserStatus({ targetUid: uid, status, reason: reason.trim() });
    if (res && res.success === false) throw new Error(res.reason || 'status_change_failed');
    toast(status === 'suspended' ? 'Na-suspend ang user.' : 'Na-activate ang user.', 'success');
  }, 'admin.users.status');
  if (result.ok) closeModal();
  else toast(result.error.message, 'error');
}

function roleLabel(r) {
  return { donor: 'Donor', volunteer: 'Volunteer', orgAdmin: 'Org Admin', lguAdmin: 'LGU Admin', systemAdmin: 'System Admin' }[r] || r || '—';
}

function statusBadge(s) {
  const cls = { active: 'badge-active', suspended: 'badge-suspended', pending_training: 'badge-pending' }[s] || 'badge-pending';
  const label = { active: 'Active', suspended: 'Suspended', pending_training: 'Pending Training' }[s] || s || '—';
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}
