import { db, storage } from '../core/firebaseConfig.js';
import { ref, getBlob } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { collection, onSnapshot, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { reviewVerificationRequest } from '../core/callables.js';
import { getCurrentUser, getSessionRole } from '../core/auth.js';

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
      <td><strong>${esc(label[request.type] || request.type)}</strong><br><small>${esc(request.storagePath)}</small>
      ${request.storagePath ? `<br><button type="button" class="btn btn-ghost view-document" data-path="${esc(request.storagePath)}">View document</button>` : ''}</td>
      <td>${esc(request.targetUid || request.uploaderUid)}</td>
      <td>${esc(formatDate(request.createdAt))}</td>
      <td><button class="btn btn-primary review-request" data-id="${esc(item.id)}" data-type="${esc(request.type)}">Review</button></td>
    </tr>`;
  }).join('');

  body.querySelectorAll('.view-document').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const blob = await getBlob(ref(storage, button.dataset.path), 10 * 1024 * 1024);
        const url = URL.createObjectURL(blob), dialog = document.createElement('dialog');
        dialog.id = 'document-preview';
        dialog.style.cssText = 'margin:auto;padding:1rem;border:0;border-radius:1rem;max-width:95vw;';
        const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-ghost'; close.textContent = 'Close document';
        close.addEventListener('click', () => dialog.close());
        const preview = document.createElement('iframe'); preview.title = 'Uploaded authorization document'; preview.src = url;
        preview.style.cssText = 'display:block;width:75vw;height:70vh;border:0;';
        dialog.append(close, preview); document.body.append(dialog);
        dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); }, { once: true });
        dialog.showModal();
      } catch (error) { console.error('Document preview failed', error); window.alert('Hindi mabuksan ang document. Suriin ang access at koneksyon.'); }
      finally { button.disabled = false; }
    });
  });

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

async function loadReviews() {
  const user = await getCurrentUser();
  if (await getSessionRole(user) !== 'systemAdmin') {
    if (body) body.innerHTML = '<tr><td colspan="4">System administrator ang nagre-review ng documents at training.</td></tr>';
    return;
  }
  const requests = query(collection(db, 'verificationRequests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
  onSnapshot(requests, render, (error) => {
    console.error('Verification queue failed', error);
    if (body) body.innerHTML = '<tr><td colspan="4">Hindi ma-load ang review queue.</td></tr>';
  });
}
loadReviews().catch(error => {
  console.error('Verification queue failed', error);
  if (body) body.textContent = 'Hindi ma-load ang review queue.';
});
