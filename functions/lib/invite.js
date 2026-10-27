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
  if (kind !== 'lgu' || !Number.isFinite(Number(expiresHours)) || Number(expiresHours) < 1 || Number(expiresHours) > 168) {
    return { success: false, reason: 'invalid_invite_options' };
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return { success: false, reason: 'invalid_metadata' };
  const email = String(meta.email || '').trim().toLowerCase();
  const allowedDomain = String(meta.allowedDomain || '').trim().toLowerCase();
  if ((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (allowedDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(allowedDomain))) {
    return { success: false, reason: 'invalid_metadata' };
  }
  meta = { ...meta, ...(email ? { email } : {}), ...(allowedDomain ? { allowedDomain } : {}) };
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
      const latest = await tx.get(inviteRef);
      if (!latest.exists || latest.data().used) throw new Error('used');
      if (latest.data().expiresAt.toDate() <= new Date()) throw new Error('expired');
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
    if (['used','expired'].includes(err.message)) return { success: false, reason: err.message };
    console.error('consumeInvite error:', err);
    return { success: false, reason: ['used','expired'].includes(err.message) ? err.message : 'internal' };
  }
}

module.exports = { createInvite, validateInvite, consumeInvite };
