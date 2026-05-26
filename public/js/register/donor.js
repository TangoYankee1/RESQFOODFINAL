import { auth } from '../core/firebaseConfig.js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  normalizePhone,
  isValidPHPhone,
  showToast,
  atomicWriteUserProfile,
  showRecoveryScreen,
  setStepperState,
  showFieldError,
  clearFieldError,
} from './shared.js';

// ── State ────────────────────────────────────────────────────────────────────
let confirmationResult = null;
let verifiedUser      = null;
let otpTimer          = null;
let isBusiness        = false;
let pendingProfileData = null;

// ── Step navigation ──────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.classList.add('active');
  setStepperState(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── STEP 1 — Phone OTP ───────────────────────────────────────────────────────
let recaptchaVerifier = null;

function initRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (_) {}
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
  });
}

document.getElementById('btn-send-otp').addEventListener('click', async () => {
  const raw = document.getElementById('inp-phone').value.trim();
  clearFieldError('phone-wrap', 'err-phone');
  document.getElementById('collision-msg').classList.remove('visible');

  if (!isValidPHPhone(raw)) {
    showFieldError('phone-wrap', 'err-phone',
      'Mangyaring maglagay ng tamang Philippine mobile number (9XXXXXXXXX).');
    return;
  }

  const phone = normalizePhone(raw);
  const btn   = document.getElementById('btn-send-otp');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Nagpapadala...';

  try {
    initRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    showOtpSection(phone);
    showToast('Naipadala ang OTP. Tingnan ang iyong SMS.', 'success');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Magpadala ng Code';

    if (err.code === 'auth/invalid-phone-number') {
      showFieldError('phone-wrap', 'err-phone', 'Hindi valid ang numero. Subukan: 9171234567');
    } else if (err.code === 'auth/too-many-requests') {
      showFieldError('phone-wrap', 'err-phone',
        'Masyadong maraming pagsubok. Subukan muli mamaya.');
    } else {
      showFieldError('phone-wrap', 'err-phone',
        'Hindi mapadala ang OTP. Suriin ang koneksyon at subukan muli.');
      console.error(err);
    }
  }
});

function showOtpSection(phone) {
  document.getElementById('btn-send-otp').classList.add('hidden');
  document.getElementById('inp-phone').disabled = true;
  document.getElementById('otp-section').classList.remove('hidden');
  document.getElementById('otp-phone-display').textContent = phone;
  startOtpTimer(60);
  document.querySelector('.otp-input').focus();
}

// OTP digit inputs — auto-advance and paste support
const otpInputs = document.querySelectorAll('.otp-input');
otpInputs.forEach((input, idx) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    e.target.value = val;
    if (val) e.target.classList.add('filled');
    else      e.target.classList.remove('filled');
    if (val && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    checkOtpComplete();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) {
      otpInputs[idx - 1].focus();
      otpInputs[idx - 1].value = '';
      otpInputs[idx - 1].classList.remove('filled');
    }
  });

  // Handle full paste (e.g. SMS autofill)
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    [...pasted.slice(0, 6)].forEach((char, i) => {
      if (otpInputs[i]) {
        otpInputs[i].value = char;
        otpInputs[i].classList.add('filled');
      }
    });
    checkOtpComplete();
  });
});

function getOtpValue() {
  return [...otpInputs].map(i => i.value).join('');
}

function checkOtpComplete() {
  const complete = getOtpValue().length === 6;
  document.getElementById('btn-verify-otp').disabled = !complete;
}

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
  const code = getOtpValue();
  clearFieldError(null, 'err-otp');

  const btn = document.getElementById('btn-verify-otp');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Bine-verify...';

  try {
    const credential = await confirmationResult.confirm(code);
    verifiedUser = credential.user;
    clearOtpTimer();
    showToast('Na-verify ang numero!', 'success');
    goToStep(2);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'I-verify ang Code';

    if (err.code === 'auth/invalid-verification-code') {
      showFieldError(null, 'err-otp', 'Mali ang code. Subukan muli.');
      otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
      otpInputs[0].focus();
    } else if (err.code === 'auth/code-expired') {
      showFieldError(null, 'err-otp',
        'Expired na ang code. Pindutin ang "Magpadala ulit".');
    } else {
      showFieldError(null, 'err-otp', 'Hindi ma-verify. Subukan muli.');
      console.error(err);
    }
  }
});

