// functions/lib/signQr.js
// Versioned, HMAC-signed QR credential lifecycle (PROD.MD):
//   payload = { v:2, donationId, donorId, issuedAt, expiresAt, nonce, sig }
// Server validates: signature, expiry, nonce replay, donation state.
// Secret: QR_HMAC_SECRET env / functions config — never in the repo/client.
const crypto = require('crypto');

const SCHEMA_VERSION = 2;
const QR_TTL_MS = 24 * 60 * 60 * 1000; // 24h hard expiry on the credential

function getSecret() {
  const s = process.env.QR_HMAC_SECRET;
  if (!s) throw new Error('Missing QR_HMAC_SECRET');
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function canonical({ v, donationId, donorId, issuedAt, expiresAt, nonce, purpose }) {
  return [v, donationId, donorId, issuedAt, expiresAt, nonce, purpose].join('.');
}

function signPayload({ donationId, donorId, issuedAt, expiresAt, nonce, purpose = 'pickup' }) {
  const body = { v: SCHEMA_VERSION, donationId, donorId, issuedAt, expiresAt, nonce, purpose };
  const sig = b64url(crypto.createHmac('sha256', getSecret()).update(canonical(body)).digest());
  return { ...body, sig };
}

/** Issue purpose-bound QR proof; the callable enforces its donor/volunteer issuer. */
async function issueCredential(firestore, { donationId, donorId, issuedBy, purpose = 'pickup' }) {
  if (!donationId || !donorId) return { success: false, reason: 'invalid_argument' };
  if (!['pickup', 'verify'].includes(purpose)) return { success: false, reason: 'invalid_purpose' };
  return firestore.runTransaction(async tx => {
    const donationRef = firestore.collection('donations').doc(donationId);
    const donation = await tx.get(donationRef);
    if (!donation.exists || donation.data().donorId !== donorId) return { success: false, reason: 'not_found' };
    const d = donation.data();
    const now = Date.now();
    const deadline = d.pickupWindowEnd?.toMillis ? d.pickupWindowEnd.toMillis() : new Date(d.pickupWindowEnd).getTime();
    if (purpose === 'pickup' && (!['pending','scheduled'].includes(d.status) || !Number.isFinite(deadline) || deadline <= now)) return { success: false, reason: 'pickup_closed' };
    if (purpose === 'verify' && d.status !== 'delivered') return { success: false, reason: 'not_delivered' };
    const payload = signPayload({
      donationId, donorId, purpose,
      issuedAt: now,
      expiresAt: purpose === 'pickup' ? Math.min(now + QR_TTL_MS, deadline) : now + QR_TTL_MS,
      nonce: crypto.randomBytes(12).toString('hex'),
  });
  tx.set(firestore.collection('qrNonces').doc(payload.nonce), {
    donationId, donorId, purpose, issuedAt: new Date(now), expiresAt: new Date(payload.expiresAt),
    used: false, issuedBy: issuedBy || null, createdAt: new Date(),
  });
  tx.update(donationRef, { [purpose === 'pickup' ? 'pickupNonce' : 'receiptNonce']: payload.nonce });
  return { success: true, payload };
  });
}

// Signature/shape only: expiry is checked inside the confirmation transaction,
// after checking a durable receipt so an identical lost-response retry is safe.
function inspectSignedPayload(raw) {
  let p;
  try { p = JSON.parse(raw); } catch { return { success: false, reason: 'bad_shape' }; }
  if (!p || p.v !== SCHEMA_VERSION || !['pickup','verify'].includes(p.purpose)
    || !['donationId','donorId'].every(key => typeof p[key] === 'string' && p[key].length > 0 && !p[key].includes('/'))
    || !/^[a-f0-9]{24}$/.test(p.nonce || '') || typeof p.sig !== 'string'
    || !Number.isFinite(p.issuedAt) || !Number.isFinite(p.expiresAt) || p.expiresAt <= p.issuedAt) return { success: false, reason: 'bad_shape' };
  let expected;
  try { expected = signPayload(p).sig; } catch { return { success: false, reason: 'config' }; }
  const actual = Buffer.from(p.sig), signed = Buffer.from(expected);
  if (actual.length !== signed.length || !crypto.timingSafeEqual(actual, signed)) return { success: false, reason: 'signature' };
  return { success: true, payload: p };
}

module.exports = { issueCredential, signPayload, inspectSignedPayload, SCHEMA_VERSION, QR_TTL_MS };
