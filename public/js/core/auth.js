// public/js/core/auth.js
// OTP, session, token refresh, route guards. Firebase Phone Auth is the SMS
// provider in production (real SMS); the emulator path exists for local dev.
// Client safeguards: 6-digit format, 5-minute window, 3-attempt lockout.
// Firebase Auth verifies the issued code. Client safeguards reset on reload.

import { auth } from './firebaseConfig.js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { config } from './config.js';

const INTENT_KEY = 'resqfood_post_login_redirect';

// ── Phone normalization ─────────────────────────────────────────────────────

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 11) return '+63' + digits.slice(1);
  if (digits.length === 10) return '+63' + digits;
  return '+' + digits;
}

export function isValidPHPhone(raw) {
  return /^\+639\d{9}$/.test(normalizePhone(raw));
}

// ── OTP lifecycle (3 attempts, 5-min window, server rate limits) ────────────

let recaptchaVerifier = null;
const otpAttempts = new Map(); // phone -> { count, firstAt }

export function initRecaptcha(containerId) {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return recaptchaVerifier;
}

function attemptState(phone) {
  const now = Date.now();
  let state = otpAttempts.get(phone);
  if (!state || now - state.firstAt > config.otp.ttlSeconds * 1000) {
    state = { count: 0, firstAt: now };
    otpAttempts.set(phone, state);
  }
  return state;
}

/** True when this phone is locked out of verifying (3 wrong codes). */
export function isOtpLocked(phone) {
  const state = attemptState(phone);
  return state.count >= config.otp.maxAttempts;
}

/** Send through Firebase Auth; the local emulator prints the code instead of SMS. */
export async function sendOTP(rawPhone, containerId) {
  const phone = normalizePhone(rawPhone);
  if (!isValidPHPhone(phone)) throw Object.assign(new Error('Invalid phone'), { code: 'auth/invalid-phone-number' });
  // Keep the SDK's real verifier interface. connectAuthEmulator disables the
  // challenge itself; a hand-built verifier misses SDK lifecycle methods.
  const verifier = initRecaptcha(containerId);
  const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
  otpAttempts.set(phone, { count: 0, firstAt: Date.now() });
  return { confirmation, phone, sentAt: Date.now() };
}

/** Confirm the actual issued code; local attempt limits are a UI safeguard. */
export async function confirmOTP(pending, code) {
  if (!pending?.confirmation || !/^\d{6}$/.test(String(code))) {
    throw Object.assign(new Error('Invalid code'), { code: 'auth/invalid-verification-code' });
  }
  if (Date.now() - pending.sentAt > config.otp.ttlSeconds * 1000) {
    throw Object.assign(new Error('Code expired'), { code: 'auth/code-expired' });
  }
  if (isOtpLocked(pending.phone)) {
    throw Object.assign(new Error('Too many attempts'), { code: 'auth/too-many-requests' });
  }
  try {
    const result = await pending.confirmation.confirm(String(code));
    otpAttempts.delete(pending.phone);
    return result;
  } catch (error) {
    if (error.code === 'auth/invalid-verification-code') attemptState(pending.phone).count++;
    throw error;
  }
}

// ── Session / role ──────────────────────────────────────────────────────────

/** Sign out of Firebase Auth. Used by every role dashboard's sign-out flow. */
export async function signOutCurrentUser() {
  await firebaseSignOut(auth);
  try { sessionStorage.removeItem(INTENT_KEY); } catch (_) {}
}

export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

/**
 * Resolve the caller's role: ID-token custom claim first (server-set),
 * Firestore profile second. Never caller-supplied, never invented.
 */
export async function getSessionRole(user) {
  if (!user) return null;
  try {
    const token = await user.getIdTokenResult(true);
    if (token.claims && token.claims.role) return token.claims.role;
  } catch (_) { /* fall through to profile */ }
  try {
    const { fetchDoc } = await import('./data.js');
    const profile = await fetchDoc(`users/${user.uid}`);
    return profile?.role || profile?.requestedRole || null;
  } catch (_) {
    return null;
  }
}

/** Remember where the user wanted to go before login kicked in. */
export function saveIntent(path) {
  try { sessionStorage.setItem(INTENT_KEY, path || (location.pathname + location.search)); } catch (_) {}
}

export function consumeIntent(fallback = '/') {
  let next = null;
  try { next = sessionStorage.getItem(INTENT_KEY); sessionStorage.removeItem(INTENT_KEY); } catch (_) {}
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return fallback;
}

// ── Route guards ────────────────────────────────────────────────────────────

/**
 * Guard: require authentication + one of `roles`. On failure redirects to
 * login preserving the intended destination. Returns { user, role } or
 * redirects and throws a GuardRedirect (page boot must stop).
 */
export async function requireRole(roles, opts = {}) {
  const user = await getCurrentUser();
  if (!user) {
    saveIntent(opts.next || (location.pathname + location.search));
    const err = new Error('unauthenticated');
    err.code = 'guard-redirect';
    const loginRoles = Array.isArray(roles) ? roles : [roles];
    err.redirectTo = opts.loginPath || (loginRoles.includes('donor') ? '/donor/login.html'
      : loginRoles.includes('volunteer') ? '/volunteer/login.html'
      : loginRoles.includes('orgAdmin') ? '/org-admin/login.html' : loginRoles.includes('lguAdmin') ? '/admin/login.html' : '/register/index.html');
    location.replace(`${err.redirectTo}?next=${encodeURIComponent(opts.next || (location.pathname + location.search))}`);
    throw err;
  }
  const role = await getSessionRole(user);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!role || !allowed.includes(role)) {
    const err = new Error(role ? 'wrong_role' : 'no_role');
    err.code = 'guard-redirect';
    const { roleHomeFor } = await import('./router.js');
    err.redirectTo = roleHomeFor(role);
    location.replace(err.redirectTo);
    throw err;
  }
  try {
    const { fetchDoc } = await import('./data.js');
    const profile = await fetchDoc(`users/${user.uid}`);
    if (profile && profile.status === 'suspended') {
      await firebaseSignOut(auth);
      const err = new Error('suspended');
      err.code = 'guard-redirect';
      err.redirectTo = '/register/index.html?suspended=1';
      location.replace(err.redirectTo);
      throw err;
    }
  } catch (err) {
    if (err.code === 'guard-redirect') throw err;
    // Profile lookup failure must not silently grant access — fail closed.
    throw err;
  }
  return { user, role };
}
