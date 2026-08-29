const { FieldValue } = require('firebase-admin/firestore');

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
  try {
    // Set custom claim
    await authAdmin.setCustomUserClaims(targetUid, { role });

    // Update users/{uid}.role and write audit log in a transaction
    const userRef = firestore.collection('users').doc(targetUid);
    const auditRef = firestore.collection('auditLogs').doc();
    await firestore.runTransaction(async (tx) => {
      tx.set(userRef, { role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(auditRef, {
        logId: auditRef.id,
        entityType: 'user',
        entityId: targetUid,
        action: 'assign_role',
        actorUid: actorUid || null,
        details: { role },
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return { success: true };
  } catch (err) {
    console.error('assignRole error:', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { assignRole };