// OTP countdown timer
function startOtpTimer(seconds) {
  clearOtpTimer();
  let remaining = seconds;
  const resendBtn    = document.getElementById('btn-resend');
  const countdownEl  = document.getElementById('otp-countdown');
  resendBtn.disabled = true;

  otpTimer = setInterval(() => {
    remaining--;
    countdownEl.textContent = `Mag-expire sa ${remaining}s. `;
    if (remaining <= 0) {
      clearOtpTimer();
      countdownEl.textContent = '';
      resendBtn.disabled = false;
    }
  }, 1000);
}

function clearOtpTimer() {
  if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
}

document.getElementById('btn-resend').addEventListener('click', async () => {
  const raw = document.getElementById('inp-phone').value.trim();
  const phone = normalizePhone(raw);
  document.getElementById('btn-resend').disabled = true;

  try {
    initRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    startOtpTimer(60);
    otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
    checkOtpComplete();
    showToast('Bagong OTP na naipadala!', 'info');
  } catch (_) {
    showToast('Hindi mapadala ang bagong OTP. Subukan muli.', 'error');
    document.getElementById('btn-resend').disabled = false;
  }
});

// ── STEP 2 — Identity & Location ─────────────────────────────────────────────
document.getElementById('btn-2-back').addEventListener('click', () => goToStep(1));

