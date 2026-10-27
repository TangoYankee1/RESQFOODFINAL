async function updateOrganizationDetails(db, uid, input = {}) {
  if (!input || typeof input !== 'object' || typeof input.address !== 'string' || input.address.trim().length < 10 || input.address.trim().length > 300
    || !['standard', 'basic'].includes(input.mode)
    || Object.keys(input).some(key => !['address', 'mode'].includes(key))) return { success: false, reason: 'invalid_details' };
  return db.runTransaction(async tx => {
    const userRef = db.collection('users').doc(uid), user = await tx.get(userRef);
    const p = user.data();
    if (!p || p.role !== 'orgAdmin' || p.status !== 'active' || !p.orgId) return { success: false, reason: 'permission-denied' };
    const orgRef = db.collection('organizations').doc(p.orgId), org = await tx.get(orgRef);
    if (!org.exists || org.data().status !== 'active' || org.data().primaryContactUid !== uid) return { success: false, reason: 'permission-denied' };
    const now = new Date(), address = input.address.trim();
    tx.update(orgRef, { address, mode: input.mode, updatedAt: now });
    tx.set(db.collection('auditLogs').doc(), { action: 'organization_details_updated', entityType: 'organization',
      entityId: orgRef.id, actorUid: uid, details: { address, mode: input.mode }, createdAt: now });
    return { success: true, address, mode: input.mode };
  });
}
module.exports = { updateOrganizationDetails };
