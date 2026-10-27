const admin = require('firebase-admin');

async function reviewVerificationRequest(firestore, authAdmin, actorUid, requestId, decision, note) {
  if (!actorUid) return { success: false, reason: 'unauthenticated' };
  if (!['approved', 'rejected'].includes(decision)) return { success: false, reason: 'invalid_decision' };
  if (!String(note || '').trim()) return { success: false, reason: 'review_note_required' };

  const requestRef = firestore.collection('verificationRequests').doc(String(requestId));
  const snapshot = await requestRef.get();
  if (!snapshot.exists) return { success: false, reason: 'request_not_pending' };

  const request = snapshot.data();
  const userRef = firestore.collection('users').doc(request.targetUid || request.uploaderUid);
  const auditRef = firestore.collection('auditLogs').doc();
  const now = new Date();
  const nextTrustStatus = decision === 'approved' ? 'approved' : 'rejected';
  const roles = { volunteer_id: 'volunteer', org_authorization: 'orgAdmin', lgu_authorization: 'lguAdmin' };
  const role = roles[request.type];
  if (!role) return { success: false, reason: 'invalid_type' };
  const userStatus = decision === 'approved' ? 'active' : 'rejected';

  // Auth claims are a separate service. Repair a lost claim write on retry,
  // without repeating the review or reactivating a suspended/rejected account.
  if (request.status !== 'pending') {
    const target = await userRef.get();
    if (decision !== 'approved' || request.status !== 'approved' || !target.exists
      || target.data().role !== role || target.data().status !== 'active') {
      return { success: false, reason: 'request_not_pending' };
    }
    const account = await authAdmin.getUser(userRef.id);
    await authAdmin.setCustomUserClaims(userRef.id, { ...account.customClaims, role });
    return { success: true, status: 'approved', retried: true };
  }

  try {
    await firestore.runTransaction(async (transaction) => {
      const latest = await transaction.get(requestRef);
      const target = await transaction.get(userRef);
      if (!latest.exists || latest.data().status !== 'pending') throw new Error('request_not_pending');
      if (!target.exists || (target.data().role || target.data().requestedRole) !== role) throw new Error('role_conflict');
      if (role === 'orgAdmin') {
        if (target.data().authorizationRequestId !== requestRef.id || !target.data().orgId) throw new Error('invalid_authorization_request');
        const organization = await transaction.get(firestore.collection('organizations').doc(target.data().orgId));
        if (!organization.exists || organization.data().primaryContactUid !== userRef.id) throw new Error('invalid_authorization_request');
      }
      if (request.type === 'lgu_authorization') {
        if (!request.inviteId) throw new Error('invite_required');
        if (target.data().verificationRequestId !== requestRef.id || target.data().inviteId !== latest.data().inviteId
          || request.inviteId !== latest.data().inviteId) throw new Error('invalid_authorization_request');
        const invite = await transaction.get(firestore.collection('invites').doc(request.inviteId));
        if (!invite.exists || invite.data().kind !== 'lgu' || !invite.data().used || invite.data().usedBy !== userRef.id) throw new Error('invalid_invite');
      }
      transaction.update(requestRef, {
        status: decision,
        reviewerUid: actorUid,
        reviewNote: String(note).trim(),
        reviewedAt: now,
        updatedAt: now,
      });
      transaction.set(userRef, {
        role, trustStatus: nextTrustStatus,
        status: userStatus,
        updatedAt: now,
      }, { merge: true });
      if (role === 'orgAdmin' && target.data().orgId) {
        transaction.update(firestore.collection('organizations').doc(target.data().orgId), { status: userStatus, updatedAt: now });
      }
      transaction.set(auditRef, {
        logId: auditRef.id,
        entityType: 'verificationRequest',
        entityId: requestRef.id,
        action: `verification_${decision}`,
        actorUid,
        details: { requestType: request.type, targetUid: request.targetUid || request.uploaderUid, note: String(note).trim() },
        createdAt: now,
      });
    });

    if (decision === 'approved') {
      const account = await authAdmin.getUser(userRef.id);
      await authAdmin.setCustomUserClaims(userRef.id, { ...account.customClaims, role });
    }
    return { success: true, status: decision };
  } catch (error) {
    if (['request_not_pending','role_conflict','invite_required','invalid_invite','invalid_authorization_request'].includes(error.message)) {
      return { success: false, reason: error.message };
    }
    console.error('reviewVerificationRequest error:', error);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { reviewVerificationRequest };
