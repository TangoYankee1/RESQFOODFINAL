const { createHash } = require('node:crypto');

async function signupLguWithProfile(db, uid, profile) {
  const email = String(profile.email || '').trim().toLowerCase();
  const fullName = String(profile.fullName || '').trim();
  const designation = String(profile.designation || '').trim();
  const barangay = String(profile.barangay || '').trim();
  if (!uid || fullName.length < 3 || fullName.length > 150 || designation.length < 2 || designation.length > 150 || barangay.length < 2 || barangay.length > 150 || email.length > 254
    || !/^\+639\d{9}$/.test(profile.phone || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || profile.auditAcknowledged !== true || typeof profile.verificationRequestId !== 'string' || !profile.verificationRequestId || profile.verificationRequestId.length > 150 || profile.verificationRequestId.includes('/')
    || typeof profile.token !== 'string' || !profile.token || profile.token.length > 500) {
    return { success: false, reason: 'invalid_profile' };
  }
  const tokenHash = createHash('sha256').update(String(profile.token)).digest('hex');
  const invites = await db.collection('invites').where('tokenHash', '==', tokenHash).limit(1).get();
  if (invites.empty) return { success: false, reason: 'invalid_invite' };
  const inviteRef = invites.docs[0].ref;
  const requestRef = db.collection('verificationRequests').doc(String(profile.verificationRequestId));
  const userRef = db.collection('users').doc(uid);
  const auditRef = db.collection('auditLogs').doc();
  try {
    return await db.runTransaction(async tx => {
      const [invite, request, user] = await Promise.all([tx.get(inviteRef), tx.get(requestRef), tx.get(userRef)]);
      const existing = user.data(), invitation = invite.data(), proof = request.data();
      if (existing && (existing.role || existing.requestedRole) !== 'lguAdmin') throw Error('role_conflict');
      if (existing && ['suspended', 'rejected'].includes(existing.status)) throw Error('account_ineligible');
      if (!invitation || invitation.kind !== 'lgu' || (invitation.used && invitation.usedBy !== uid)) throw Error('invalid_invite');
      // A committed application may be retried after a lost response, even after invite expiry.
      if (existing?.verificationRequestId === requestRef.id && existing.inviteId === inviteRef.id && invitation.usedBy === uid) {
        return { success: true, status: existing.status };
      }
      if (existing?.verificationRequestId) throw Error('already_submitted');
      if (!invitation.expiresAt || invitation.expiresAt.toDate() <= new Date()) throw Error('expired_invite');
      const meta = invitation.meta || {};
      if ((meta.email && String(meta.email).toLowerCase() !== email)
        || (meta.allowedDomain && email.split('@')[1] !== String(meta.allowedDomain).toLowerCase())
        || (meta.barangay && meta.barangay !== barangay)) throw Error('invite_mismatch');
      if (!proof || proof.uploaderUid !== uid || proof.targetUid !== uid || proof.type !== 'lgu_authorization'
        || proof.status !== 'pending' || proof.inviteId !== inviteRef.id) throw Error('invalid_verification_request');
      const now = new Date();
      tx.set(userRef, { fullName, designation, barangay, phoneNumber: profile.phone, email,
        emailVerified: false, requestedRole: 'lguAdmin', status: 'pending_review',
        verificationRequestId: requestRef.id, inviteId: inviteRef.id, auditAcknowledged: true,
        createdAt: now, updatedAt: now });
      tx.update(requestRef, { officialEmail: email, inviteId: inviteRef.id, updatedAt: now });
      tx.update(inviteRef, { used: true, usedBy: uid, usedAt: now });
      tx.set(auditRef, { logId: auditRef.id, entityType: 'user', entityId: uid,
        action: 'lgu_application_submitted', actorUid: uid, details: { inviteId: inviteRef.id, requestId: requestRef.id }, createdAt: now });
      return { success: true, status: 'pending_review' };
    });
  } catch (error) {
    if (['role_conflict', 'account_ineligible', 'invalid_invite', 'already_submitted', 'expired_invite', 'invite_mismatch', 'invalid_verification_request'].includes(error.message)) {
      return { success: false, reason: error.message };
    }
    throw error;
  }
}
module.exports = { signupLguWithProfile };
