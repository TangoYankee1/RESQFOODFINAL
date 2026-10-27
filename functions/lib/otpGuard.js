// functions/lib/otpGuard.js
// Server-side OTP send rate limiting (PROD.MD): per-phone 3 sends / 10 min,
// per-IP 20 sends / hour. Called BEFORE sending any code. Fail-closed on
// Firestore errors so abuse cannot bypass the limiter via backend outage.
const WINDOW_PHONE_MS = 10 * 60 * 1000;
const WINDOW_IP_MS = 60 * 60 * 1000;
const MAX_PER_PHONE = 3;
const MAX_PER_IP = 20;

function windowStart(now, span) { return new Date(now.getTime() - span); }

async function countSince(firestore, collection, field, value, since) {
  const q = await firestore.collection(collection)
    .where(field, '==', value)
    .where('createdAt', '>=', since)
    .get();
  return q.size;
}

/** Record an OTP send attempt; throws HttpsError-shaped { code } on limit. */
async function recordOtpSend(firestore, { phone, ip }) {
  if (!phone) { const e = new Error('phone required'); e.code = 'invalid-argument'; throw e; }
  const now = new Date();
  try {
    const [phoneCount, ipCount] = await Promise.all([
      countSince(firestore, 'otpSends', 'phone', phone, windowStart(now, WINDOW_PHONE_MS)),
      ip ? countSince(firestore, 'otpSends', 'ip', ip, windowStart(now, WINDOW_IP_MS)) : Promise.resolve(0),
    ]);
    if (phoneCount >= MAX_PER_PHONE) { const e = new Error('Too many codes sent to this number. Try again later.'); e.code = 'resource-exhausted'; throw e; }
    if (ipCount >= MAX_PER_IP) { const e = new Error('Too many codes sent from this network. Try again later.'); e.code = 'resource-exhausted'; throw e; }
    await firestore.collection('otpSends').doc().set({ phone, ip: ip || null, createdAt: now });
    return { success: true };
  } catch (err) {
    if (err.code === 'resource-exhausted' || err.code === 'invalid-argument') throw err;
    console.error('otpGuard backend failure (fail-closed):', err);
    const e = new Error('Rate limiter unavailable. Try again later.');
    e.code = 'unavailable';
    throw e;
  }
}

module.exports = { recordOtpSend, MAX_PER_PHONE, MAX_PER_IP, WINDOW_PHONE_MS, WINDOW_IP_MS };
