import { db } from '../core/firebaseConfig.js';
import { doc, setDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Phone normalization ──────────────────────────────────────────────────────
export function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0')  && digits.length === 11) return '+63' + digits.slice(1);
  if (digits.length === 10)                             return '+63' + digits;
  return '+' + digits;
}

export function isValidPHPhone(raw) {
  const normalized = normalizePhone(raw);
  return /^\+639\d{9}$/.test(normalized);
}

// ── Toast utility ────────────────────────────────────────────────────────────
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ── Atomic Firestore write with retry ────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export async function atomicWriteUserProfile(uid, data, attempt = 1) {
  try {
    await setDoc(doc(db, 'users', uid), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
      return atomicWriteUserProfile(uid, data, attempt + 1);
    }
    throw err;
  }
}

// ── Recovery screen handler ──────────────────────────────────────────────────
export function showRecoveryScreen(message, retryCallback) {
  const reg = document.getElementById('reg-main');
  if (!reg) return;

  reg.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));

  const screen = document.getElementById('recovery-screen');
  if (screen) {
    screen.classList.add('visible');
    const msgEl = document.getElementById('recovery-msg');
    if (msgEl) msgEl.textContent = message;
  }

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    const newBtn = retryBtn.cloneNode(true);
    retryBtn.parentNode.replaceChild(newBtn, retryBtn);
    newBtn.addEventListener('click', retryCallback);
  }

  const backBtn = document.getElementById('btn-recovery-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => window.location.reload());
  }
}

// ── Stepper state helper ─────────────────────────────────────────────────────
export function setStepperState(currentStep, totalSteps = 5) {
  for (let i = 1; i <= totalSteps; i++) {
    const el = document.getElementById(`si-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i < currentStep)        el.classList.add('done');
    else if (i === currentStep) el.classList.add('active');
  }
}

// ── Field validation helpers ─────────────────────────────────────────────────
export function showFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field) field.classList.add('error');
  if (error) { error.textContent = message; error.classList.add('visible'); }
  return false;
}

export function clearFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field) field.classList.remove('error');
  if (error) { error.textContent = ''; error.classList.remove('visible'); }
}
