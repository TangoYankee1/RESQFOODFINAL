// One transaction: authorize -> check proof -> consume -> change state -> audit/notify.
const crypto = require('node:crypto');
const { inspectSignedPayload } = require('./signQr');
const { MAX_ATTEMPTS } = require('./pin');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const millis = value => value?.toMillis ? value.toMillis() : new Date(value).getTime();
const id = value => typeof value === 'string' && value.length > 0 && value.length < 200 && !value.includes('/');

async function handover(db, uid, role, input, commit = true) {
  const { donationId, purpose, mode, proof, requestId } = input || {};
  if (!id(donationId) || !['pickup','verify'].includes(purpose) || !['qr','pin'].includes(mode)
    || typeof proof !== 'string' || proof.length > 4096
    || (commit && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)))
    || (!commit && mode !== 'qr')) return { success: false, reason: 'invalid_argument' };
  if (role !== (purpose === 'pickup' ? 'volunteer' : 'orgAdmin')) return { success: false, reason: 'permission-denied' };
  let payload;
  if (mode === 'qr') {
    const parsed = inspectSignedPayload(proof);
    if (!parsed.success) return parsed;
    payload = parsed.payload;
    if (payload.donationId !== donationId || payload.purpose !== purpose) return { success: false, reason: 'wrong_purpose_or_donation' };
  } else if (!/^\d{4}$/.test(proof)) return { success: false, reason: 'pin_mismatch' };
  const fingerprint = hash(`${mode}:${proof}`);
  const donationRef = db.collection('donations').doc(donationId);
  const receiptRef = db.collection('handoverReceipts').doc(`${donationId}_${purpose}`);
  return db.runTransaction(async tx => {
    const actor = await tx.get(db.collection('users').doc(uid));
    const donation = await tx.get(donationRef);
    if (!actor.exists || actor.data().status !== 'active' || actor.data().role !== role) return { success: false, reason: 'permission-denied' };
    if (!donation.exists) return { success: false, reason: 'not_found' };
    const d = donation.data();
    if (!id(d.orgId)) return { success: false, reason: 'destination_required' };
    const org = await tx.get(db.collection('organizations').doc(d.orgId));
    if (!org.exists || org.data().status !== 'active') return { success: false, reason: 'destination_inactive' };
    if (purpose === 'pickup' ? d.volunteerId !== uid
      : !(org.data().primaryContactUid === uid || (org.data().verifierUids || []).includes(uid))) return { success: false, reason: 'permission-denied' };
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      const r = receipt.data();
      return commit && r.requestId === requestId && r.actorUid === uid && r.fingerprint === fingerprint
        ? { success: true, donationId, newStatus: r.newStatus, reused: true }
        : { success: false, reason: 'already_confirmed' };
    }
    const expected = purpose === 'pickup' ? 'scheduled' : 'delivered';
    const next = purpose === 'pickup' ? 'pickedUp' : 'verified';
    if (d.status !== expected) return { success: false, reason: 'invalid_state' };
    const now = new Date();
    if (purpose === 'pickup' && (!Number.isFinite(millis(d.pickupWindowEnd)) || millis(d.pickupWindowEnd) <= now.getTime())) return { success: false, reason: 'expired' };
    const credentialRef = mode === 'qr' ? db.collection('qrNonces').doc(payload.nonce)
      : db.collection('pins').doc(`${donationId}_${purpose}`);
    const credential = await tx.get(credentialRef);
    if (!credential.exists) return { success: false, reason: 'not_found' };
    const c = credential.data();
    if (c.used) return { success: false, reason: c.usedReason === 'locked' ? 'pin_locked' : 'replayed' };
    if (!Number.isFinite(millis(c.expiresAt)) || millis(c.expiresAt) <= now.getTime()) return { success: false, reason: 'expired' };
    const sourceUid = purpose === 'pickup' ? d.donorId : d.volunteerId;
    if (c.donationId !== donationId || c.purpose !== purpose || (mode === 'qr' ? c.issuedBy : c.createdBy) !== sourceUid) return { success: false, reason: 'wrong_issuer' };
    if (mode === 'qr') {
      if (payload.donorId !== d.donorId || payload.expiresAt <= now.getTime()
        || d[purpose === 'pickup' ? 'pickupNonce' : 'receiptNonce'] !== payload.nonce) return { success: false, reason: 'replaced_or_expired' };
    } else {
      if ((c.attempts || 0) >= MAX_ATTEMPTS) return { success: false, reason: 'pin_locked' };
      if (hash(proof) !== c.pinHash) {
        const attempts = (c.attempts || 0) + 1;
        tx.update(credentialRef, { attempts, ...(attempts >= MAX_ATTEMPTS ? { used: true, usedReason: 'locked' } : {}) });
        return { success: false, reason: attempts >= MAX_ATTEMPTS ? 'pin_locked' : 'pin_mismatch' };
      }
    }
    if (!commit) return { success: true, donationId, purpose, preview: true };
    tx.update(credentialRef, { used: true, usedAt: now, usedBy: uid, usedReason: 'confirmed' });
    tx.update(donationRef, {
      status: next, updatedAt: now,
      ...(purpose === 'pickup' ? { pickedUpAt: now, pickedUpBy: uid } : { verifiedAt: now, verifiedBy: uid }),
      statusHistory: [...(d.statusHistory || []), { status: next, actorUid: uid, actorRole: role, at: now }],
    });
    tx.create(receiptRef, { donationId, purpose, requestId, actorUid: uid, fingerprint, newStatus: next, createdAt: now });
    tx.set(db.collection('auditLogs').doc(), { action: 'handover_confirmed', donationId, entityType: 'donation', entityId: donationId,
      actorUid: uid, actorRole: role, fromStatus: expected, toStatus: next, purpose, mode, createdAt: now });
    const recipients = new Set([d.donorId, ...(purpose === 'verify' ? [d.volunteerId] : [])]);
    for (const recipientUid of recipients) if (recipientUid) tx.set(db.collection('notifications').doc(), {
      recipientUid, donationId, title: purpose === 'pickup' ? 'Pickup confirmed' : 'Receipt confirmed',
      body: `Donation ${donationId}: ${next}`, status: next, read: false, createdAt: now,
    });
    return { success: true, donationId, newStatus: next, reused: false };
  });
}
module.exports = { handover };
