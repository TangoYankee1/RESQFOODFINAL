// Volunteer registration — pure UI step navigator, no Firebase
import { showFieldError, clearFieldError, showToast, setStepperState } from './shared.js';

const BARANGAYS = [
  'Lahug','Apas','Banilad','Camputhaw','Capitol Site','Carreta',
  'Cogon Ramos','Ermita','Guadalupe','Kasambagan','Mabolo',
  'Mabini','Pahina Central','Pari-an','Poblacion Pardo','Sambag I',
  'Sambag II','San Antonio','San Jose','Sta. Cruz','Sto. Niño',
  'T. Padilla','Talamban','Tejero','Tinago','Zapatera',
];

let currentStep   = 1;
let commitLevel   = null;
let selectedBrgy  = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBarangayChips();
  bindStep1();
  bindStep2();
  bindStep3();
  bindStep4();
  bindStep5();
  bindStep6();
  setupOnline();
});

// ── Step navigation ───────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step-${n === 7 ? 'success' : n}`);
  if (panel) panel.classList.add('active');
  updateStepper(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentStep = n;
}

function updateStepper(n) {
  setStepperState(n, 6);
}

// ── Step 1: Phone / OTP ───────────────────────────────────────────────────────
function bindStep1() {
  const sendBtn   = document.getElementById('v-btn-send-otp');
  const verifyBtn = document.getElementById('v-btn-verify-otp');
  const otpSec    = document.getElementById('v-otp-section');
  const resendLnk = document.getElementById('v-resend-link');

  sendBtn?.addEventListener('click', () => {
    const phone = document.getElementById('v-inp-phone').value.trim();
    clearFieldError('v-inp-phone', 'v-err-phone');
    if (!phone || !/^\d{10}$/.test(phone)) {
      showFieldError('v-inp-phone', 'v-err-phone', 'Ilagay ang valid na 10-digit na numero.');
      return;
    }
    otpSec?.classList.remove('hidden');
    sendBtn.style.display = 'none';
    showToast('Na-send ang OTP! (Demo: anumang 6 digits)', 'success');
    startOtpTimer();
  });

  verifyBtn?.addEventListener('click', () => {
    const otp = document.getElementById('v-inp-otp').value.trim();
    clearFieldError('v-inp-otp', 'v-err-otp');
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      showFieldError('v-inp-otp', 'v-err-otp', 'Ilagay ang 6-digit na code.');
      return;
    }
    goToStep(2);
  });

  resendLnk?.addEventListener('click', () => {
    showToast('Na-send muli ang OTP!', 'info');
    startOtpTimer();
  });
}

function startOtpTimer() {
  const timerEl = document.getElementById('v-otp-timer');
  if (!timerEl) return;
  let secs = 60;
  timerEl.textContent = `(${secs}s)`;
  const iv = setInterval(() => {
    secs--;
    timerEl.textContent = secs > 0 ? `(${secs}s)` : '';
    if (secs <= 0) clearInterval(iv);
  }, 1000);
}

// ── Step 2: Identity + Commitment ─────────────────────────────────────────────
function bindStep2() {
  document.getElementById('v-btn-2-back')?.addEventListener('click', () => goToStep(1));
  document.getElementById('v-btn-2-next')?.addEventListener('click', () => {
    if (!validateStep2()) return;
    const nickname = document.getElementById('v-inp-nickname').value.trim()
      || document.getElementById('v-inp-name').value.trim().split(' ')[0];
    const certEl = document.getElementById('cert-name-display');
    if (certEl) certEl.textContent = nickname;
    goToStep(3);
  });

  document.getElementById('cc-regular')?.addEventListener('click', () => selectCommit('regular'));
  document.getElementById('cc-backup')?.addEventListener('click',  () => selectCommit('backup'));
}

function selectCommit(level) {
  commitLevel = level;
  document.getElementById('cc-regular')?.classList.toggle('selected', level === 'regular');
  document.getElementById('cc-backup')?.classList.toggle('selected',  level === 'backup');
}

