import {
  showToast,
  setStepperState,
  showFieldError,
  clearFieldError,
  buildDonorRegistrationPayload,
  validateDonorRegistrationPayload,
} from './shared.js';
import { sendOTP, confirmOTP } from '../core/auth.js';
import { signupWithProfile } from '../core/callables.js';

// ── State ────────────────────────────────────────────────────────────────────
let otpTimer   = null;
let isBusiness = false;
let pendingConfirmation = null;

// ── Step navigation ──────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step-${n}`);
  if (panel) panel.classList.add('active');
  setStepperState(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── STEP 1 — Phone via real Firebase OTP ────────────────────────────────────
document.getElementById('btn-send-otp').addEventListener('click', async () => {
  const raw = document.getElementById('inp-phone').value.trim();
  clearFieldError('phone-wrap', 'err-phone');
  document.getElementById('collision-msg').classList.remove('visible');

  if (!/^\d{10}$/.test(raw.replace(/\D/g, '').slice(-10))) {
    showFieldError('phone-wrap', 'err-phone',
      'Mangyaring maglagay ng tamang Philippine mobile number (9XXXXXXXXX).');
    return;
  }

  const phone = '+63' + raw.replace(/\D/g, '').slice(-10);

  try {
    pendingConfirmation = await sendOTP(phone, 'recaptcha-container');
    showOtpSection(phone);
    showToast('Na-send na ang OTP code sa iyong numero.', 'success');
  } catch (err) {
    console.error('sendOTP failed', err);
    showFieldError('phone-wrap', 'err-phone', 'Hindi maipadala ang code sa iyong numero. Subukan muli.');
  }
});

function showOtpSection(phone) {
  document.getElementById('btn-send-otp').classList.add('hidden');
  document.getElementById('inp-phone').disabled = true;
  document.getElementById('otp-section').classList.remove('hidden');
  document.getElementById('otp-phone-display').textContent = phone;
  startOtpTimer(60);
  document.querySelector('.otp-input')?.focus();
}

// ── OTP digit inputs ─────────────────────────────────────────────────────────
const otpInputs = document.querySelectorAll('.otp-input');

otpInputs.forEach((input, idx) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    e.target.value = val;
    val ? e.target.classList.add('filled') : e.target.classList.remove('filled');
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

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    [...pasted.slice(0, 6)].forEach((char, i) => {
      if (otpInputs[i]) { otpInputs[i].value = char; otpInputs[i].classList.add('filled'); }
    });
    checkOtpComplete();
  });
});

function getOtpValue() { return [...otpInputs].map(i => i.value).join(''); }

function checkOtpComplete() {
  document.getElementById('btn-verify-otp').disabled = getOtpValue().length !== 6;
}

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
  const code = getOtpValue();
  if (code.length < 6) return;

  try {
    await confirmOTP(pendingConfirmation, code);
    clearOtpTimer();
    showToast('Na-verify ang numero!', 'success');
    goToStep(2);
  } catch (err) {
    console.error('OTP verification failed', err);
    clearFieldError('otp-group', 'err-otp');
    showFieldError('otp-group', 'err-otp', 'Hindi valid ang code. Subukan muli.');
  }
});

// OTP countdown timer (cosmetic)
function startOtpTimer(seconds) {
  clearOtpTimer();
  let remaining = seconds;
  const resendBtn   = document.getElementById('btn-resend');
  const countdownEl = document.getElementById('otp-countdown');
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
  const phone = '+63' + raw.replace(/\D/g, '').slice(-10);
  otpInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
  try {
    pendingConfirmation = await sendOTP(phone, 'recaptcha-container');
    startOtpTimer(60);
    showToast('Bagong OTP code ang ipinadala.', 'info');
  } catch (err) {
    console.error('resendOTP failed', err);
    showToast('Hindi maipadala ang bagong code. Subukan muli.', 'error');
  }
  checkOtpComplete();
});

// ── STEP 2 — Identity & Location ─────────────────────────────────────────────
document.getElementById('btn-2-back').addEventListener('click', () => goToStep(1));

document.getElementById('btn-2-next').addEventListener('click', () => {
  let valid = true;

  const name = document.getElementById('inp-name').value.trim();
  clearFieldError('inp-name', 'err-name');
  if (name.length < 3 || name.length > 100) {
    showFieldError('inp-name', 'err-name', 'Ang pangalan ay dapat 3–100 karakter.');
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
    preview.textContent = parts.length > 1
      ? `"${parts[0]} ${parts[parts.length - 1][0]}."`
      : `"${name}"`;
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
  if (isBusiness) {
    const bizName = document.getElementById('inp-business-name').value.trim();
    clearFieldError('inp-business-name', 'err-business-name');
    if (!bizName || bizName.length < 2) {
      showFieldError('inp-business-name', 'err-business-name', 'Ilagay ang pangalan ng iyong negosyo.');
      return;
    }
  }
  goToStep(4);
});

// ── STEP 4 — Waiver scroll gate ───────────────────────────────────────────────
const waiverBox    = document.getElementById('waiver-scroll-box');
const waiverChecks = document.getElementById('waiver-checkboxes');
const scrollHint   = document.getElementById('scroll-hint');
const chkSafety    = document.getElementById('chk-safety');
const chkPrivacy   = document.getElementById('chk-privacy');
const btnSubmit    = document.getElementById('btn-4-submit');

function checkWaiverState() {
  btnSubmit.disabled = !(chkSafety.checked && chkPrivacy.checked);
}

waiverBox.addEventListener('scroll', () => {
  const scrolled = waiverBox.scrollTop + waiverBox.clientHeight >= waiverBox.scrollHeight - 10;
  if (scrolled) {
    waiverChecks.style.opacity      = '1';
    waiverChecks.style.pointerEvents = 'auto';
    waiverChecks.setAttribute('aria-disabled', 'false');
    chkSafety.disabled  = false;
    chkPrivacy.disabled = false;
    scrollHint.style.display = 'none';
  }
});

chkSafety.addEventListener('change',  checkWaiverState);
chkPrivacy.addEventListener('change', checkWaiverState);
document.getElementById('btn-4-back').addEventListener('click', () => goToStep(3));

btnSubmit.addEventListener('click', async () => {
  if (!chkSafety.checked || !chkPrivacy.checked) return;

  const payload = buildDonorRegistrationPayload();
  const validation = validateDonorRegistrationPayload(payload);

  if (!validation.valid) {
    if (validation.errors.name) showFieldError('inp-name', 'err-name', validation.errors.name);
    if (validation.errors.email) showFieldError('inp-email', 'err-email', validation.errors.email);
    if (validation.errors.barangay) showFieldError('inp-barangay', 'err-barangay', validation.errors.barangay);
    if (validation.errors.businessName) showFieldError('inp-business-name', 'err-business-name', validation.errors.businessName);
    if (validation.errors.phone) showFieldError('phone-wrap', 'err-phone', validation.errors.phone);
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="spinner"></span> Sine-save...';

  try {
    const result = await signupWithProfile(payload);
    if (!result || result.success === false) {
      throw new Error(result && result.reason ? result.reason : 'signup_failed');
    }

    goToStep(5);
    showToast('Account na-create! Welcome, donor!', 'success');
  } catch (err) {
    console.error('signup failed', err);
    showToast('Hindi ma-save ang account. Pakisubukan muli.', 'error');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Gawin ang Account';
  }
});

// ── Offline banner ────────────────────────────────────────────────────────────
function updateOnline() { document.body.classList.toggle('offline', !navigator.onLine); }
window.addEventListener('online',  updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
