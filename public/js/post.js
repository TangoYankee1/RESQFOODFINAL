import { auth, db } from './core/firebaseConfig.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { buildPayload, generateFallbackPin, generateUUID } from './qr/generator.js';

// ── Time Guardrail map (hours) ────────────────────────────────────────────────
const MAX_HOLD_HOURS = {
  Kanin:     6,
  Tinapay:   6,
  Gulay:     4,
  Tinapa:    4,
  Manok:     3,
  Baboy:     3,
  Processed: 3,
  Other:     2,
};

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser   = null;
let userProfile   = null;
let donationId    = generateUUID();
let compressedBlob = null;
let holdTimer      = null;

const state = {
  foodType:        '',
  quantityKg:      0,
  description:     '',
  pickupWindowEnd: null,   // Date
  pickupAddress:   '',
  pickupWindowStart: null, // Date
  photoUrl:        null,
};

// ── Auth guard ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '/register/index.html'; return; }
  currentUser = user;

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists() || snap.data().role !== 'donor') {
    window.location.href = '/register/index.html';
    return;
  }

  userProfile = snap.data();
  prefillFromProfile();
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

// ── Profile prefill ───────────────────────────────────────────────────────────
function prefillFromProfile() {
  if (!userProfile) return;
  const addr = `${userProfile.streetAddress || ''}, ${userProfile.barangay || ''}`.trim().replace(/^,\s*/, '');
  const el = document.getElementById('inp-pickup-addr');
  if (el && addr) el.value = addr;

  // Default window start = now, constrained to quarter-hour
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const startEl = document.getElementById('inp-window-start');
  if (startEl) startEl.value = toLocalDatetimeStr(now);
  startEl.min = toLocalDatetimeStr(new Date());
}

// ── STEP 1 logic ──────────────────────────────────────────────────────────────
function initStep1() {
  const foodSel   = document.getElementById('inp-food-type');
  const winEndEl  = document.getElementById('inp-window-end');
  const descEl    = document.getElementById('inp-desc');
  const descCount = document.getElementById('desc-count');

  // Character counter
  descEl?.addEventListener('input', () => {
    if (descCount) descCount.textContent = `${descEl.value.length}/300`;
  });

  // When food type changes, show the safe hold time hint
  foodSel?.addEventListener('change', () => {
    updateGuardrailInfo(foodSel.value);
    validateGuardrail(foodSel.value, winEndEl?.value);
  });

  // Set min on window-end as soon as the page loads
  const now = new Date();
  if (winEndEl) winEndEl.min = toLocalDatetimeStr(now);

  winEndEl?.addEventListener('change', () => {
    validateGuardrail(foodSel?.value, winEndEl.value);
  });

  document.getElementById('btn-p1-next')?.addEventListener('click', () => {
    if (!validateStep1()) return;
    state.foodType   = foodSel.value;
    state.quantityKg = parseFloat(document.getElementById('inp-qty').value);
    state.description = document.getElementById('inp-desc').value.trim();
    state.pickupWindowEnd = new Date(winEndEl.value);
    goToStep(2);
  });
}

function updateGuardrailInfo(foodType) {
  const infoEl  = document.getElementById('guardrail-info');
  const hintEl  = document.getElementById('guardrail-hint');
  const maxH    = MAX_HOLD_HOURS[foodType];
  if (!infoEl || !hintEl || !maxH) { infoEl?.classList.add('hidden'); return; }

  hintEl.textContent = `⏱ Ang ${foodType} ay ligtas lamang sa loob ng ${maxH} oras. `
    + `Dapat ma-pickup bago: ${formatTime(new Date(Date.now() + maxH * 3600_000))}.`;
  infoEl.classList.remove('hidden');
}

function validateGuardrail(foodType, winEndValue) {
  const resultEl  = document.getElementById('guardrail-result');
  const btn       = document.getElementById('btn-p1-next');
  if (!resultEl || !foodType || !winEndValue) return;

  const maxH          = MAX_HOLD_HOURS[foodType] ?? 2;
  const latestSafe    = new Date(Date.now() + maxH * 3600_000);
  const pickupEnd     = new Date(winEndValue);

  if (pickupEnd <= latestSafe) {
    resultEl.className  = 'guardrail-ok';
    resultEl.textContent = `✓ Ligtas ang oras na ito para sa ${foodType}.`;
    if (btn) btn.disabled = false;
  } else {
    resultEl.className  = 'guardrail-warn';
    resultEl.textContent = `✕ Masyadong late ang pickup window. Maaaring masira ang ${foodType}. `
      + `Ibahin ang oras o itapon na lamang para sa kaligtasan.`;
    if (btn) btn.disabled = true;
  }
}

function validateStep1() {
  let valid = true;
  const foodType = document.getElementById('inp-food-type').value;
  const qty      = document.getElementById('inp-qty').value;
  const winEnd   = document.getElementById('inp-window-end').value;

  clearErr('inp-food-type', 'err-food-type');
  if (!foodType) {
    showErr('inp-food-type', 'err-food-type', 'Piliin ang uri ng pagkain.');
    valid = false;
  }

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
    const maxH       = MAX_HOLD_HOURS[foodType] ?? 2;
    const latestSafe = new Date(Date.now() + maxH * 3600_000);
    if (new Date(winEnd) > latestSafe) {
      showErr('inp-window-end', 'err-window-end',
        'Ang pickup window ay lagpas sa ligtas na oras para sa uri ng pagkaing ito.');
      valid = false;
    }
  }

  return valid;
}

