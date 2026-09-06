import { db } from '../core/firebaseConfig.js?v=review-v1';
import { collection, onSnapshot, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { reviewVerificationRequest } from '../core/callables.js?v=review-v1';

const body = document.getElementById('verification-review-body');
const label = { volunteer_id: 'Volunteer ID', org_authorization: 'Org authorization', lgu_authorization: 'LGU authorization' };

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fil', { dateStyle: 'medium', timeStyle: 'short' });
}

function render(snapshot) {
  if (!body) return;
  if (snapshot.empty) {
    body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-muted);">Walang pending verification requests.</td></tr>';
    return;
  }
  body.innerHTML = snapshot.docs.map((item) => {
    const request = item.data();
    return `<tr>
      <td><strong>${esc(label[request.type] || request.type)}</strong><br><small>${esc(request.storagePath)}</small></td>
      <td>${esc(request.targetUid || request.uploaderUid)}</td>
      <td>${esc(formatDate(request.createdAt))}</td>
      <td><button class="btn btn-primary review-request" data-id="${esc(item.id)}" data-type="${esc(request.type)}">Review</button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.review-request').forEach((button) => {
    button.addEventListener('click', async () => {
      const note = window.prompt('Review note (required):');
      if (!note?.trim()) return;
      const decision = window.confirm('Approve this verification request?') ? 'approved' : 'rejected';
      button.disabled = true;
      try {
        await reviewVerificationRequest({ requestId: button.dataset.id, decision, note: note.trim() });
        window.alert(decision === 'approved' ? 'Na-approve ang request.' : 'Na-reject ang request.');
      } catch (error) {
        console.error('Verification review failed', error);
        window.alert('Hindi ma-process ang review. Siguraduhing authorized ang admin account.');
        button.disabled = false;
      }
    });
  });
}

const requests = query(collection(db, 'verificationRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
onSnapshot(requests, render, (error) => {
  console.error('Verification queue failed', error);
  if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--color-danger);">Hindi ma-load ang review queue.</td></tr>';
});
