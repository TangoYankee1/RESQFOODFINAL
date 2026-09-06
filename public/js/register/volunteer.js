import { sendOTP, confirmOTP } from '../core/auth.js';
import { signupVolunteerWithProfile } from '../core/callables.js';
import { auth, db, storage } from '../core/firebaseConfig.js';
import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import {
  normalizePhone,
  isValidPHPhone,
  showToast,
  setStepperState,
  showFieldError,
  clearFieldError,
} from './shared.js';

let otpTimer = null;
let pendingConfirmation = null;
let verificationRequestId = null;
const $ = (id) => document.getElementById(id);
const phone = () => normalizePhone($('v-inp-phone').value);

function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach((panel) => panel.classList.remove('active'));
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.classList.add('active');
  setStepperState(n, 6);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearField(fieldId, errorId) {
  clearFieldError(fieldId, errorId);
}

function showError(fieldId, errorId, message) {
  showFieldError(fieldId, errorId, message);
}

function buildVolunteerPayload() {
  const availability = {};
  document.querySelectorAll('[data-slot]').forEach((input) => {
    availability[input.dataset.slot] = input.checked;
  });

  return {
    fullName: $('v-inp-name').value.trim(),
    nickname: $('v-inp-nickname').value.trim(),
    phone: phone(),
    barangay: $('v-inp-barangay').value,
    preferredBarangays: [...$('barangay-chips').querySelectorAll('input:checked')].map((input) => input.value),
    availability,
    transport: $('v-inp-transport').value,
    commitment: $('v-inp-commitment').value,
    verificationRequestId,
    trustStatus: 'pending_review',
    referralCode: $('v-inp-referral').value.trim() || null,
    emergencyContact: {
      name: $('v-inp-ec-name').value.trim(),
      phone: normalizePhone($('v-inp-ec-phone').value),
    },
    teamCode: $('v-inp-team').value.trim() || null,
  };
}

// Step 1 OTP flow
$('v-btn-send-otp').addEventListener('click', async () => {
  clearField('v-inp-phone', 'v-err-phone');
  const raw = $('v-inp-phone').value.trim();

  if (!/^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))) {
    showError('v-inp-phone', 'v-err-phone', 'Maglagay ng valid na Philippine mobile number.');
    return;
  }

  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    $('v-btn-send-otp').classList.add('hidden');
    $('v-inp-phone').disabled = true;
    $('v-otp-section').classList.remove('hidden');
    $('v-otp-phone-display').textContent = phone();
    startOtpTimer(60);
    $('v-btn-verify-otp').disabled = true;
    showToast('Naipadala na ang OTP.', 'success');
  } catch (failure) {
    console.error('Volunteer OTP failed', failure);
    showError('v-inp-phone', 'v-err-phone', 'Hindi maipadala ang OTP. Subukan muli.');
  }
});

const otpInputs = document.querySelectorAll('.otp-input');
otpInputs.forEach((input, idx) => {
  function moveToNextIfNeeded() {
    if (input.value && idx < otpInputs.length - 1) {
      requestAnimationFrame(() => otpInputs[idx + 1].focus());
    }
  }

  input.addEventListener('input', (event) => {
    const val = event.target.value.replace(/\D/g, '').slice(-1);
    event.target.value = val;
    event.target.classList.toggle('filled', Boolean(val));
    if (val) moveToNextIfNeeded();
    checkOtpComplete();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && idx > 0) {
      otpInputs[idx - 1].focus();
      otpInputs[idx - 1].value = '';
      otpInputs[idx - 1].classList.remove('filled');
    }
  });

  input.addEventListener('paste', (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    [...pasted.slice(0, 6)].forEach((char, i) => {
      if (otpInputs[i]) {
        otpInputs[i].value = char;
        otpInputs[i].classList.add('filled');
      }
    });
    const nextIndex = Math.min(pasted.length, otpInputs.length - 1);
    if (otpInputs[nextIndex]) requestAnimationFrame(() => otpInputs[nextIndex].focus());
    checkOtpComplete();
  });
});

function getOtpValue() {
  return [...otpInputs].map((input) => input.value).join('');
}

function checkOtpComplete() {
  const complete = getOtpValue().length === 6;
  $('v-btn-verify-otp').disabled = !complete;
  if (complete && pendingConfirmation) {
    $('v-btn-verify-otp').click();
  }
}

