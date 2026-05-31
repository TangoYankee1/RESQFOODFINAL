// Org Admin QR scanner — verifies food delivery receipt (mirrors volunteer scanner.js)
// Uses same checksum as volunteer pickup; org admin confirms received end.

// ── Checksum validator (mirrors generator.js buildChecksum) ───────────────────
function verifyChecksum(p) {
  const raw = p.d + p.o + p.f + String(p.q) + 'RESQFOOD2026';
  return btoa(raw).slice(0, 4) === p.c;
}

// ── Demo PINs for Basic Mode prototype ────────────────────────────────────────
const DEMO_PINS = { 'DON-2026-0041': '7834', 'DON-2026-0042': '2291' };
const FALLBACK_VALID_PIN = '1234'; // always-valid pin for demo

// ── State ─────────────────────────────────────────────────────────────────────
let html5QrCode = null;
let lastPayload = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-back')?.addEventListener('click', () => {
    stopScanner().then(() => history.back());
  });

  // Mode toggle
  document.getElementById('btn-mode-qr')?.addEventListener('click',  () => switchMode('qr'));
  document.getElementById('btn-mode-pin')?.addEventListener('click', () => switchMode('pin'));

  // QR mode buttons
  document.getElementById('btn-start-scan')?.addEventListener('click',    startScanner);
  document.getElementById('btn-cancel-scan')?.addEventListener('click',   () => { stopScanner(); resetToStart(); });
  document.getElementById('btn-confirm-verify')?.addEventListener('click', confirmVerify);
  document.getElementById('btn-scan-again')?.addEventListener('click',    () => { hide('scan-result'); startScanner(); });
  document.getElementById('btn-verify-next')?.addEventListener('click',   resetAll);

  // PIN mode
  setupPinInputs();
  document.getElementById('btn-confirm-pin')?.addEventListener('click', confirmPinVerify);

  // Offline banner
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
});

// ── Mode switch ───────────────────────────────────────────────────────────────
function switchMode(mode) {
  const isQr = mode === 'qr';

  document.getElementById('btn-mode-qr')?.classList.toggle('active', isQr);
  document.getElementById('btn-mode-pin')?.classList.toggle('active', !isQr);

  isQr ? show('qr-mode') : hide('qr-mode');
  isQr ? hide('pin-mode') : show('pin-mode');

  if (!isQr) {
    stopScanner();
    resetToStart();
  }
}

// ── Start scanner ─────────────────────────────────────────────────────────────
async function startScanner() {
  show('qr-reader-wrap');
  hide('camera-prompt');
  hide('scan-result');
  hide('verify-success');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('QR library hindi na-load. I-reload ang page.', 'error');
    resetToStart();
    return;
  }

  html5QrCode = new Html5Qrcode('qr-reader');

  const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

  try {
    await html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
  } catch (_) {
    try {
      await html5QrCode.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
    } catch (__) {
      showToast('Hindi ma-access ang camera. I-allow ang camera permission.', 'error');
      resetToStart();
    }
  }
}

// ── Stop scanner ──────────────────────────────────────────────────────────────
async function stopScanner() {
  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch (_) {}
    html5QrCode = null;
  }
}

