const admin = require('firebase-admin');

async function reviewVerificationRequest(firestore, authAdmin, actorUid, requestId, decision, note) {
  if (!actorUid) return { success: false, reason: 'unauthenticated' };
  if (!['approved', 'rejected'].includes(decision)) return { success: false, reason: 'invalid_decision' };
  if (!String(note || '').trim()) return { success: false, reason: 'review_note_required' };

  const requestRef = firestore.collection('verificationRequests').doc(String(requestId));
  const snapshot = await requestRef.get();
  if (!snapshot.exists || snapshot.data().status !== 'pending') return { success: false, reason: 'request_not_pending' };

  const request = snapshot.data();
  const userRef = firestore.collection('users').doc(request.targetUid || request.uploaderUid);
  const auditRef = firestore.collection('auditLogs').doc();
  const now = new Date();
  const nextTrustStatus = decision === 'approved' ? 'approved' : 'rejected';
  const userStatus = decision === 'approved' && request.type === 'lgu_authorization' ? 'active' : 'pending_review';

  try {
    await firestore.runTransaction(async (transaction) => {
      transaction.update(requestRef, {
        status: decision,
        reviewerUid: actorUid,
        reviewNote: String(note).trim(),
        reviewedAt: now,
        updatedAt: now,
      });
      transaction.set(userRef, {
        trustStatus: nextTrustStatus,
        status: userStatus,
        updatedAt: now,
      }, { merge: true });
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

    if (decision === 'approved' && request.type === 'lgu_authorization') {
      await authAdmin.setCustomUserClaims(request.targetUid || request.uploaderUid, { role: 'lguAdmin' });
      await userRef.set({ role: 'lguAdmin', updatedAt: now }, { merge: true });
    }
    return { success: true, status: decision };
  } catch (error) {
    console.error('reviewVerificationRequest error:', error);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { reviewVerificationRequest };
