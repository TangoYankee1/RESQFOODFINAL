import { sendOTP, confirmOTP } from '../core/auth.js';
import { signupOrgAdminWithProfile } from '../core/callables.js?v=org-admin-v1';
import { auth, db, storage } from '../core/firebaseConfig.js?v=org-admin-v1';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { normalizePhone, isValidPHPhone, showToast, setStepperState, showFieldError, clearFieldError } from './shared.js';

let pendingConfirmation = null;
let authorizationRequestId = null;
let deviceMode = null;
let otpTimer = null;
const $ = (id) => document.getElementById(id);
const phone = () => normalizePhone($('o-inp-phone').value);

function goToStep(number) {
  document.querySelectorAll('.step-panel').forEach((panel) => panel.classList.remove('active'));
  $(`step-${number}`)?.classList.add('active');
  setStepperState(number, 7);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function error(field, message) { showFieldError(field, `o-err-${field}`, message); }
function clear(field) { clearFieldError(field, `o-err-${field}`); }

$('o-btn-send-otp').addEventListener('click', async () => {
  clear('phone');
  const raw = $('o-inp-phone').value.trim();
  if (!/^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))) return error('phone', 'Maglagay ng valid na Philippine mobile number.');
  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    $('o-inp-phone').disabled = true;
    $('o-btn-send-otp').classList.add('hidden');
    $('o-otp-section').classList.remove('hidden');
    $('o-otp-phone').textContent = phone();
    $('o-otp-section').querySelector('.otp-input')?.focus();
    startOtpTimer(60);
    showToast('Naipadala na ang OTP.', 'success');
  } catch (failure) {
    console.error('Org OTP failed', failure);
    error('phone', 'Hindi maipadala ang OTP. Subukan muli.');
  }
});

function startOtpTimer(seconds) {
  clearOtpTimer();
  let remaining = seconds;
  $('o-btn-resend').disabled = true;
  otpTimer = setInterval(() => {
    remaining -= 1;
    $('o-otp-countdown').textContent = `Mag-expire sa ${remaining}s. `;
    if (remaining <= 0) {
      clearOtpTimer();
      $('o-otp-countdown').textContent = '';
      $('o-btn-resend').disabled = false;
    }
  }, 1000);
}

function clearOtpTimer() {
  if (otpTimer) clearInterval(otpTimer);
  otpTimer = null;
}

const otpInputs = document.querySelectorAll('#o-otp-section .otp-input');
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (event) => {
    const value = event.target.value.replace(/\D/g, '').slice(-1);
    event.target.value = value;
    event.target.classList.toggle('filled', Boolean(value));
    if (value && index < otpInputs.length - 1) requestAnimationFrame(() => otpInputs[index + 1].focus());
    $('o-btn-verify-otp').disabled = [...otpInputs].some((digit) => !digit.value);
    if ([...otpInputs].every((digit) => digit.value) && pendingConfirmation) $('o-btn-verify-otp').click();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && index > 0) otpInputs[index - 1].focus();
  });
  input.addEventListener('paste', (event) => {
    event.preventDefault();
    [...event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)].forEach((value, position) => {
      otpInputs[position].value = value;
      otpInputs[position].classList.add('filled');
    });
    $('o-btn-verify-otp').disabled = false;
    otpInputs[Math.min(event.clipboardData.getData('text').replace(/\D/g, '').length, 5)]?.focus();
  });
});

$('o-btn-verify-otp').addEventListener('click', async () => {
  clear('otp');
  try {
    await confirmOTP(pendingConfirmation, [...otpInputs].map((input) => input.value).join(''));
    clearOtpTimer();
    showToast('Na-verify ang coordinator.', 'success');
    goToStep(2);
  } catch (failure) {
    console.error('Org OTP verification failed', failure);
    error('otp', 'Hindi valid ang OTP. Subukan muli.');
  }
});

$('o-btn-resend').addEventListener('click', async () => {
  otpInputs.forEach((input) => { input.value = ''; input.classList.remove('filled'); });
  $('o-btn-verify-otp').disabled = true;
  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    startOtpTimer(60);
    showToast('Bagong OTP code ang ipinadala.', 'info');
  } catch (failure) {
    console.error('Org OTP resend failed', failure);
    showToast('Hindi maipadala ang bagong code. Subukan muli.', 'error');
  }
});

$('o-btn-2-back').addEventListener('click', () => goToStep(1));
$('o-btn-2-next').addEventListener('click', () => {
  let valid = true;
  [['name', $('o-inp-name').value.trim().length >= 3, 'Maglagay ng pangalan ng organization.'], ['type', Boolean($('o-inp-type').value), 'Pumili ng uri ng organization.'], ['barangay', Boolean($('o-inp-barangay').value), 'Pumili ng barangay.']].forEach(([field, passes, message]) => {
    clear(field);
    if (!passes) { error(field, message); valid = false; }
  });
  if (valid) { $('o-summary-name').textContent = $('o-inp-name').value.trim(); goToStep(3); }
});