// ── On successful QR decode ───────────────────────────────────────────────────
async function onScanSuccess(decodedText) {
  await stopScanner();
  hide('qr-reader-wrap');

  let payload;
  try {
    payload = JSON.parse(decodedText);
  } catch (_) {
    showInvalidResult('Hindi ma-parse ang QR. Hindi ito isang ResQFood QR code.');
    return;
  }

  if (!payload || typeof payload.d !== 'string' || typeof payload.f !== 'string') {
    showInvalidResult('Hindi kilala ang format ng QR code.');
    return;
  }

  const isValid = verifyChecksum(payload);
  lastPayload = isValid ? payload : null;

  const badge = document.getElementById('validity-badge');
  if (badge) {
    badge.textContent = isValid ? '✓ Valid na Delivery' : '✕ Hindi Valid — Baka Peke';
    badge.className   = `result-badge ${isValid ? 'valid' : 'invalid'}`;
  }

  const rows = [
    ['Donation ID',    payload.d ?? '—'],
    ['Uri ng Pagkain', payload.f ?? '—'],
    ['Dami',           `${payload.q ?? '?'} kg`],
    ['Donor ID',       payload.o ?? '—'],
    ['Na-scan noong',  new Date().toLocaleString('fil', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
  ];

  const rowsEl = document.getElementById('result-rows');
  if (rowsEl) {
    rowsEl.innerHTML = rows.map(([label, value]) => `
      <div class="result-row">
        <span class="label">${label}</span>
        <span class="value">${esc(String(value))}</span>
      </div>`).join('');
  }

  const confirmBtn = document.getElementById('btn-confirm-verify');
  if (confirmBtn) confirmBtn.disabled = !isValid;

  show('scan-result');

  if (!isValid) {
    showToast('Hindi valid ang QR. Subukan ang PIN mode.', 'error', 5000);
  }
}

function showInvalidResult(msg) {
  const badge = document.getElementById('validity-badge');
  if (badge) { badge.textContent = '✕ ' + msg; badge.className = 'result-badge invalid'; }
  const rowsEl = document.getElementById('result-rows');
  if (rowsEl) rowsEl.innerHTML = '';
  const confirmBtn = document.getElementById('btn-confirm-verify');
  if (confirmBtn) confirmBtn.disabled = true;
  show('scan-result');
  showToast(msg, 'error', 4000);
}

// ── Confirm verify (QR mode) ──────────────────────────────────────────────────
function confirmVerify() {
  hide('scan-result');

  const summary = document.getElementById('success-summary');
  if (summary && lastPayload) {
    summary.innerHTML = `
      <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0; font-size:.85rem;">
        <span style="color:var(--color-muted);">Pagkain</span>
        <strong>${esc(lastPayload.f)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0; font-size:.85rem;">
        <span style="color:var(--color-muted);">Dami</span>
        <strong>${esc(String(lastPayload.q))} kg</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0; font-size:.85rem;">
        <span style="color:var(--color-muted);">Na-verify noong</span>
        <strong>${new Date().toLocaleString('fil', { hour: '2-digit', minute: '2-digit' })}</strong>
      </div>`;
  }

  show('verify-success');
  showToast('Na-verify na ang delivery! Salamat!', 'success');
}

// ── PIN mode ──────────────────────────────────────────────────────────────────
function setupPinInputs() {
  const inputs = document.querySelectorAll('.pin-digit');
  const confirmBtn = document.getElementById('btn-confirm-pin');

  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.value = val;
      val ? e.target.classList.add('filled') : e.target.classList.remove('filled');
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();

      const allFilled = [...inputs].every(i => i.value);
      if (confirmBtn) confirmBtn.disabled = !allFilled;

      const errEl = document.getElementById('pin-error');
      if (errEl) errEl.textContent = '';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
    });
  });
}

function confirmPinVerify() {
  const inputs  = document.querySelectorAll('.pin-digit');
  const entered = [...inputs].map(i => i.value).join('');
  const errEl   = document.getElementById('pin-error');

  const isValid = entered === FALLBACK_VALID_PIN
    || Object.values(DEMO_PINS).includes(entered);

  if (!isValid) {
    if (errEl) errEl.textContent = 'Maling PIN. Subukan muli o humingi ng bagong PIN sa volunteer.';
    inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
    inputs[0]?.focus();
    showToast('Maling PIN. Subukan muli.', 'error');
    return;
  }

  const summary = document.getElementById('success-summary');
  if (summary) {
    summary.innerHTML = `
      <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0; font-size:.85rem;">
        <span style="color:var(--color-muted);">Mode</span>
        <strong>PIN Verification</strong>
      </div>
      <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0; font-size:.85rem;">
        <span style="color:var(--color-muted);">Na-verify noong</span>
        <strong>${new Date().toLocaleString('fil', { hour: '2-digit', minute: '2-digit' })}</strong>
      </div>`;
  }

  hide('pin-mode');
  show('verify-success');
  showToast('Na-verify na ang delivery gamit ang PIN!', 'success');
}

// ── Reset states ──────────────────────────────────────────────────────────────
function resetToStart() {
  hide('scan-result');
  hide('qr-reader-wrap');
  show('camera-prompt');
  lastPayload = null;
}

function resetAll() {
  hide('verify-success');
  lastPayload = null;

  // Reset PIN inputs
  document.querySelectorAll('.pin-digit').forEach(i => {
    i.value = '';
    i.classList.remove('filled');
  });
  const errEl = document.getElementById('pin-error');
  if (errEl) errEl.textContent = '';
  const confirmPin = document.getElementById('btn-confirm-pin');
  if (confirmPin) confirmPin.disabled = true;

  // Return to active mode
  const isQrActive = document.getElementById('btn-mode-qr')?.classList.contains('active');
  if (isQrActive) {
    show('qr-mode');
    resetToStart();
  } else {
    show('pin-mode');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className   = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}
