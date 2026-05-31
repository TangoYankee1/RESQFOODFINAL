// Volunteer QR scanner — no Firebase, self-contained checksum validation

// ── Checksum validator (mirrors generator.js buildChecksum) ───────────────────
function verifyChecksum(p) {
  const raw = p.d + p.o + p.f + String(p.q) + 'RESQFOOD2026';
  return btoa(raw).slice(0, 4) === p.c;
}

// ── State ─────────────────────────────────────────────────────────────────────
let html5QrCode = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-start-scan')?.addEventListener('click', startScanner);
  document.getElementById('btn-cancel-scan')?.addEventListener('click', stopScanner);
  document.getElementById('btn-confirm-pickup')?.addEventListener('click', confirmPickup);
  document.getElementById('btn-scan-again')?.addEventListener('click', resetToCamera);
  document.getElementById('btn-scan-next')?.addEventListener('click', resetToStart);

  // Offline banner
  const update = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
});

// ── Start scanner ─────────────────────────────────────────────────────────────
async function startScanner() {
  show('qr-reader-wrap');
  hide('camera-prompt');
  hide('scan-result');
  hide('scan-success');

  if (typeof Html5Qrcode === 'undefined') {
    showToast('QR library hindi na-load. I-reload ang page.', 'error');
    resetToStart();
    return;
  }

  html5QrCode = new Html5Qrcode('qr-reader');

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
  };

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      () => {},   // suppress per-frame errors
    );
  } catch (err) {
    // Fallback to any available camera
    try {
      await html5QrCode.start({ facingMode: 'user' }, config, onScanSuccess, () => {});
    } catch (_) {
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

  // Validate schema fields
  if (!payload || typeof payload.d !== 'string' || typeof payload.f !== 'string') {
    showInvalidResult('Hindi kilala ang format ng QR code.');
    return;
  }

  const isValid = verifyChecksum(payload);

  // Render result card
  const badge = document.getElementById('validity-badge');
  if (badge) {
    badge.textContent = isValid ? '✓ Valid na Donation' : '✕ Hindi Valid — Baka Peke';
    badge.className   = `result-badge ${isValid ? 'valid' : 'invalid'}`;
  }

  const rows = [
    ['Donation ID',   payload.d ?? '—'],
    ['Uri ng Pagkain', payload.f ?? '—'],
    ['Dami',          `${payload.q ?? '?'} kg`],
    ['Donor ID',      payload.o ?? '—'],
    ['I-scan noong',  new Date().toLocaleString('fil', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
  ];

  const rowsEl = document.getElementById('result-rows');
  if (rowsEl) {
    rowsEl.innerHTML = rows.map(([label, value]) => `
      <div class="result-row">
        <span class="label">${label}</span>
        <span class="value">${esc(String(value))}</span>
      </div>`).join('');
  }

  const confirmBtn = document.getElementById('btn-confirm-pickup');
  if (confirmBtn) confirmBtn.disabled = !isValid;

  show('scan-result');

  if (!isValid) {
    showToast('Hindi valid ang QR. Tanungin ang donor para sa PIN.', 'error', 5000);
  }
}

function showInvalidResult(msg) {
  const badge = document.getElementById('validity-badge');
  if (badge) { badge.textContent = '✕ ' + msg; badge.className = 'result-badge invalid'; }

  const rowsEl = document.getElementById('result-rows');
  if (rowsEl) rowsEl.innerHTML = '';

  const confirmBtn = document.getElementById('btn-confirm-pickup');
  if (confirmBtn) confirmBtn.disabled = true;

  show('scan-result');
  showToast(msg, 'error', 4000);
}

// ── Confirm pickup ────────────────────────────────────────────────────────────
function confirmPickup() {
  hide('scan-result');
  show('scan-success');
  showToast('Pickup confirmed! Salamat, volunteer!', 'success');
}

// ── Reset states ──────────────────────────────────────────────────────────────
async function resetToCamera() {
  hide('scan-result');
  await startScanner();
}

async function resetToStart() {
  hide('scan-result');
  hide('scan-success');
  hide('qr-reader-wrap');
  show('camera-prompt');
  await stopScanner();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
