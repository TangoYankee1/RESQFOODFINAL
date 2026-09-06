import { sendOTP, confirmOTP } from '../core/auth.js';
import { validateInvite, consumeInvite } from '../core/callables.js?v=lgu-v1';
import { auth, db, storage } from '../core/firebaseConfig.js?v=lgu-v1';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { normalizePhone, showToast, setStepperState, showFieldError, clearFieldError } from './shared.js';

let inviteToken = new URLSearchParams(location.search).get('token') || '';
let inviteId = null;
let inviteMeta = {};
let pendingConfirmation = null;
let documentRequestId = null;
let otpTimer = null;
const $ = (id) => document.getElementById(id);
const phone = () => normalizePhone($('lgu-inp-phone').value);

function goToStep(number) {
  document.querySelectorAll('.step-panel').forEach((panel) => panel.classList.remove('active'));
  $(`step-${number}`)?.classList.add('active');
  setStepperState(number, 6);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function error(field, message) { showFieldError(`lgu-inp-${field}`, `lgu-err-${field}`, message); }
function clear(field) { clearFieldError(`lgu-inp-${field}`, `lgu-err-${field}`); }
function requestError(message) { const el = $('lgu-err-doc'); el.textContent = message; el.classList.add('visible'); }

async function loadInvite() {
  const state = $('invite-state');
  if (!inviteToken) {
    state.textContent = 'Walang invite token. Gumamit ng opisyal na invite link.';
    state.style.background = 'var(--color-danger-lt)';
    return;
  }
  try {
    const result = await validateInvite({ token: inviteToken });
    if (!result.success || result.kind !== 'lgu') throw new Error(result.reason || 'invalid_invite');
    inviteId = result.inviteId;
    inviteMeta = result.meta || {};
    state.textContent = `Valid na invite${inviteMeta.barangay ? ` para sa ${inviteMeta.barangay}` : ''}.`;
    $('lgu-inp-barangay').value = inviteMeta.barangay || '';
    $('lgu-btn-invite-next').disabled = false;
  } catch (failure) {
    console.error('LGU invite validation failed', failure);
    state.textContent = 'Hindi valid, expired, o nagamit na ang invite.';
    state.style.background = 'var(--color-danger-lt)';
  }
}

$('lgu-btn-invite-next').addEventListener('click', () => {
  const email = $('lgu-inp-email').value.trim();
  clear('email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('email', 'Maglagay ng valid na official email.');
  goToStep(2);
});

$('lgu-btn-send-otp').addEventListener('click', async () => {
  clear('phone');
  const raw = $('lgu-inp-phone').value.trim();
  if (!/^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))) return error('phone', 'Maglagay ng valid na Philippine mobile number.');
  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    $('lgu-inp-phone').disabled = true;
    $('lgu-btn-send-otp').classList.add('hidden');
    $('lgu-otp-section').classList.remove('hidden');
    startOtpTimer(60);
    $('lgu-otp-section').querySelector('.otp-input')?.focus();
    showToast('Naipadala na ang OTP.', 'success');
  } catch (failure) {
    console.error('LGU OTP failed', failure);
    error('phone', 'Hindi maipadala ang OTP. Subukan muli.');
  }
});

const otpInputs = document.querySelectorAll('#lgu-otp-section .otp-input');
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (event) => {
    const value = event.target.value.replace(/\D/g, '').slice(-1);
    event.target.value = value;
    event.target.classList.toggle('filled', Boolean(value));
    if (value && index < otpInputs.length - 1) requestAnimationFrame(() => otpInputs[index + 1].focus());
    const complete = [...otpInputs].every((digit) => digit.value);
    $('lgu-btn-verify-otp').disabled = !complete;
    if (complete && pendingConfirmation) $('lgu-btn-verify-otp').click();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && index > 0) otpInputs[index - 1].focus();
  });
});

function startOtpTimer(seconds) {
  clearOtpTimer();
  let remaining = seconds;
  $('lgu-btn-resend').disabled = true;
  otpTimer = setInterval(() => {
    remaining -= 1;
    $('lgu-otp-countdown').textContent = `Mag-expire sa ${remaining}s. `;
    if (remaining <= 0) {
      clearOtpTimer();
      $('lgu-otp-countdown').textContent = '';
      $('lgu-btn-resend').disabled = false;
    }
  }, 1000);
}
function clearOtpTimer() { if (otpTimer) clearInterval(otpTimer); otpTimer = null; }

$('lgu-btn-resend').addEventListener('click', async () => {
  otpInputs.forEach((input) => { input.value = ''; input.classList.remove('filled'); });
  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    startOtpTimer(60);
    showToast('Bagong OTP code ang ipinadala.', 'info');
  } catch (failure) {
    console.error('LGU OTP resend failed', failure);
    showToast('Hindi maipadala ang bagong code.', 'error');
  }
});