$('v-btn-verify-otp').addEventListener('click', async () => {
  clearField('v-inp-otp', 'v-err-otp');
  const code = getOtpValue();
  if (code.length < 6) return;

  try {
    await confirmOTP(pendingConfirmation, code);
    clearOtpTimer();
    showToast('Na-verify ang numero!', 'success');
    goToStep(2);
  } catch (failure) {
    console.error('Volunteer OTP verification failed', failure);
    showError('v-inp-otp', 'v-err-otp', 'Hindi valid ang OTP. Subukan muli.');
  }
});

function startOtpTimer(seconds) {
  clearOtpTimer();
  let remaining = seconds;
  const resendBtn = $('v-btn-resend');
  const countdownEl = $('otp-countdown');
  resendBtn.disabled = true;

  otpTimer = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = `Mag-expire sa ${remaining}s. `;
    if (remaining <= 0) {
      clearOtpTimer();
      countdownEl.textContent = '';
      resendBtn.disabled = false;
    }
  }, 1000);
}

function clearOtpTimer() {
  if (otpTimer) {
    clearInterval(otpTimer);
    otpTimer = null;
  }
}

$('v-btn-resend').addEventListener('click', async () => {
  const raw = $('v-inp-phone').value.trim();
  otpInputs.forEach((input) => {
    input.value = '';
    input.classList.remove('filled');
  });
  try {
    pendingConfirmation = await sendOTP(phone(), 'recaptcha-container');
    startOtpTimer(60);
    showToast('Bagong OTP code ang ipinadala.', 'info');
  } catch (failure) {
    console.error('resendOTP failed', failure);
    showToast('Hindi maipadala ang bagong code. Subukan muli.', 'error');
  }
  checkOtpComplete();
});

const barangays = ['Lahug', 'Mabolo', 'Banilad', 'Apas', 'Talamban', 'Guadalupe', 'Pardo', 'Tisa'];
barangays.forEach((barangay) => {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" value="${barangay}" /> ${barangay}`;
  $('barangay-chips').appendChild(label);
});

function updateSelectionCounts() {
  const slotCount = document.querySelectorAll('[data-slot]:checked').length;
  const barangayCount = $('barangay-chips').querySelectorAll('input:checked').length;
  $('availability-count').textContent = `${slotCount} napili`;
  $('barangay-count').textContent = `${barangayCount} napili`;
}

document.querySelectorAll('[data-slot], #barangay-chips input').forEach((input) => {
  input.addEventListener('change', updateSelectionCounts);
});
updateSelectionCounts();

$('v-btn-2-back').addEventListener('click', () => goToStep(1));
$('v-btn-2-next').addEventListener('click', () => {
  let valid = true;

  const name = $('v-inp-name').value.trim();
  clearField('v-inp-name', 'v-err-name');
  if (name.length < 3 || name.length > 100) {
    showError('v-inp-name', 'v-err-name', 'Ang pangalan ay dapat 3-100 karakter.');
    valid = false;
  }

  const nickname = $('v-inp-nickname').value.trim();
  clearField('v-inp-nickname', 'v-err-nickname');
  if (nickname.length < 2) {
    showError('v-inp-nickname', 'v-err-nickname', 'Maglagay ng palayaw.');
    valid = false;
  }

  clearField('v-inp-barangay', 'v-err-barangay');
  if (!$('v-inp-barangay').value) {
    showError('v-inp-barangay', 'v-err-barangay', 'Pumili ng barangay.');
    valid = false;
  }

  clearField('v-inp-commitment', 'v-err-commitment');
  if (!$('v-inp-commitment').value) {
    showError('v-inp-commitment', 'v-err-commitment', 'Pumili ng commitment.');
    valid = false;
  }

  if (valid) goToStep(3);
});

$('v-inp-id').addEventListener('change', () => {
  const file = $('v-inp-id').files[0];
  $('v-id-file-name').textContent = file ? file.name : 'Pumili ng file';
});

