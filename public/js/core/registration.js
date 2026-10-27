// public/js/core/registration.js — part 1/2: role configs + consent + steps.
import { normalizePhone, isValidPHPhone, isOtpLocked, config } from './auth.js';
import { t } from './i18n.js';

export const ROLE_CONFIGS = {
  donor: { steps: ['otp', 'identity', 'donorType', 'consent', 'done'], consentKinds: ['safety', 'privacy'], home: '/donor/index.html', signupFn: 'signupWithProfile' },
  volunteer: { steps: ['otp', 'identity', 'availability', 'documents', 'consent', 'done'], consentKinds: ['responsibility', 'privacy'], home: '/volunteer/index.html', signupFn: 'signupVolunteerWithProfile' },
  orgAdmin: { steps: ['otp', 'orgProfile', 'verifiers', 'device', 'consent', 'done'], consentKinds: ['training', 'verification', 'privacy'], home: '/org-admin/index.html', signupFn: 'signupOrgAdminWithProfile' },
  lguAdmin: { steps: ['invite', 'otp', 'identity', 'documents', 'consent', 'done'], consentKinds: ['audit', 'privacy'], home: '/admin/index.html', signupFn: 'signupWithProfile', inviteRequired: true },
};

const OTP_CODE_RE = /^\d{6}$/;
export const isOtpCode = (code) => OTP_CODE_RE.test(String(code || ''));

/** SHA-256 hex of the consent text (immutable version pin). */
export async function hashConsentText(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Record consent server-side (RA 10173: text hash + IP + UA stored by fn). */
export async function recordConsent({ kind, version, textHash }) {
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js');
  const { app } = await import('./firebaseConfig.js');
  const functions = getFunctions(app);
  if ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') && !functions._consentEmu) {
    try { connectFunctionsEmulator(functions, 'localhost', 5001); functions._consentEmu = true; } catch {}
  }
  const res = await httpsCallable(functions, 'recordConsent')({ kind, version, textHash, userAgent: navigator.userAgent });
  return res.data;
}

/** Step engine: tracks step, renders stepper, guards transitions. */
export function createStepEngine({ steps, onStep, stepperPrefix = 'si-' }) {
  let current = 1;
  const total = steps.length;
  function goTo(n) {
    current = Math.max(1, Math.min(total, n));
    document.querySelectorAll('.step-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`step-${current}`)?.classList.add('active');
    for (let i = 1; i <= total; i++) {
      const el = document.getElementById(`${stepperPrefix}${i}`);
      if (!el) continue;
      el.classList.remove('active', 'done');
      if (i < current) el.classList.add('done');
      else if (i === current) el.classList.add('active');
    }
    const label = document.getElementById('step-label');
    if (label) label.textContent = t('reg.step', { n: current, total });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onStep && onStep(steps[current - 1], current);
  }
  return { goTo, next: () => goTo(current + 1), back: () => goTo(current - 1), get current() { return current; }, total };
}


/** Wire a 6-box OTP input group to a verify callback. */
export function wireOtpInputs({ inputSelector, verifyBtnId, onVerify }) {
  const inputs = [...document.querySelectorAll(inputSelector)];
  const verifyBtn = verifyBtnId ? document.getElementById(verifyBtnId) : null;
  const code = () => inputs.map((i) => i.value).join('');
  function refresh() { if (verifyBtn) verifyBtn.disabled = !isOtpCode(code()); }
  inputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(-1);
      e.target.classList.toggle('filled', Boolean(e.target.value));
      if (e.target.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      refresh();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus(); inputs[idx - 1].value = '';
        inputs[idx - 1].classList.remove('filled'); refresh();
      }
      if (e.key === 'Enter' && isOtpCode(code())) onVerify(code());
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, inputs.length);
      pasted.split('').forEach((ch, i) => { inputs[i].value = ch; inputs[i].classList.add('filled'); });
      refresh();
      if (isOtpCode(code())) onVerify(code());
    });
  });
  verifyBtn?.addEventListener('click', () => { if (isOtpCode(code())) onVerify(code()); });
  refresh();
  return { code, refresh, focus: () => inputs[0]?.focus() };
}

/** Start a resend-cooldown countdown on a button. */
export function startResendCooldown(btnId, seconds = config.otp.resendCooldownSeconds) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  let left = seconds;
  btn.disabled = true;
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  const tick = () => {
    if (left <= 0) { btn.disabled = false; btn.textContent = label; return; }
    btn.textContent = t('auth.otpExpiresIn', { s: left });
    left -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

export { normalizePhone, isValidPHPhone, isOtpLocked };
