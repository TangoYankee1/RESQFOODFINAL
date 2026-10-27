import { bootGuardedPage } from './core/guard-boot.js';
import { createDonation, uploadImage, patchDocument, fetchDoc } from './core/data.js';
import { listDonationDestinations } from './core/callables.js';
import { handleError } from './core/errors.js';
import { toast } from './core/ui.js';
import { esc, compressImage } from './core/utils.js';

// ── Time guardrail map (hours) ────────────────────────────────────────────────
const MAX_HOLD_HOURS = {
  Kanin: 6, Tinapay: 6, Gulay: 4, Tinapa: 4,
  Manok: 3, Baboy: 3, Processed: 3, Other: 2,
};

// ── State ─────────────────────────────────────────────────────────────────────
let donorSession = null;   // set by the donor route guard → { user, role }
let compressedBlob = null;
let holdTimer    = null;
let submitting = false;
let postAttempt = null;

const state = {
  foodType: '', quantityKg: 0, description: '', orgId: '', orgName: '',
  pickupWindowEnd: null, pickupAddress: '', pickupWindowStart: null,
};

// ── Boot (no auth guard) ──────────────────────────────────────────────────────
function initPost(session) {
  donorSession = session;
  prefillAddress();
  initStep1();
  initStep2();
  initStep3();
  setupOnlineStatus();
  loadDestinations();
  document.getElementById('btn-retry-org')?.addEventListener('click', loadDestinations);
}

async function loadDestinations() {
  const select = document.getElementById('inp-org'), retry = document.getElementById('btn-retry-org');
  select.disabled = true;
  select.innerHTML = '<option value="">Naglo-load...</option>';
  retry.hidden = true;
  clearErr('inp-org', 'err-org');
  try {
    const result = await listDonationDestinations();
    select.innerHTML = '<option value="">Pumili ng tatanggap</option>';
    result.organizations.forEach(org => {
      const option = document.createElement('option');
      option.value = org.id; option.textContent = `${org.name} (${org.barangay})`; select.append(option);
    });
    if (!result.organizations.length) throw new Error('Wala pang aktibong organization. Makipag-ugnayan sa admin.');
    select.disabled = false;
  } catch (err) {
    select.innerHTML = '<option value="">Walang maipakitang organization</option>';
    showErr('inp-org', 'err-org', err.message?.startsWith('Wala pang') ? err.message : 'Hindi makuha ang organizations. Subukan muli.');
    retry.hidden = false;
  }
}

// Donor-only. Blocks render until auth+role resolve; redirects anonymous
// direct-URL visits to login with ?next= preserved (see core/guard-boot.js).
bootGuardedPage({ roles: ['donor'] }, initPost);

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
async function prefillAddress() {
  const el = document.getElementById('inp-pickup-addr');
  try {
    const profile = await fetchDoc(`users/${donorSession.user.uid}`);
    if (el && !el.value) el.value = profile?.address || profile?.barangay || '';
  } catch (err) { handleError(err, { scope: 'donor.post.profile' }); }

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
  hintEl.textContent = `⏱ Pickup limit para sa ${foodType}: ${maxH} oras mula sa posting. `
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
    resultEl.textContent = `✓ Pasok sa pickup policy para sa ${foodType}.`;
    if (btn) btn.disabled = false;
  } else {
    resultEl.className   = 'guardrail-warn';
    resultEl.textContent = `✕ Masyadong late ang pickup window. Ibahin ang oras ayon sa pickup policy.`;
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
  if (!qty || !Number.isFinite(Number(qty)) || Number(qty) < 0.1 || Number(qty) > 500) {
    showErr('inp-qty', 'err-qty', 'Ilagay ang tamang dami (0.1 – 500 kg).');
    valid = false;
  }

  clearErr('inp-window-end', 'err-window-end');
  if (!winEnd) {
    showErr('inp-window-end', 'err-window-end', 'Ilagay ang deadline ng pickup.');
    valid = false;
  } else {
    const maxH = MAX_HOLD_HOURS[foodType] ?? 2;
    if (!Number.isFinite(new Date(winEnd).getTime()) || new Date(winEnd) <= new Date() || new Date(winEnd) > new Date(Date.now() + maxH * 3600_000)) {
      showErr('inp-window-end', 'err-window-end',
        'Ang pickup window ay lagpas sa pickup policy para sa uri ng pagkaing ito.');
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
    const selectedOrg = document.getElementById('inp-org');
    state.orgId = selectedOrg.value;
    state.orgName = selectedOrg.selectedOptions[0]?.textContent || '';
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
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast('JPG, PNG, o WebP lamang, hanggang 10 MB bago i-compress.', 'error');
      fileInput.value = ''; return;
    }
    try {
      compressedBlob = await compressImage(file, 800);
      const url = URL.createObjectURL(compressedBlob);
      if (preview) { preview.src = url; preview.style.display = 'block'; }
      if (uploadText) uploadText.style.display = 'none';
    } catch (_) {
      compressedBlob = null;
      if (preview) preview.style.display = 'none';
      toast('Hindi mabasa ang larawan. Pumili ng ibang file.', 'error');
    }
  });
}

