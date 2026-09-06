const crypto = require('crypto');
const admin = require('firebase-admin');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create an invite (admin-only). Stores only the token hash.
 * Returns plaintext token for delivery.
 */
async function createInvite(firestore, createdBy, kind = 'lgu', meta = {}, expiresHours = 72) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const docRef = firestore.collection('invites').doc();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000);
  await docRef.set({
    inviteId: docRef.id,
    tokenHash,
    kind,
    meta: meta || {},
    createdBy: createdBy || null,
    createdAt: now,
    expiresAt,
    used: false,
    usedBy: null,
    usedAt: null
  });
  // Audit
  const auditRef = firestore.collection('auditLogs').doc();
  await auditRef.set({
    logId: auditRef.id,
    entityType: 'invite',
    entityId: docRef.id,
    action: 'create_invite',
    actorUid: createdBy || null,
    details: { kind, meta },
    createdAt: now
  });
  return { success: true, token, inviteId: docRef.id };
}

async function validateInvite(firestore, token) {
  const tokenHash = hashToken(token);
  const q = await firestore.collection('invites').where('tokenHash', '==', tokenHash).limit(1).get();
  if (q.empty) return { success: false, reason: 'not_found' };
  const doc = q.docs[0];
  const data = doc.data();
  const now = new Date();
  if (data.used) return { success: false, reason: 'used' };
  if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < now) return { success: false, reason: 'expired' };
  return { success: true, inviteId: doc.id, meta: data.meta, kind: data.kind };
}

async function consumeInvite(firestore, token, actorUid) {
  const tokenHash = hashToken(token);
  const q = await firestore.collection('invites').where('tokenHash', '==', tokenHash).limit(1).get();
  if (q.empty) return { success: false, reason: 'not_found' };
  const doc = q.docs[0];
  const data = doc.data();
  const now = new Date();
  if (data.used) return { success: false, reason: 'used' };
  if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < now) return { success: false, reason: 'expired' };

  const inviteRef = firestore.collection('invites').doc(doc.id);
  const auditRef = firestore.collection('auditLogs').doc();
  try {
    await firestore.runTransaction(async (tx) => {
      tx.update(inviteRef, { used: true, usedBy: actorUid || null, usedAt: now });
      tx.set(auditRef, {
        logId: auditRef.id,
        entityType: 'invite',
        entityId: inviteRef.id,
        action: 'consume_invite',
        actorUid: actorUid || null,
        details: { inviteId: inviteRef.id },
        createdAt: now
      });
    });
    return { success: true, inviteId: inviteRef.id, meta: data.meta };
  } catch (err) {
    console.error('consumeInvite error:', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { createInvite, validateInvite, consumeInvite };
