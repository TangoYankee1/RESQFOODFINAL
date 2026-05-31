// LGU Admin registration — mock validation, no Firebase

import { showToast, setStepperState, showFieldError, clearFieldError }
  from './shared.js';

const TOTAL_STEPS = 5;

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

// ── STEP 1: Token ─────────────────────────────────────────────────────────────
function bindStep1() {
  document.getElementById('btn-1-next')?.addEventListener('click', () => {
    let valid = true;

    const token = document.getElementById('inp-token')?.value.trim() ?? '';
    clearFieldError('inp-token', 'err-token');
    if (token.length < 6) {
      showFieldError('inp-token', 'err-token', 'Ang token ay dapat may 6+ karakter.');
      valid = false;
    }

    const barangay = document.getElementById('inp-barangay-lgu')?.value ?? '';
    clearFieldError('inp-barangay-lgu', 'err-barangay-lgu');
    if (!barangay) {
      showFieldError('inp-barangay-lgu', 'err-barangay-lgu', 'Pumili ng barangay.');
      valid = false;
    }

    if (!valid) return;
    showToast('Token validated! (Demo mode)', 'success');
    goToStep(2);
  });
}

// ── STEP 2: Gov Email ─────────────────────────────────────────────────────────
function bindStep2() {
  document.getElementById('btn-send-email-verify')?.addEventListener('click', () => {
    let valid = true;

    const email = document.getElementById('inp-gov-email')?.value.trim() ?? '';
    clearFieldError('inp-gov-email', 'err-gov-email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('inp-gov-email', 'err-gov-email', 'Mangyaring maglagay ng valid na email address.');
      valid = false;
    }

    const name = document.getElementById('inp-fullname')?.value.trim() ?? '';
    clearFieldError('inp-fullname', 'err-fullname');
    if (name.length < 3) {
      showFieldError('inp-fullname', 'err-fullname', 'Ang pangalan ay dapat 3+ karakter.');
      valid = false;
    }

    const designation = document.getElementById('inp-designation')?.value.trim() ?? '';
    clearFieldError('inp-designation', 'err-designation');
    if (!designation) {
      showFieldError('inp-designation', 'err-designation', 'Ilagay ang inyong posisyon.');
      valid = false;
    }

    if (!valid) return;

    const display = document.getElementById('email-display');
    if (display) display.textContent = email;

    document.getElementById('btn-send-email-verify')?.classList.add('hidden');
    document.getElementById('email-otp-section')?.classList.remove('hidden');
    showToast('Demo mode: i-click ang "Email Verified" para ituloy.', 'info');
  });

  document.getElementById('btn-verify-email')?.addEventListener('click', () => {
    showToast('Email verified!', 'success');
    goToStep(3);
  });
}

// ── STEP 3: File Upload + Password ────────────────────────────────────────────
function bindStep3() {
  const fileInput  = document.getElementById('file-input');
  const uploadArea = document.getElementById('file-upload-area');
  const fileIcon   = document.getElementById('file-icon');
  const placeholder = document.getElementById('file-placeholder');
  const selectedName = document.getElementById('file-selected-name');

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    uploadArea?.classList.add('file-selected');
    if (fileIcon) fileIcon.textContent = '✅';
    placeholder?.classList.add('hidden');
    if (selectedName) {
      selectedName.textContent = file.name;
      selectedName.classList.remove('hidden');
    }
    clearFieldError('file-upload-area', 'err-file');
    showToast('File na-select: ' + file.name, 'success');
  });

  // Password policy check
  const pwInput = document.getElementById('inp-password');
  pwInput?.addEventListener('input', () => checkPasswordPolicy(pwInput.value));

  document.getElementById('btn-toggle-pw')?.addEventListener('click', () => {
    if (!pwInput) return;
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-3-next')?.addEventListener('click', () => {
    let valid = true;

    const file = fileInput?.files?.[0];
    clearFieldError('file-upload-area', 'err-file');
    if (!file) {
      showFieldError('file-upload-area', 'err-file', 'Kailangan ng authorization letter.');
      valid = false;
    }

    const pw = pwInput?.value ?? '';
    clearFieldError('inp-password', 'err-password');
    if (!isStrongPassword(pw)) {
      showFieldError('inp-password', 'err-password', 'Hindi pa natutugunan ang lahat ng password requirements.');
      valid = false;
    }

    if (valid) goToStep(4);
  });
}

function checkPasswordPolicy(pw) {
  const set = (id, pass) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `policy-item ${pass ? 'pass' : 'pi'}`;
    el.textContent = el.textContent;
  };
  set('pol-len',   pw.length >= 12);
  set('pol-upper', /[A-Z]/.test(pw));
  set('pol-num',   /[0-9]/.test(pw));
  set('pol-sym',   /[^A-Za-z0-9]/.test(pw));
}

function isStrongPassword(pw) {
  return pw.length >= 12 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

// ── STEP 4: MFA + Audit Acknowledgment ───────────────────────────────────────
function bindStep4() {
  // MFA
  document.getElementById('btn-send-mfa')?.addEventListener('click', () => {
    const raw = document.getElementById('inp-mfa-phone')?.value.replace(/\D/g, '') ?? '';
    if (raw.length < 10) {
      showToast('Ilagay ang valid na numero.', 'error');
      return;
    }
    document.getElementById('btn-send-mfa')?.classList.add('hidden');
    document.getElementById('mfa-otp-section')?.classList.remove('hidden');
    showToast('Demo: i-type ang anumang 6-digit code.', 'info');
  });

  const otpInputs = document.querySelectorAll('.otp-input');
  otpInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.value = val;
      val ? e.target.classList.add('filled') : e.target.classList.remove('filled');
      if (val && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
      const mfaVerify = document.getElementById('btn-verify-mfa');
      if (mfaVerify) mfaVerify.disabled = ![...otpInputs].every(i => i.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) otpInputs[idx - 1].focus();
    });
  });

  document.getElementById('btn-verify-mfa')?.addEventListener('click', () => {
    const mfaSection = document.getElementById('mfa-otp-section');
    if (mfaSection) {
      mfaSection.innerHTML = '<div style="color:var(--color-success); font-weight:700;">✅ MFA Enrolled — Secure na ang account!</div>';
    }
    enableAuditScroll();
    showToast('MFA enrolled!', 'success');
  });

  // Audit scroll gate
  const chk = document.getElementById('chk-audit');
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

    const barangay = document.getElementById('inp-barangay-lgu')?.value ?? 'Barangay';
    const successBgy = document.getElementById('success-barangay');
    if (successBgy) successBgy.textContent = 'Brgy. ' + barangay;

    goToStep('success');
    setStepperState(5, TOTAL_STEPS);
    showToast('LGU Admin account activated!', 'success');
  });
}

function enableAuditScroll() {
  const box = document.getElementById('audit-scroll-box');
  const chk = document.getElementById('chk-audit');
  const hint = document.getElementById('scroll-hint');

  if (!box || !chk) return;

  const checkScrolled = () => {
    const scrolled = box.scrollTop + box.clientHeight >= box.scrollHeight - 10;
    if (scrolled) {
      chk.disabled = false;
      if (hint) hint.style.display = 'none';
    }
  };

  box.addEventListener('scroll', checkScrolled);
  checkScrolled();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