function validateStep2() {
  let valid = true;
  clearErr('inp-org', 'err-org');
  if (!document.getElementById('inp-org').value) { showErr('inp-org', 'err-org', 'Pumili ng aktibong tatanggap.'); valid = false; }
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
  } else if (!Number.isFinite(new Date(start).getTime()) || new Date(start).getTime() < Date.now() - 300000 || (state.pickupWindowEnd && new Date(start) >= state.pickupWindowEnd)) {
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

  chk?.addEventListener('change', () => { if (holdBtn) holdBtn.disabled = !chk.checked || submitting; });

  holdBtn?.addEventListener('mousedown',   startHold);
  holdBtn?.addEventListener('touchstart',  startHold, { passive: true });
  holdBtn?.addEventListener('mouseup',     cancelHold);
  holdBtn?.addEventListener('mouseleave',  cancelHold);
  holdBtn?.addEventListener('touchend',    cancelHold);
  holdBtn?.addEventListener('touchcancel', cancelHold);
  holdBtn?.addEventListener('keydown', event => {
    if (['Space','Enter'].includes(event.code)) { event.preventDefault(); if (!event.repeat) startHold(); }
  });
  holdBtn?.addEventListener('keyup', event => { if (['Space','Enter'].includes(event.code)) { event.preventDefault(); cancelHold(); } });
}

function startHold() {
  const btn = document.getElementById('btn-hold-submit');
  const chk = document.getElementById('chk-post-confirm');
  if (!chk?.checked || btn?.disabled) return;
  cancelHold();
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
    ['Tatanggap', state.orgName],
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

// ── Submit → create donation on the server → navigate to QR display ──────────
async function submitDonation() {
  if (submitting || !document.getElementById('chk-post-confirm')?.checked) return;
  if (!navigator.onLine) { toast('Offline ka. Kumonekta muna bago mag-post.', 'error'); return; }
  submitting = true;
  const holdBtn   = document.getElementById('btn-hold-submit');
  const holdLabel = document.getElementById('hold-label');
  if (holdBtn)  holdBtn.disabled   = true;
  if (holdLabel) holdLabel.textContent = '⏳ Sine-save...';

  try {
    // Server validates identity, destination, pickup policy, and declaration.
    const payload = {
      donorId: donorSession.user.uid,
      foodType: state.foodType,
      quantityKg: state.quantityKg,
      description: state.description,
      pickupAddress: state.pickupAddress,
      pickupWindowStart: state.pickupWindowStart,
      pickupWindowEnd: state.pickupWindowEnd,
      orgId: state.orgId, safetyDeclared: true, postingConfirmed: true,
    };
    const signature = JSON.stringify(payload);
    let attempt = postAttempt;
    if (!attempt) { try { attempt = JSON.parse(sessionStorage.getItem('donor_post_attempt')); } catch (_) {} }
    if (!attempt || attempt.signature !== signature) attempt = { signature, requestId: crypto.randomUUID() };
    postAttempt = attempt;
    try { sessionStorage.setItem('donor_post_attempt', JSON.stringify(attempt)); } catch (_) {}
    const id = await createDonation({ ...payload, requestId: attempt.requestId });

    // Optional photo: upload to the donor's own folder, then link it. A failed
    // upload must not lose the donation — warn and continue.
    if (compressedBlob) {
      try {
        const url = await uploadImage(`donation-images/${donorSession.user.uid}/${id}.jpg`, compressedBlob);
        await patchDocument(`donations/${id}`, { imageUrl: url });
      } catch (imgErr) {
        handleError(imgErr, { scope: 'donor.post.image' });
        toast('Na-save ang donation, pero hindi na-upload ang litrato.', 'warning');
      }
    }

    try { sessionStorage.removeItem('donor_post_attempt'); } catch (_) {}
    window.location.href = `qr-display.html?donationId=${encodeURIComponent(id)}`;
  } catch (err) {
    const h = handleError(err, { scope: 'donor.post.submit' });
    const reasons = {
      destination_inactive: 'Hindi na aktibo ang napiling organization. Pumili muli.',
      outside_pickup_policy: 'I-update ang pickup window; lagpas na ito sa oras ng posting.',
      invalid_pickup_window: 'Suriin ang simula at deadline ng pickup.',
      invalid_quantity: 'Ang dami ay dapat 0.1 hanggang 500 kg.',
      request_conflict: 'Nabago ang post habang nagre-retry. Bumalik sa review at subukan muli.',
    };
    toast(reasons[err.message] || h.message, 'error', 6000);
    if (holdBtn)  holdBtn.disabled   = false;
    if (holdLabel) holdLabel.textContent = '🍱 I-post ang Donation';
  } finally {
    submitting = false;
  }
}

// ── Image compression (browser-side, no upload) ───────────────────────────────


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