// ── STEP 2 logic ──────────────────────────────────────────────────────────────
function initStep2() {
  document.getElementById('btn-p2-back')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-p2-next')?.addEventListener('click', () => {
    if (!validateStep2()) return;
    state.pickupAddress    = document.getElementById('inp-pickup-addr').value.trim();
    state.pickupWindowStart = new Date(document.getElementById('inp-window-start').value);
    goToStep(3);
    buildReviewSummary();
  });

  // Update the "end" display badge whenever step 1 values are set
  const endDisplay = document.getElementById('window-end-display');
  if (endDisplay && state.pickupWindowEnd) {
    endDisplay.textContent = formatTime(state.pickupWindowEnd);
  }

  // Constrain window-start min to now
  const startEl = document.getElementById('inp-window-start');
  if (startEl) startEl.min = toLocalDatetimeStr(new Date());

  // Photo upload + client-side compression
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

// ── STEP 3 logic ──────────────────────────────────────────────────────────────
function initStep3() {
  document.getElementById('btn-p3-back')?.addEventListener('click', () => goToStep(2));

  const chk     = document.getElementById('chk-post-confirm');
  const holdBtn = document.getElementById('btn-hold-submit');

  chk?.addEventListener('change', () => {
    if (holdBtn) holdBtn.disabled = !chk.checked;
  });

  // Hold-to-confirm: press and hold 3s
  holdBtn?.addEventListener('mousedown',  startHold);
  holdBtn?.addEventListener('touchstart', startHold, { passive: true });
  holdBtn?.addEventListener('mouseup',    cancelHold);
  holdBtn?.addEventListener('mouseleave', cancelHold);
  holdBtn?.addEventListener('touchend',   cancelHold);
  holdBtn?.addEventListener('touchcancel', cancelHold);
}

function startHold(e) {
  const btn  = document.getElementById('btn-hold-submit');
  const fill = document.getElementById('hold-fill');
  const chk  = document.getElementById('chk-post-confirm');
  if (!chk?.checked || btn?.disabled) return;

  btn.classList.add('holding');
  holdTimer = setTimeout(() => {
    btn.classList.remove('holding');
    submitDonation();
  }, 3000);
}

function cancelHold() {
  const btn  = document.getElementById('btn-hold-submit');
  const fill = document.getElementById('hold-fill');
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  btn?.classList.remove('holding');
}

function buildReviewSummary() {
  const container = document.getElementById('review-summary');
  if (!container) return;

  const maxH      = MAX_HOLD_HOURS[state.foodType] ?? 2;
  const safeExpiry = new Date(Date.now() + maxH * 3600_000);

  const expiryEl = document.getElementById('expiry-display');
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

// ── Submission ────────────────────────────────────────────────────────────────
async function submitDonation() {
  const holdBtn   = document.getElementById('btn-hold-submit');
  const holdLabel = document.getElementById('hold-label');
  if (holdBtn) holdBtn.disabled = true;
  if (holdLabel) holdLabel.textContent = '⏳ Sine-save...';

  try {
    const photoUrl = null;

    const fallbackPin = generateFallbackPin();
    const qrPayload   = buildPayload(donationId, currentUser.uid, state.foodType, state.quantityKg);

    const donationData = {
      donationId,
      donorId:          currentUser.uid,
      foodType:         state.foodType,
      quantityKg:       state.quantityKg,
      description:      state.description,
      pickupAddress:    state.pickupAddress,
      pickupWindowStart: state.pickupWindowStart
        ? { seconds: Math.floor(state.pickupWindowStart.getTime() / 1000) }
        : null,
      pickupWindowEnd: state.pickupWindowEnd
        ? { seconds: Math.floor(state.pickupWindowEnd.getTime() / 1000) }
        : null,
      photoUrl,
      qrCodeData:       qrPayload,
      fallbackPin,
      status:           'pending',
      safetyDeclared:   true,
      postingConfirmed: true,
      statusHistory: [{
        status:    'pending',
        timestamp: new Date().toISOString(),
        actorId:   currentUser.uid,
        actorRole: 'donor',
      }],
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'donations', donationId), donationData);

    // Mark onboardingComplete on first donation
    if (userProfile && !userProfile.onboardingComplete) {
      await import('./core/firebaseConfig.js').then(({ db: fdb }) =>
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js').then(
          ({ updateDoc, doc: fDoc }) =>
            updateDoc(fDoc(fdb, 'users', currentUser.uid), { onboardingComplete: true })
        )
      );
    }

    // Redirect to QR display
    sessionStorage.setItem('qr_payload',   qrPayload);
    sessionStorage.setItem('qr_pin',       fallbackPin);
    sessionStorage.setItem('qr_food_type', state.foodType);
    sessionStorage.setItem('qr_qty',       String(state.quantityKg));
    sessionStorage.setItem('qr_donation_id', donationId);
    window.location.href = 'qr-display.html';

  } catch (err) {
    console.error('Donation submit error:', err);
    if (holdBtn)  { holdBtn.disabled = false; }
    if (holdLabel) holdLabel.textContent = '🍱 I-post ang Donation';
    showToast('Hindi ma-submit. Subukan muli kapag may koneksyon.', 'error');
  }
}

// ── Image compression ─────────────────────────────────────────────────────────
function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas empty')),
          'image/jpeg', 0.82);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function toLocalDatetimeStr(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('fil', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  return date.toLocaleString('fil', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function setupOnlineStatus() {
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}
