// Org Admin registration — mock OTP, no Firebase

import { showToast, setStepperState, showFieldError, clearFieldError }
  from './shared.js';

const TOTAL_STEPS = 5;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindStep1();
  bindStep2();
  bindStep3();
  bindStep4();
  setupOnline();
});

// ── Navigation ────────────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(n === 'success' ? 'step-success' : `step-${n}`);
  if (panel) panel.classList.add('active');
  if (typeof n === 'number') setStepperState(n, TOTAL_STEPS);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── STEP 1: Org Profile ───────────────────────────────────────────────────────
function bindStep1() {
  document.getElementById('btn-1-next')?.addEventListener('click', () => {
    let valid = true;

    const orgName = document.getElementById('inp-orgname')?.value.trim() ?? '';
    clearFieldError('inp-orgname', 'err-orgname');
    if (orgName.length < 2 || orgName.length > 150) {
      showFieldError('inp-orgname', 'err-orgname', 'Ang pangalan ay dapat 2–150 karakter.');
      valid = false;
    }

    const orgType = document.getElementById('inp-orgtype')?.value ?? '';
    clearFieldError('inp-orgtype', 'err-orgtype');
    if (!orgType) {
      showFieldError('inp-orgtype', 'err-orgtype', 'Pumili ng uri ng organisasyon.');
      valid = false;
    }

    const barangay = document.getElementById('inp-barangay')?.value ?? '';
    clearFieldError('inp-barangay', 'err-barangay');
    if (!barangay) {
      showFieldError('inp-barangay', 'err-barangay', 'Pumili ng barangay.');
      valid = false;
    }

    if (valid) goToStep(2);
  });
}

// ── STEP 2: Contact + OTP ────────────────────────────────────────────────────
function bindStep2() {
  const btnSend   = document.getElementById('btn-send-otp');
  const btnVerify = document.getElementById('btn-verify-otp');

  btnSend?.addEventListener('click', () => {
    let valid = true;

    const name = document.getElementById('inp-name')?.value.trim() ?? '';
    clearFieldError('inp-name', 'err-name');
    if (name.length < 3 || name.length > 100) {
      showFieldError('inp-name', 'err-name', 'Ang pangalan ay dapat 3–100 karakter.');
      valid = false;
    }

    const rawPhone = document.getElementById('inp-phone')?.value.trim() ?? '';
    clearFieldError('phone-wrap', 'err-phone');
    if (rawPhone.replace(/\D/g, '').length < 10) {
      showFieldError('phone-wrap', 'err-phone', 'Mangyaring maglagay ng tamang Philippine number.');
      valid = false;
    }

    if (!valid) return;

    const phone = '+63' + rawPhone.replace(/\D/g, '').slice(-10);
    showOtpSection(phone);
    showToast('Demo mode: gamitin ang anumang 6-digit code.', 'info');
  });

  // OTP digit auto-advance
  const otpInputs = document.querySelectorAll('.otp-input');
  otpInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.value = val;
      val ? e.target.classList.add('filled') : e.target.classList.remove('filled');
      if (val && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
      if (btnVerify) btnVerify.disabled = ![...otpInputs].every(i => i.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) otpInputs[idx - 1].focus();
    });
  });

  btnVerify?.addEventListener('click', () => {
    if (btnVerify) {
      btnVerify.innerHTML = '<span style="color:var(--color-success);">✓ Verified</span>';
      btnVerify.disabled = true;
    }
    showToast('Na-verify ang numero!', 'success');
    setTimeout(() => { goToStep(3); runDeviceCheck(); }, 800);
  });
}

function showOtpSection(phone) {
  document.getElementById('btn-send-otp')?.classList.add('hidden');
  const phoneInput = document.getElementById('inp-phone');
  if (phoneInput) phoneInput.disabled = true;
  document.getElementById('otp-section')?.classList.remove('hidden');
  const display = document.getElementById('otp-phone-display');
  if (display) display.textContent = phone;
}

// ── STEP 3: Device Check ──────────────────────────────────────────────────────
function bindStep3() {
  document.getElementById('btn-3-standard')?.addEventListener('click',  () => goToStep(4));
  document.getElementById('btn-3-use-basic')?.addEventListener('click', () => goToStep(4));
  document.getElementById('btn-3-basic')?.addEventListener('click',     () => goToStep(4));
}

async function runDeviceCheck() {
  const checking = document.getElementById('device-checking');
  const standard = document.getElementById('device-standard');
  const basic    = document.getElementById('device-basic');

  if (checking) checking.style.display = 'block';
  standard?.classList.add('hidden');
  basic?.classList.add('hidden');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    if (checking) checking.style.display = 'none';
    standard?.classList.remove('hidden');
  } catch (_) {
    if (checking) checking.style.display = 'none';
    basic?.classList.remove('hidden');
    showToast('Camera hindi available. Gagamitin ang PIN mode.', 'info');
  }
}

// ── STEP 4: Training Acknowledgment ──────────────────────────────────────────
function bindStep4() {
  const chk = document.getElementById('chk-training');
  const btn = document.getElementById('btn-submit');

  chk?.addEventListener('change', () => {
    if (btn) btn.disabled = !chk.checked;
  });

  btn?.addEventListener('click', async () => {
    if (!chk?.checked) return;
    btn.disabled = true;
    const label = document.getElementById('submit-label');
    if (label) label.innerHTML = '<span class="spinner"></span> Sine-save...';

    await new Promise(r => setTimeout(r, 1200));

    const orgName = document.getElementById('inp-orgname')?.value.trim() ?? 'Inyong Organisasyon';
    const successName = document.getElementById('success-orgname');
    if (successName) successName.textContent = orgName;

    goToStep('success');
    setStepperState(5, TOTAL_STEPS);
    showToast('Na-register ang organisasyon!', 'success');
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
