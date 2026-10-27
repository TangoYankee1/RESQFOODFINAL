// Shared account checks. A role describes permission; status controls activation.
async function requireActiveAccount(db, context, HttpsError) {
  if (!context?.auth) throw new HttpsError('unauthenticated', 'Sign in first');
  const snap = await db.collection('users').doc(context.auth.uid).get();
  const user = snap.exists ? snap.data() : null;
  if (!user || user.status !== 'active' || user.role !== context.auth.token.role) {
    throw new HttpsError('permission-denied', 'An active account with a current role is required');
  }
  return user;
}

async function isReceivingOrgMember(db, donation, uid) {
  if (!donation.orgId) return false;
  const org = await db.collection('organizations').doc(donation.orgId).get();
  return org.exists && org.data().status === 'active'
    && (org.data().primaryContactUid === uid || (org.data().verifierUids || []).includes(uid));
}

module.exports = { requireActiveAccount, isReceivingOrgMember };