function validateStep2() {
  let ok = true;
  const name     = document.getElementById('v-inp-name').value.trim();
  const nickname = document.getElementById('v-inp-nickname').value.trim();

  clearFieldError('v-inp-name',     'v-err-name');
  clearFieldError('v-inp-nickname', 'v-err-nickname');

  if (!name || name.length < 3) {
    showFieldError('v-inp-name', 'v-err-name', 'Ilagay ang iyong buong pangalan (min 3 chars).');
    ok = false;
  }
  if (!nickname || nickname.length < 2) {
    showFieldError('v-inp-nickname', 'v-err-nickname', 'Ilagay ang palayaw (min 2 chars).');
    ok = false;
  }
  if (!commitLevel) {
    const e = document.getElementById('v-err-commitment');
    if (e) { e.textContent = 'Piliin ang iyong commitment level.'; e.classList.add('visible'); }
    ok = false;
  }
  return ok;
}

// ── Step 3: Availability + Barangays ─────────────────────────────────────────
function renderBarangayChips() {
  const container = document.getElementById('barangay-chips');
  if (!container) return;
  container.innerHTML = BARANGAYS.map(b => `
    <div class="barangay-chip" data-brgy="${b}">${b}</div>
  `).join('');
  container.querySelectorAll('.barangay-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleBarangay(chip));
  });
}

function toggleBarangay(chip) {
  const brgy = chip.dataset.brgy;
  if (selectedBrgy.includes(brgy)) {
    selectedBrgy = selectedBrgy.filter(b => b !== brgy);
    chip.classList.remove('selected');
  } else if (selectedBrgy.length < 10) {
    selectedBrgy.push(brgy);
    chip.classList.add('selected');
  } else {
    showToast('Maximum 10 barangays na.', 'error');
  }
}

function bindStep3() {
  document.getElementById('v-btn-3-back')?.addEventListener('click', () => goToStep(2));
  document.getElementById('v-btn-3-next')?.addEventListener('click', () => {
    if (!validateStep3()) return;
    goToStep(4);
  });
}

function validateStep3() {
  const slots    = document.querySelectorAll('.avail-grid input[type="checkbox"]:checked');
  const availErr = document.getElementById('v-err-avail');
  const brgyErr  = document.getElementById('v-err-barangay');

  if (availErr) { availErr.textContent = ''; availErr.classList.remove('visible'); }
  if (brgyErr)  { brgyErr.textContent  = ''; brgyErr.classList.remove('visible'); }

  let ok = true;
  if (slots.length === 0) {
    if (availErr) { availErr.textContent = 'Piliin ang kahit isang oras ng availability.'; availErr.classList.add('visible'); }
    ok = false;
  }
  if (selectedBrgy.length === 0) {
    if (brgyErr) { brgyErr.textContent = 'Piliin ang kahit isang barangay.'; brgyErr.classList.add('visible'); }
    ok = false;
  }
  return ok;
}

// ── Step 4: Emergency Contact ─────────────────────────────────────────────────
function bindStep4() {
  document.getElementById('v-btn-4-back')?.addEventListener('click', () => goToStep(3));
  document.getElementById('v-btn-4-next')?.addEventListener('click', () => {
    if (!validateStep4()) return;
    goToStep(5);
  });
}

function validateStep4() {
  const name  = document.getElementById('v-inp-ec-name').value.trim();
  const phone = document.getElementById('v-inp-ec-phone').value.trim();
  let ok = true;

  clearFieldError('v-inp-ec-name',  'v-err-ec-name');
  clearFieldError('v-inp-ec-phone', 'v-err-ec-phone');

  if (!name || name.length < 3) {
    showFieldError('v-inp-ec-name', 'v-err-ec-name', 'Ilagay ang pangalan ng kontak (min 3 chars).');
    ok = false;
  }
  if (!phone || !/^\d{10}$/.test(phone)) {
    showFieldError('v-inp-ec-phone', 'v-err-ec-phone', 'Ilagay ang valid na 10-digit na numero.');
    ok = false;
  }
  return ok;
}

// ── Step 5: Team Code ─────────────────────────────────────────────────────────
function bindStep5() {
  document.getElementById('v-btn-5-back')?.addEventListener('click', () => goToStep(4));
  document.getElementById('v-btn-5-next')?.addEventListener('click', () => goToStep(6));
  document.getElementById('v-skip-team')?.addEventListener('click', () => goToStep(6));
}

// ── Step 6: Certificate Preview + Submit ──────────────────────────────────────
function bindStep6() {
  document.getElementById('v-btn-6-back')?.addEventListener('click', () => goToStep(5));
  document.getElementById('v-btn-submit')?.addEventListener('click', () => {
    const btn = document.getElementById('v-btn-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Sine-save...'; }
    setTimeout(() => goToStep(7), 900);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setupOnline() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
