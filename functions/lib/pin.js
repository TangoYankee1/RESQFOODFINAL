// functions/lib/pin.js
// Server-side single-use PIN lifecycle (PROD.MD: per-donation, single-use,
// 15-minute TTL, invalidated on success/expiry, hash-at-rest, audited).
// Collection: pins/{donationId}_{purpose} -> { pinHash, expiresAt, attempts, used, ... }
const crypto = require('crypto');

const PIN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function pinDocId(donationId, purpose) {
  return `${donationId}_${purpose}`;
}

function randomPin(length = 4) {
  let pin = '';
  while (pin.length < length) {
    // crypto.randomInt is uniform; avoid leading-zero loss by building digit-wise
    pin += String(crypto.randomInt(0, 10));
  }
  // Ensure 4-digit PINs don't start with 0 (readability over phone)
  if (length === 4 && pin[0] === '0') pin = String(crypto.randomInt(1, 10)) + pin.slice(1);
  return pin;
}

/**
 * Issue (or re-issue) a PIN. Any previous PIN for the same donation+purpose
 * is invalidated by overwrite. Plaintext PIN is returned ONCE to the caller.
 */
async function issuePin(firestore, { donationId, purpose = 'verify', requestedBy, role, deadline }) {
  if (!donationId || typeof donationId !== 'string') return { success: false, reason: 'invalid_donation' };
  if (!['verify', 'pickup'].includes(purpose)) return { success: false, reason: 'invalid_purpose' };
  const pin = randomPin(4);
  const now = new Date();
  const expiresAt = new Date(Math.min(now.getTime() + PIN_TTL_MS, deadline ? deadline.getTime() : Infinity));
  const ref = firestore.collection('pins').doc(pinDocId(donationId, purpose));
  await ref.set({
    donationId,
    purpose,
    pinHash: sha256(pin),
    attempts: 0,
    used: false,
    createdAt: now,
    expiresAt,
    createdBy: requestedBy || null,
    createdByRole: role || null,
  });
  return { success: true, pin, expiresAt: expiresAt.toISOString(), donationId, purpose };
}

// Consumption belongs exclusively to the atomic handover command.
module.exports = { issuePin, PIN_TTL_MS, MAX_ATTEMPTS, pinDocId };
