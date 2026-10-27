// functions/lib/consent.js
// Versioned, timestamped, immutable consent records (RA 10173).
// Collection: consentRecords/{autoId} — create-only, never updated/deleted.
// Stores: uid, kind, version, textHash, userAgent, ip (from callable context),
// createdAt. The client computes textHash = SHA-256(consent text shown).
const ALLOWED_KINDS = ['safety', 'privacy', 'responsibility', 'training', 'verification', 'audit'];

async function recordConsent(firestore, { uid, kind, version, textHash, userAgent, ip }) {
  if (!uid) return { success: false, reason: 'unauthenticated' };
  if (!ALLOWED_KINDS.includes(kind)) return { success: false, reason: 'invalid_kind' };
  if (!version || typeof version !== 'string' || version.length > 40) return { success: false, reason: 'invalid_version' };
  if (!/^[a-f0-9]{64}$/i.test(String(textHash || ''))) return { success: false, reason: 'invalid_texthash' };
  const now = new Date();
  const ref = firestore.collection('consentRecords').doc();
  await ref.set({
    consentId: ref.id, uid, kind, version,
    textHash: String(textHash).toLowerCase(),
    userAgent: String(userAgent || '').slice(0, 300),
    ip: ip || null,
    createdAt: now,
  });
  return { success: true, consentId: ref.id };
}

module.exports = { recordConsent, ALLOWED_KINDS };
