// public/js/core/verification.js
// ONE shared verification module. Used by BOTH the volunteer pickup scanner
// (public/js/qr/scanner.js) and the org-admin receipt verifier
// (public/js/qr/orgAdminScanner.js). Same code, same behavior, same tests.
// Trust decisions come from the server (signature + nonce + PIN lifecycle);
// the client only parses structure and shows Tagalog state.

import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { functions } from './firebaseConfig.js';
import { t } from './i18n.js';
import { classify } from './errors.js';
import { analytics } from './analytics.js';

function call(name, payload) {
  return httpsCallable(functions, name)(payload).then((r) => r.data);
}

export const QR_SCHEMA_VERSION = 2;

// ── Pure helpers (no DOM, no network — unit-testable) ───────────────────────

/** Parse raw QR text into a structured payload or a typed failure. */
export function parseQrPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    return { ok: false, reason: 'not_json' };
  }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'bad_shape' };
  if (typeof payload.v !== 'number') return { ok: false, reason: 'no_version' };
  if (payload.v === 1) {
    if (typeof payload.d !== 'string' || typeof payload.o !== 'string' || typeof payload.c !== 'string') {
      return { ok: false, reason: 'bad_shape' };
    }
    return { ok: true, legacy: true, payload };
  }
  if (payload.v !== QR_SCHEMA_VERSION) return { ok: false, reason: 'unsupported_version' };
  for (const f of ['donationId', 'donorId', 'issuedAt', 'expiresAt', 'nonce', 'sig']) {
    if (payload[f] === undefined || payload[f] === null) return { ok: false, reason: 'bad_shape' };
  }
  if (typeof payload.sig !== 'string' || payload.sig.length < 32) return { ok: false, reason: 'bad_shape' };
  return { ok: true, legacy: false, payload };
}

/** Map a server/parse failure code → user-facing Tagalog message. */
export function verifyFailureMessage(reason) {
  switch (reason) {
    case 'not_json': case 'bad_shape': case 'no_version':
      return t('verify.invalid');
    case 'unsupported_version': case 'legacy_unsigned':
      return t('verify.qrUnsupported');
    case 'expired': case 'pin_expired': return t('verify.qrExpired');
    case 'used': case 'replayed': case 'pin_used': return t('verify.replayed');
    case 'signature': case 'signatureBad': return t('verify.signatureBad');
    case 'cancelled': return t('verify.qrCancelled');
    case 'not_found': case 'unknown_nonce': return t('verify.qrNotFound');
    case 'pin_mismatch': return t('verify.pinInvalid');
    case 'pin_locked': return t('verify.pinLocked');
    case 'network': case 'unavailable': return t('verify.serverUnreachable');
    case 'permission-denied': return 'Wala kang pahintulot para sa handover na ito.';
    case 'invalid_state': return 'Hindi pa handa o tapos na ang handover na ito.';
    case 'already_confirmed': return 'Na-confirm na ang handover. Tingnan ang mission status.';
    case 'wrong_purpose_or_donation': return 'Para sa ibang donation o yugto ang code na ito.';
    case 'replaced_or_expired': return 'Pinalitan o expired na ang code. Hingin ang pinakabago.';
    case 'destination_inactive': return 'Hindi aktibo ang tatanggap na organization.';
    default: return t('common.error');
  }
}

/** Client-side expiry pre-check so expired codes fail fast with the right copy. */
export function isExpiredAt(expiresAtMs, nowMs = Date.now()) {
  return Number(expiresAtMs) <= nowMs;
}

// ── Server-backed verification ─────────────────────────────────────────────

/**
 * Read-only preview of a scanned QR payload (signature + nonce replay +
 * donation state). Returns { ok, donationId?, reason? }.
 */
export async function verifyScannedPayload(rawText, context = {}) {
  const parsed = parseQrPayload(rawText);
  if (!parsed.ok) {
    analytics.track('verify_failed', { mode: 'qr', reason: parsed.reason });
    return { ok: false, reason: parsed.reason };
  }
  try {
    const res = await call('verifyQr', { payload: rawText, context });
    if (!res || !res.success) {
      const reason = (res && res.reason) || 'signature';
      analytics.track('verify_failed', { mode: 'qr', reason });
      return { ok: false, reason, ...res };
    }
    analytics.track('qr_previewed', {});
    return { ok: true, donationId: res.donationId, payload: parsed.payload };
  } catch (err) {
    const reason = /unavailable|network|offline/i.test(String(err && err.code) + (err && err.message))
      ? 'network' : 'signature';
    analytics.track('verify_failed', { mode: 'qr', reason });
    return { ok: false, reason };
  }
}

/** Request a fresh single-use server PIN for a donation + purpose. */
export async function requestPin(donationId, purpose) {
  const res = await call('issuePin', { donationId, purpose });
  if (!res || !res.success) throw classify({ code: 'permission-denied', message: res && res.reason });
  return res; // { success, pin, expiresAt }
}

/**
 * Confirm a PIN handover atomically (proof consumption and donation status).
 * Returns { ok, donationId?, reason? }. There are intentionally no demo PINs
 * or locally-accepted values anywhere in this path.
 */
export async function verifyPin(donationId, purpose, pin) {
  return confirmHandover({ donationId, purpose, mode: 'pin', proof: String(pin || '').trim() });
}

/** Durable request id across network retries/reloads; never store the credential. */
const handoverRequestIds = new Map();
export async function confirmHandover(input) {
  if (!navigator.onLine) return { ok: false, reason: 'network' };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
  const key = 'handover_' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  let requestId = handoverRequestIds.get(key);
  if (!requestId) { try { requestId = sessionStorage.getItem(key); } catch (_) {} }
  if (!requestId) {
    requestId = crypto.randomUUID();
    try { sessionStorage.setItem(key, requestId); } catch (_) {}
  }
  handoverRequestIds.set(key, requestId);
  try {
    const result = await call('confirmHandover', { ...input, requestId });
    return { ...result, ok: result.success === true };
  } catch (error) {
    return { ok: false, reason: /permission-denied|unauthenticated/.test(error.code) ? 'permission-denied' : 'network' };
  }
}