$('o-btn-3-back').addEventListener('click', () => goToStep(2));
$('o-btn-3-next').addEventListener('click', () => {
  let valid = true;
  [['contact', $('o-inp-contact').value.trim().length >= 3, 'Maglagay ng pangalan ng coordinator.'], ['designation', $('o-inp-designation').value.trim().length >= 2, 'Maglagay ng designation.']].forEach(([field, passes, message]) => {
    clear(field);
    if (!passes) { error(field, message); valid = false; }
  });
  if (valid) goToStep(4);
});

$('o-inp-doc').addEventListener('change', () => {
  $('o-file-name').textContent = $('o-inp-doc').files[0]?.name || 'Pumili ng file';
});

$('o-btn-4-back').addEventListener('click', () => goToStep(3));
$('o-btn-4-next').addEventListener('click', async () => {
  const file = $('o-inp-doc').files[0];
  clear('doc');
  if (!file) return error('doc', 'Kailangan ang authorization document.');
  if (file.size > 10 * 1024 * 1024) return error('doc', 'Ang file ay dapat 10 MB o mas maliit.');
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) return error('doc', 'PDF, JPG, o PNG lamang ang tinatanggap.');

  const button = $('o-btn-4-next');
  button.disabled = true;
  button.textContent = 'Ina-upload...';
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('missing_auth');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `authorization-letters/${uid}/organization/${Date.now()}-${safeName}`;
    await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });
    const requestRef = doc(collection(db, 'verificationRequests'));
    authorizationRequestId = requestRef.id;
    await setDoc(requestRef, {
      requestId: requestRef.id,
      uploaderUid: uid,
      targetUid: uid,
      type: 'org_authorization',
      storagePath,
      inviteCode: $('o-inp-invite').value.trim() || null,
      status: 'pending',
      reviewerUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast('Naipasa ang document para sa LGU review.', 'success');
    goToStep(5);
  } catch (failure) {
    console.error('Organization document upload failed', failure);
    error('doc', 'Hindi ma-upload ang document. Subukan muli.');
  } finally {
    button.disabled = false;
    button.textContent = 'I-submit ang Document';
  }
});

$('o-btn-5-back').addEventListener('click', () => goToStep(4));
$('o-btn-device').addEventListener('click', async () => {
  const button = $('o-btn-device');
  button.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    deviceMode = 'standard';
    $('o-device-mode').textContent = 'Standard Mode · QR';
    $('o-device-status').textContent = 'May camera ang device. Maaari mong gamitin ang QR verification.';
  } catch (_) {
    deviceMode = 'basic';
    $('o-device-mode').textContent = 'Basic Mode · PIN';
    $('o-device-status').textContent = 'Walang camera access. PIN verification ang gagamitin sa device na ito.';
  } finally {
    button.textContent = 'Nasuri na';
    button.disabled = false;
    $('o-btn-5-next').disabled = false;
  }
});

$('o-btn-5-next').addEventListener('click', () => goToStep(6));
$('o-btn-6-back').addEventListener('click', () => goToStep(5));
$('o-btn-submit').addEventListener('click', async () => {
  clear('training');
  clear('responsibility');
  let valid = true;
  if (!$('o-chk-training').checked) { error('training', 'Kailangan ang training acknowledgment.'); valid = false; }
  if (!$('o-chk-responsibility').checked) { error('responsibility', 'Kailangan ang responsibility acknowledgment.'); valid = false; }
  if (!valid) return;

  const button = $('o-btn-submit');
  button.disabled = true;
  button.textContent = 'Sine-save...';
  try {
    await signupOrgAdminWithProfile({
      organizationName: $('o-inp-name').value.trim(),
      organizationType: $('o-inp-type').value,
      barangay: $('o-inp-barangay').value,
      coordinatorName: $('o-inp-contact').value.trim(),
      coordinatorDesignation: $('o-inp-designation').value.trim(),
      phone: phone(),
      authorizationRequestId,
      deviceMode,
      trainingAcknowledged: true,
      responsibilityAcknowledged: true,
    });
    sessionStorage.setItem('org_registration_pending', 'true');
    goToStep(7);
    showToast('Na-submit ang organization application.', 'success');
  } catch (failure) {
    console.error('Organization signup failed', failure);
    showToast('Hindi ma-save ang application. Subukan muli.', 'error');
    button.disabled = false;
    button.textContent = 'I-submit ang Registration';
  }
});

function updateOnline() { document.body.classList.toggle('offline', !navigator.onLine); }
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