$('lgu-btn-verify-otp').addEventListener('click', async () => {
  clear('otp');
  try {
    await confirmOTP(pendingConfirmation, [...otpInputs].map((input) => input.value).join(''));
    clearOtpTimer();
    showToast('Na-verify ang mobile number.', 'success');
    goToStep(3);
  } catch (failure) {
    console.error('LGU OTP verification failed', failure);
    error('otp', 'Hindi valid ang OTP. Subukan muli.');
  }
});

$('lgu-btn-3-back').addEventListener('click', () => goToStep(2));
$('lgu-btn-3-next').addEventListener('click', () => {
  let valid = true;
  [['name', $('lgu-inp-name').value.trim().length >= 3, 'Maglagay ng buong pangalan.'], ['designation', $('lgu-inp-designation').value.trim().length >= 2, 'Maglagay ng designation.'], ['barangay', $('lgu-inp-barangay').value.trim().length >= 2, 'Maglagay ng barangay.']].forEach(([field, passes, message]) => {
    clear(field);
    if (!passes) { error(field, message); valid = false; }
  });
  if (valid) goToStep(4);
});

$('lgu-inp-doc').addEventListener('change', () => { $('lgu-file-name').textContent = $('lgu-inp-doc').files[0]?.name || 'Pumili ng file'; });
$('lgu-btn-4-back').addEventListener('click', () => goToStep(3));
$('lgu-btn-4-next').addEventListener('click', async () => {
  const file = $('lgu-inp-doc').files[0];
  $('lgu-err-doc').classList.remove('visible');
  if (!file) return requestError('Kailangan ang authorization document.');
  if (file.size > 10 * 1024 * 1024) return requestError('Ang file ay dapat 10 MB o mas maliit.');
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return requestError('PDF, JPG, o PNG lamang ang tinatanggap.');
  const button = $('lgu-btn-4-next');
  button.disabled = true; button.textContent = 'Ina-upload...';
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('missing_auth');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `authorization-letters/${uid}/lgu/${Date.now()}-${safeName}`;
    await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });
    const requestRef = doc(collection(db, 'verificationRequests'));
    documentRequestId = requestRef.id;
    await setDoc(requestRef, { requestId: requestRef.id, uploaderUid: uid, targetUid: uid, type: 'lgu_authorization', storagePath, inviteId, officialEmail: $('lgu-inp-email').value.trim(), status: 'pending', reviewerUid: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    showToast('Naipasa ang document para sa manual review.', 'success');
    goToStep(5);
  } catch (failure) {
    console.error('LGU document upload failed', failure);
    requestError('Hindi ma-upload ang document. Subukan muli.');
  } finally { button.disabled = false; button.textContent = 'I-submit ang Document'; }
});

$('lgu-btn-5-back').addEventListener('click', () => goToStep(4));
$('lgu-btn-submit').addEventListener('click', async () => {
  const checkbox = $('lgu-chk-audit');
  $('lgu-err-audit').classList.remove('visible');
  if (!checkbox.checked) { $('lgu-err-audit').textContent = 'Kailangan ang audit responsibility acknowledgment.'; $('lgu-err-audit').classList.add('visible'); return; }
  const button = $('lgu-btn-submit'); button.disabled = true; button.textContent = 'Sine-save...';
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !inviteId || !documentRequestId) throw new Error('incomplete_registration');
    await setDoc(doc(db, 'users', uid), { fullName: $('lgu-inp-name').value.trim(), phoneNumber: phone(), email: $('lgu-inp-email').value.trim(), designation: $('lgu-inp-designation').value.trim(), barangay: $('lgu-inp-barangay').value.trim(), requestedRole: 'lguAdmin', status: 'pending_review', verificationRequestId: documentRequestId, inviteId, auditAcknowledged: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    const consumed = await consumeInvite({ token: inviteToken });
    if (!consumed.success) throw new Error(consumed.reason || 'invite_consume_failed');
    sessionStorage.setItem('lgu_registration_pending', 'true');
    goToStep(6);
    showToast('Na-submit ang LGU application.', 'success');
  } catch (failure) {
    console.error('LGU registration failed', failure);
    showToast('Hindi ma-save ang application. Subukan muli.', 'error');
    button.disabled = false; button.textContent = 'Isumite ang Application';
  }
});

function updateOnline() { document.body.classList.toggle('offline', !navigator.onLine); }
window.addEventListener('online', updateOnline); window.addEventListener('offline', updateOnline); updateOnline();
loadInvite();
