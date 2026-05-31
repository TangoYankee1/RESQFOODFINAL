import { buildPayload, generateFallbackPin, generateUUID } from './qr/generator.js';

// ── Time guardrail map (hours) ────────────────────────────────────────────────
const MAX_HOLD_HOURS = {
  Kanin: 6, Tinapay: 6, Gulay: 4, Tinapa: 4,
  Manok: 3, Baboy: 3, Processed: 3, Other: 2,
};

// ── State ─────────────────────────────────────────────────────────────────────
const DONOR_ID   = 'DEMO_DONOR';
let donationId   = generateUUID();
let compressedBlob = null;
let holdTimer    = null;

const state = {
  foodType: '', quantityKg: 0, description: '',
  pickupWindowEnd: null, pickupAddress: '', pickupWindowStart: null,
};

// ── Boot (no auth guard) ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  prefillAddress();
  initStep1();
  initStep2();
  initStep3();
  setupOnlineStatus();
});

// ── Step helpers ──────────────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`post-step-${n}`)?.classList.add('active');
  updateStepper(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepper(current) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`psi-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < current)       el.classList.add('done');
    else if (i === current) el.classList.add('active');
  }
}

// ── Address prefill (hardcoded for demo) ──────────────────────────────────────
function prefillAddress() {
  const el = document.getElementById('inp-pickup-addr');
  if (el && !el.value) el.value = 'Lahug, Cebu City';

  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const startEl = document.getElementById('inp-window-start');
  if (startEl) { startEl.value = toLocalDatetimeStr(now); startEl.min = toLocalDatetimeStr(new Date()); }
}

// ── STEP 1 ────────────────────────────────────────────────────────────────────
function initStep1() {
  const foodSel  = document.getElementById('inp-food-type');
  const winEndEl = document.getElementById('inp-window-end');
  const descEl   = document.getElementById('inp-desc');
  const descCount = document.getElementById('desc-count');

  descEl?.addEventListener('input', () => {
    if (descCount) descCount.textContent = `${descEl.value.length}/300`;
  });

  foodSel?.addEventListener('change', () => {
    updateGuardrailInfo(foodSel.value);
    validateGuardrail(foodSel.value, winEndEl?.value);
  });

  if (winEndEl) winEndEl.min = toLocalDatetimeStr(new Date());
  winEndEl?.addEventListener('change', () => validateGuardrail(foodSel?.value, winEndEl.value));

  document.getElementById('btn-p1-next')?.addEventListener('click', () => {
    if (!validateStep1()) return;
    state.foodType       = foodSel.value;
    state.quantityKg     = parseFloat(document.getElementById('inp-qty').value);
    state.description    = document.getElementById('inp-desc').value.trim();
    state.pickupWindowEnd = new Date(winEndEl.value);
    goToStep(2);
  });
}

function updateGuardrailInfo(foodType) {
  const infoEl = document.getElementById('guardrail-info');
  const hintEl = document.getElementById('guardrail-hint');
  const maxH   = MAX_HOLD_HOURS[foodType];
  if (!infoEl || !hintEl || !maxH) { infoEl?.classList.add('hidden'); return; }
  hintEl.textContent = `⏱ Ang ${foodType} ay ligtas lamang sa loob ng ${maxH} oras. `
    + `Dapat ma-pickup bago: ${formatTime(new Date(Date.now() + maxH * 3600_000))}.`;
  infoEl.classList.remove('hidden');
}

function validateGuardrail(foodType, winEndValue) {
  const resultEl = document.getElementById('guardrail-result');
  const btn      = document.getElementById('btn-p1-next');
  if (!resultEl || !foodType || !winEndValue) return;

  const maxH       = MAX_HOLD_HOURS[foodType] ?? 2;
  const latestSafe = new Date(Date.now() + maxH * 3600_000);
  const pickupEnd  = new Date(winEndValue);

  if (pickupEnd <= latestSafe) {
    resultEl.className   = 'guardrail-ok';
    resultEl.textContent = `✓ Ligtas ang oras na ito para sa ${foodType}.`;
    if (btn) btn.disabled = false;
  } else {
    resultEl.className   = 'guardrail-warn';
    resultEl.textContent = `✕ Masyadong late ang pickup window. Ibahin ang oras para sa kaligtasan.`;
    if (btn) btn.disabled = true;
  }
}

function validateStep1() {
  let valid = true;
  const foodType = document.getElementById('inp-food-type').value;
  const qty      = document.getElementById('inp-qty').value;
  const winEnd   = document.getElementById('inp-window-end').value;

  clearErr('inp-food-type', 'err-food-type');
  if (!foodType) { showErr('inp-food-type', 'err-food-type', 'Piliin ang uri ng pagkain.'); valid = false; }

  clearErr('inp-qty', 'err-qty');
  if (!qty || parseFloat(qty) <= 0 || parseFloat(qty) > 500) {
    showErr('inp-qty', 'err-qty', 'Ilagay ang tamang dami (0.1 – 500 kg).');
    valid = false;
  }

  clearErr('inp-window-end', 'err-window-end');
  if (!winEnd) {
    showErr('inp-window-end', 'err-window-end', 'Ilagay ang deadline ng pickup.');
    valid = false;
  } else {
    const maxH = MAX_HOLD_HOURS[foodType] ?? 2;
    if (new Date(winEnd) > new Date(Date.now() + maxH * 3600_000)) {
      showErr('inp-window-end', 'err-window-end',
        'Ang pickup window ay lagpas sa ligtas na oras para sa uri ng pagkaing ito.');
      valid = false;
    }
  }
  return valid;
}

// ── STEP 2 ────────────────────────────────────────────────────────────────────
function initStep2() {
  document.getElementById('btn-p2-back')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-p2-next')?.addEventListener('click', () => {
    if (!validateStep2()) return;
    state.pickupAddress    = document.getElementById('inp-pickup-addr').value.trim();
    state.pickupWindowStart = new Date(document.getElementById('inp-window-start').value);
    goToStep(3);
    buildReviewSummary();
  });

  const startEl = document.getElementById('inp-window-start');
  if (startEl) startEl.min = toLocalDatetimeStr(new Date());

  // Photo preview (browser FileReader — no upload needed)
  const uploadArea = document.getElementById('photo-upload-area');
  const fileInput  = document.getElementById('inp-photo');
  const preview    = document.getElementById('photo-preview');
  const uploadText = document.getElementById('photo-upload-text');

  uploadArea?.addEventListener('click', () => fileInput?.click());
  uploadArea?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      compressedBlob = await compressImage(file, 800);
      const url = URL.createObjectURL(compressedBlob);
      if (preview) { preview.src = url; preview.style.display = 'block'; }
      if (uploadText) uploadText.style.display = 'none';
    } catch (_) {
      compressedBlob = file;
    }
  });
}

function validateStep2() {
  let valid = true;
  const addr  = document.getElementById('inp-pickup-addr').value.trim();
  const start = document.getElementById('inp-window-start').value;

  clearErr('inp-pickup-addr', 'err-pickup-addr');
  if (!addr || addr.length < 5) {
    showErr('inp-pickup-addr', 'err-pickup-addr', 'Ilagay ang mas detalyadong address.');
    valid = false;
  }

  clearErr('inp-window-start', 'err-window-start');
  if (!start) {
    showErr('inp-window-start', 'err-window-start', 'Ilagay ang oras ng simula ng pickup.');
    valid = false;
  } else if (state.pickupWindowEnd && new Date(start) >= state.pickupWindowEnd) {
    showErr('inp-window-start', 'err-window-start',
      'Ang simula ay dapat mas maaga kaysa sa deadline ng pickup.');
    valid = false;
  }
  return valid;
}

// ── STEP 3 ────────────────────────────────────────────────────────────────────
function initStep3() {
  document.getElementById('btn-p3-back')?.addEventListener('click', () => goToStep(2));

  const chk     = document.getElementById('chk-post-confirm');
  const holdBtn = document.getElementById('btn-hold-submit');

  chk?.addEventListener('change', () => { if (holdBtn) holdBtn.disabled = !chk.checked; });

  holdBtn?.addEventListener('mousedown',   startHold);
  holdBtn?.addEventListener('touchstart',  startHold, { passive: true });
  holdBtn?.addEventListener('mouseup',     cancelHold);
  holdBtn?.addEventListener('mouseleave',  cancelHold);
  holdBtn?.addEventListener('touchend',    cancelHold);
  holdBtn?.addEventListener('touchcancel', cancelHold);
}

function startHold() {
  const btn = document.getElementById('btn-hold-submit');
  const chk = document.getElementById('chk-post-confirm');
  if (!chk?.checked || btn?.disabled) return;
  btn.classList.add('holding');
  holdTimer = setTimeout(() => {
    btn.classList.remove('holding');
    submitDonation();
  }, 3000);
}

function cancelHold() {
  const btn = document.getElementById('btn-hold-submit');
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  btn?.classList.remove('holding');
}

function buildReviewSummary() {
  const container = document.getElementById('review-summary');
  if (!container) return;

  const maxH       = MAX_HOLD_HOURS[state.foodType] ?? 2;
  const safeExpiry = new Date(Date.now() + maxH * 3600_000);
  const expiryEl   = document.getElementById('expiry-display');
  if (expiryEl) expiryEl.textContent = formatDateTime(safeExpiry);

  const endDisplay = document.getElementById('window-end-display');
  if (endDisplay) endDisplay.textContent = state.pickupWindowEnd ? formatTime(state.pickupWindowEnd) : '—';

  const rows = [
    ['Uri ng Pagkain',   state.foodType],
    ['Dami',             `${state.quantityKg} kg`],
    ['Paglalarawan',     state.description || '(walang paglalarawan)'],
    ['Pickup Address',   state.pickupAddress],
    ['Simula ng Pickup', state.pickupWindowStart ? formatDateTime(state.pickupWindowStart) : '—'],
    ['Deadline',         state.pickupWindowEnd   ? formatDateTime(state.pickupWindowEnd)   : '—'],
    ['Litrato',          compressedBlob ? 'Naka-attach (lokal) ✓' : 'Wala'],
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="review-row">
      <span class="label">${label}</span>
      <span class="value">${esc(String(value))}</span>
    </div>`).join('');
}

