// functions/lib/adminActions.js
// Audited admin status changes (PROD.MD): user + audit written atomically so
// no suspension/activation ever happens without an immutable trail.
async function setUserStatus(firestore, { targetUid, status, actorUid, actorRole, reason }) {
  if (!['lguAdmin', 'systemAdmin'].includes(actorRole)) return { success: false, reason: 'permission-denied' };
  if (typeof targetUid !== 'string' || !targetUid || targetUid.includes('/')) return { success: false, reason: 'invalid_target' };
  if (!['active', 'suspended', 'pending_training'].includes(status)) return { success: false, reason: 'invalid_status' };
  if (reason != null && (typeof reason !== 'string' || reason.length > 1000)) return { success: false, reason: 'invalid_reason' };
  const userRef = firestore.collection('users').doc(targetUid);
  const auditRef = firestore.collection('auditLogs').doc();
  const now = new Date();
  let failure = null;
  await firestore.runTransaction(async (tx) => {
    failure = null;
    const actor = await tx.get(firestore.collection('users').doc(actorUid));
    if (!actor.exists || actor.data().status !== 'active' || actor.data().role !== actorRole) { failure = 'permission-denied'; return; }
    const snap = await tx.get(userRef);
    if (!snap.exists) { failure = 'not_found'; return; }
    const target = snap.data();
    if (targetUid === actorUid || (actorRole === 'lguAdmin' && !['donor', 'volunteer', 'orgAdmin'].includes(target.role))) {
      failure = 'permission-denied'; return;
    }
    if (status === 'active' && ['volunteer', 'orgAdmin', 'lguAdmin'].includes(target.role) && target.trustStatus !== 'approved') {
      failure = 'approval_required'; return;
    }
    if (target.status === status) return;
    if (target.role === 'orgAdmin' && target.orgId) {
      const orgRef = firestore.collection('organizations').doc(target.orgId);
      const org = await tx.get(orgRef);
      if (!org.exists) { failure = 'organization_not_found'; return; }
      if (org.data().primaryContactUid === targetUid) tx.update(orgRef, { status, updatedAt: now });
    }
    tx.set(userRef, { status, updatedAt: now }, { merge: true });
    tx.set(auditRef, {
      logId: auditRef.id, entityType: 'user', entityId: targetUid,
      action: status === 'suspended' ? 'user_suspended' : status === 'active' ? 'user_activated' : 'user_status_changed',
      actorUid: actorUid || null,
      details: { from: snap.data().status || null, to: status, reason: reason || null },
      createdAt: now,
    });
  });
  if (failure) return { success: false, reason: failure };
  return { success: true, targetUid, status };
}

module.exports = { setUserStatus };