document.getElementById('btn-2-next').addEventListener('click', () => {
  let valid = true;

  const name = document.getElementById('inp-name').value.trim();
  clearFieldError('inp-name', 'err-name');
  if (name.length < 3 || name.length > 100 || !/^[\w\sÀ-ɏḀ-ỿ.,'-]+$/u.test(name)) {
    showFieldError('inp-name', 'err-name',
      'Ang pangalan ay dapat 3–100 karakter (titik at espasyo lamang).');
    valid = false;
  }

  const email = document.getElementById('inp-email').value.trim();
  clearFieldError('inp-email', 'err-email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('inp-email', 'err-email', 'Hindi valid ang email address.');
    valid = false;
  }

  const barangay = document.getElementById('inp-barangay').value;
  clearFieldError('inp-barangay', 'err-barangay');
  if (!barangay) {
    showFieldError('inp-barangay', 'err-barangay', 'Piliin ang iyong barangay.');
    valid = false;
  }

  if (valid) goToStep(3);
});

// Update business name preview when donor name changes
document.getElementById('inp-name').addEventListener('input', updateDisplayNamePreview);

function updateDisplayNamePreview() {
  const name    = document.getElementById('inp-name').value.trim();
  const bizName = document.getElementById('inp-business-name').value.trim();
  const preview = document.getElementById('preview-display-name');
  if (!preview) return;

  if (isBusiness && bizName) {
    preview.textContent = `"${bizName}"`;
  } else if (name) {
    const parts = name.split(' ');
    const display = parts.length > 1
      ? `"${parts[0]} ${parts[parts.length - 1][0]}."`
      : `"${name}"`;
    preview.textContent = display;
  }
}

// ── STEP 3 — Business Toggle ──────────────────────────────────────────────────
document.getElementById('toggle-individual').addEventListener('click', () => {
  isBusiness = false;
  document.getElementById('toggle-individual').classList.add('active');
  document.getElementById('toggle-business').classList.remove('active');
  document.getElementById('business-fields').classList.add('hidden');
  updateDisplayNamePreview();
});

document.getElementById('toggle-business').addEventListener('click', () => {
  isBusiness = true;
  document.getElementById('toggle-business').classList.add('active');
  document.getElementById('toggle-individual').classList.remove('active');
  document.getElementById('business-fields').classList.remove('hidden');
  updateDisplayNamePreview();
});

document.getElementById('inp-business-name').addEventListener('input', updateDisplayNamePreview);

document.getElementById('btn-3-back').addEventListener('click', () => goToStep(2));

document.getElementById('btn-3-next').addEventListener('click', () => {
  let valid = true;

  if (isBusiness) {
    const bizName = document.getElementById('inp-business-name').value.trim();
    clearFieldError('inp-business-name', 'err-business-name');
    if (!bizName || bizName.length < 2) {
      showFieldError('inp-business-name', 'err-business-name',
        'Ilagay ang pangalan ng iyong negosyo.');
      valid = false;
    }
  }

  if (valid) goToStep(4);
});

// ── STEP 4 — Waiver scroll gate ───────────────────────────────────────────────
const waiverBox   = document.getElementById('waiver-scroll-box');
const waiverChecks = document.getElementById('waiver-checkboxes');
const scrollHint  = document.getElementById('scroll-hint');
const chkSafety   = document.getElementById('chk-safety');
const chkPrivacy  = document.getElementById('chk-privacy');
const btnSubmit   = document.getElementById('btn-4-submit');

function checkWaiverState() {
  const bothChecked = chkSafety.checked && chkPrivacy.checked;
  btnSubmit.disabled = !bothChecked;
}

waiverBox.addEventListener('scroll', () => {
  const scrolled = waiverBox.scrollTop + waiverBox.clientHeight >= waiverBox.scrollHeight - 10;
  if (scrolled) {
    waiverChecks.style.opacity = '1';
    waiverChecks.style.pointerEvents = 'auto';
    waiverChecks.setAttribute('aria-disabled', 'false');
    chkSafety.disabled = false;
    chkPrivacy.disabled = false;
    scrollHint.style.display = 'none';
  }
});

chkSafety.addEventListener('change', checkWaiverState);
chkPrivacy.addEventListener('change', checkWaiverState);

document.getElementById('btn-4-back').addEventListener('click', () => goToStep(3));

btnSubmit.addEventListener('click', submitRegistration);

async function submitRegistration() {
  if (!verifiedUser) {
    showToast('Session expired. I-reload ang page.', 'error');
    return;
  }

  clearFieldError(null, 'err-waiver');
  if (!chkSafety.checked || !chkPrivacy.checked) {
    showFieldError(null, 'err-waiver',
      'Dapat i-check ang parehong kahon bago magpatuloy.');
    return;
  }

  const fullName       = document.getElementById('inp-name').value.trim();
  const email          = document.getElementById('inp-email').value.trim() || null;
  const barangay       = document.getElementById('inp-barangay').value;
  const streetAddress  = document.getElementById('inp-street').value.trim();
  const businessName   = isBusiness
    ? document.getElementById('inp-business-name').value.trim()
    : null;
  const permitNumber   = isBusiness
    ? (document.getElementById('inp-permit').value.trim() || null)
    : null;

  pendingProfileData = {
    uid:                    verifiedUser.uid,
    fullName,
    contactNumber:          verifiedUser.phoneNumber,
    email,
    role:                   'donor',
    isBusiness,
    businessName,
    businessPermitNumber:   permitNumber,
    barangay,
    streetAddress,
    status:                 'active',
    onboardingComplete:     false,
    safetyWaiverVersion:    'v1-2026',
    liabilityWaiverSigned:  true,
    privacyConsentSigned:   true,
    totalDonatedKg:         0,
    points:                 0,
    badges:                 [],
    reliabilityScore:       0,
  };

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="spinner"></span> Sine-save...';

  try {
    await updateProfile(verifiedUser, { displayName: fullName });
    await atomicWriteUserProfile(verifiedUser.uid, pendingProfileData);
    goToStep(5);
    showToast('Account na-create! Welcome!', 'success');
  } catch (err) {
    console.error('Profile write failed:', err);
    showRecoveryScreen(
      'Hindi ma-save ang iyong account. Tingnan ang koneksyon at subukan muli.',
      submitRegistration,
    );
  }
}

// ── Offline banner ────────────────────────────────────────────────────────────
function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
}
window.addEventListener('online',  updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