// ── Submit → write to sessionStorage → navigate to QR display ────────────────
function submitDonation() {
  const holdBtn   = document.getElementById('btn-hold-submit');
  const holdLabel = document.getElementById('hold-label');
  if (holdBtn)  holdBtn.disabled   = true;
  if (holdLabel) holdLabel.textContent = '⏳ Sine-save...';

  const fallbackPin = generateFallbackPin();
  const qrPayload   = buildPayload(donationId, DONOR_ID, state.foodType, state.quantityKg);

  sessionStorage.setItem('qr_payload',     qrPayload);
  sessionStorage.setItem('qr_pin',         fallbackPin);
  sessionStorage.setItem('qr_food_type',   state.foodType);
  sessionStorage.setItem('qr_qty',         String(state.quantityKg));
  sessionStorage.setItem('qr_donation_id', donationId);

  window.location.href = 'qr-display.html';
}

// ── Image compression (browser-side, no upload) ───────────────────────────────
function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload  = () => {
        const ratio   = Math.min(1, maxWidth / img.width);
        const canvas  = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Canvas empty')),
          'image/jpeg', 0.82,
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function toLocalDatetimeStr(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`
    + `T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('fil', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  return date.toLocaleString('fil', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showErr(fieldId, errId, msg) {
  const f = document.getElementById(fieldId);
  const e = document.getElementById(errId);
  if (f) f.classList.add('error');
  if (e) { e.textContent = msg; e.classList.add('visible'); }
}

function clearErr(fieldId, errId) {
  const f = document.getElementById(fieldId);
  const e = document.getElementById(errId);
  if (f) f.classList.remove('error');
  if (e) { e.textContent = ''; e.classList.remove('visible'); }
}

function setupOnlineStatus() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
