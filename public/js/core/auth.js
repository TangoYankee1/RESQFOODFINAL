import { auth } from './firebaseConfig.js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Normalize Philippine mobile numbers to E.164 (+63XXXXXXXXXX)
export function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('0')  && digits.length === 11) return '+63' + digits.slice(1);
  if (digits.length === 10)                             return '+63' + digits;
  return '+' + digits;
}

let recaptchaVerifier = null;

export function initRecaptcha(containerId) {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  return recaptchaVerifier;
}

export async function sendOTP(phoneNumber, containerId) {
  const verifier = initRecaptcha(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

// Returns the current user or null, wrapped in a Promise
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// Guard: redirect to register if not authenticated
export async function requireAuth(redirectTo = '/register/index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

// Guard: redirect to dashboard if already authenticated with a role
export async function requireGuest(role = 'donor') {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = `/${role}/index.html`;
  }
}