$('v-btn-3-back').addEventListener('click', () => goToStep(2));
$('v-btn-3-next').addEventListener('click', async () => {
  const file = $('v-inp-id').files[0];
  clearField('v-inp-id', 'v-err-id');
  if (!file) {
    showError('v-inp-id', 'v-err-id', 'Kailangan ang valid ID para sa trust review.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showError('v-inp-id', 'v-err-id', 'Ang file ay dapat 10 MB o mas maliit.');
    return;
  }
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    showError('v-inp-id', 'v-err-id', 'JPG, PNG, o PDF lamang ang tinatanggap.');
    return;
  }

  const nextButton = $('v-btn-3-next');
  nextButton.disabled = true;
  nextButton.textContent = 'Ina-upload...';
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('missing_auth');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storagePath = `authorization-letters/${uid}/volunteer-id/${Date.now()}-${safeName}`;
    await uploadBytes(ref(storage, storagePath), file, { contentType: file.type });

    const requestRef = doc(collection(db, 'verificationRequests'));
    verificationRequestId = requestRef.id;
    await setDoc(requestRef, {
      requestId: requestRef.id,
      uploaderUid: uid,
      targetUid: uid,
      type: 'volunteer_id',
      storagePath,
      referralCode: $('v-inp-referral').value.trim() || null,
      status: 'pending',
      reviewerUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast('Naipasa ang ID para sa LGU review.', 'success');
    goToStep(4);
  } catch (failure) {
    console.error('Volunteer ID upload failed', failure);
    showError('v-inp-id', 'v-err-id', 'Hindi ma-upload ang ID. Subukan muli.');
  } finally {
    nextButton.disabled = false;
    nextButton.textContent = 'Susunod →';
  }
});

const commitmentButtons = document.querySelectorAll('[data-value]');
commitmentButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    commitmentButtons.forEach((button) => button.classList.remove('active'));
    btn.classList.add('active');
    $('v-inp-commitment').value = btn.dataset.value;
  });
});

$('v-btn-4-next').addEventListener('click', () => {
  const selectedSlots = [...document.querySelectorAll('[data-slot]:checked')];
  const preferred = [...$('barangay-chips').querySelectorAll('input:checked')];
  let valid = true;

  clearField('v-err-avail', 'v-err-avail');
  if (!selectedSlots.length) {
    showError('v-err-avail', 'v-err-avail', 'Pumili ng kahit isang availability.');
    valid = false;
  }

  clearField('barangay-chips', 'v-err-preferred');
  if (!preferred.length || preferred.length > 10) {
    showError('barangay-chips', 'v-err-preferred', 'Pumili ng 1 hanggang 10 barangay.');
    valid = false;
  }

  clearField('v-inp-transport', 'v-err-transport');
  if (!$('v-inp-transport').value) {
    showError('v-inp-transport', 'v-err-transport', 'Pumili ng transportasyon.');
    valid = false;
  }

  if (valid) goToStep(5);
});

$('v-btn-4-back').addEventListener('click', () => goToStep(3));
$('v-btn-5-back').addEventListener('click', () => goToStep(4));
$('v-btn-submit').addEventListener('click', async () => {
  let valid = true;

  clearField('v-inp-ec-name', 'v-err-ec-name');
  if ($('v-inp-ec-name').value.trim().length < 3) {
    showError('v-inp-ec-name', 'v-err-ec-name', 'Maglagay ng emergency contact.');
    valid = false;
  }

  clearField('v-inp-ec-phone', 'v-err-ec-phone');
  if (!isValidPHPhone(normalizePhone($('v-inp-ec-phone').value))) {
    showError('v-inp-ec-phone', 'v-err-ec-phone', 'Maglagay ng valid na contact number.');
    valid = false;
  }

  clearField('v-chk-terms', 'v-err-terms');
  if (!$('v-chk-terms').checked) {
    showError('v-chk-terms', 'v-err-terms', 'Kailangan ang iyong pagsang-ayon.');
    valid = false;
  }

  if (!valid) return;

  $('v-btn-submit').disabled = true;
  try {
    await signupVolunteerWithProfile(buildVolunteerPayload());
    showToast('Nagawa na ang volunteer account.', 'success');
    window.location.href = '../volunteer/index.html';
  } catch (failure) {
    console.error('Volunteer signup failed', failure);
    showToast('Hindi ma-save ang account. Subukan muli.', 'error');
    $('v-btn-submit').disabled = false;
  }
});

function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
