
/**
 * Assign a role to a user. Must be called by a system-admin.
 * - firestore: admin.firestore()
 * - authAdmin: admin.auth()
 * - actorUid: uid of caller
 * - actorRole: role of caller (should be 'system-admin')
 * - targetUid: uid to assign
 * - role: new role string
 */
async function assignRole(firestore, authAdmin, actorUid, actorRole, targetUid, role) {
  const ALLOWED_ROLES = ['donor','volunteer','orgAdmin','lguAdmin','systemAdmin'];
  // Require canonical role name
  if (actorRole !== 'systemAdmin') return { success: false, reason: 'permission-denied' };
  if (!ALLOWED_ROLES.includes(role)) return { success: false, reason: 'invalid_role' };
  // Only the trusted local bootstrap may establish the singleton administrator.
  if (role === 'systemAdmin') return { success: false, reason: 'permission-denied' };
  if (typeof targetUid !== 'string' || !targetUid || targetUid.includes('/')) return { success: false, reason: 'invalid_target' };
  try {
    const [actor, target, singleton] = await Promise.all([
      firestore.collection('users').doc(actorUid).get(),
      firestore.collection('users').doc(targetUid).get(),
      firestore.doc('systemConfig/systemAdministrator').get(),
    ]);
    if (!actor.exists || actor.data().role !== 'systemAdmin' || actor.data().status !== 'active') return { success: false, reason: 'permission-denied' };
    if (targetUid === actorUid || target.data()?.role === 'systemAdmin' || singleton.data()?.uid === targetUid) return { success: false, reason: 'permission-denied' };
    // Set custom claim
    const account = await authAdmin.getUser(targetUid);
    if (account.customClaims?.role === 'systemAdmin') return { success: false, reason: 'permission-denied' };
    await authAdmin.setCustomUserClaims(targetUid, { ...account.customClaims, role });

    // Update users/{uid}.role and write audit log in a transaction
    const userRef = firestore.collection('users').doc(targetUid);
    const auditRef = firestore.collection('auditLogs').doc();
    const now = new Date();
    await firestore.runTransaction(async (tx) => {
      tx.set(userRef, { role, updatedAt: now }, { merge: true });
      tx.set(auditRef, {
        logId: auditRef.id,
        entityType: 'user',
        entityId: targetUid,
        action: 'assign_role',
        actorUid: actorUid || null,
        details: { role },
        createdAt: now
      });
    });
    return { success: true };
  } catch (err) {
    console.error('assignRole error:', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { assignRole };
