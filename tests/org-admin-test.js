process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { signupOrgAdminWithProfile, validateOrgAdminProfile } = require('../functions/lib/orgAdminSignup');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), prefix = `org-review-${Date.now()}`, refs = [], accounts = [];
async function save(collection, id, data) { const ref = db.collection(collection).doc(id); refs.push(ref); await ref.set(data); return ref; }
async function actor(label, role, orgId) {
  const uid = `${prefix}-${label}`; accounts.push(uid);
  await admin.auth().createUser({ uid }); await admin.auth().setCustomUserClaims(uid, { role });
  await save('users', uid, { role, orgId: orgId || null, status: 'active' });
  const token = await admin.auth().createCustomToken(uid);
  const signed = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, returnSecureToken: true }),
  }).then(r => r.json());
  assert.ok(signed.idToken); return { uid, token: signed.idToken };
}
async function update(data, user) {
  const result = await fetch('http://127.0.0.1:5001/resqfood-ec8f5/us-central1/updateOrganizationDetails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) },
    body: JSON.stringify({ data }), signal: AbortSignal.timeout(45000),
  });
  return { status: result.status, body: await result.json() };
}
async function run() {
  const orgId = `${prefix}-organization`;
  const primary = await actor('primary', 'orgAdmin', orgId), secondary = await actor('secondary', 'orgAdmin', orgId);
  const outsider = await actor('outsider', 'orgAdmin', `${prefix}-other`), donor = await actor('donor', 'donor');
  const orgRef = await save('organizations', orgId, { status: 'active', primaryContactUid: primary.uid, verifierUids: [primary.uid, secondary.uid] });
  const details = { address: '123 Capstone Street, Lahug, Cebu City', mode: 'basic' };
  assert.equal((await update(details)).status, 401);
  for (const user of [secondary, outsider, donor]) assert.equal((await update(details, user)).status, 403);
  assert.equal((await update({ ...details, address: 'short' }, primary)).status, 400);
  assert.equal((await update({ ...details, status: 'active' }, primary)).status, 400);
  assert.equal((await update(details, primary)).body.result.success, true);
  assert.equal((await orgRef.get()).data().address, details.address);
  const audit = await db.collection('auditLogs').where('actorUid', '==', primary.uid).get();
  assert.equal(audit.docs.filter(d => d.data().action === 'organization_details_updated').length, 1);
  await orgRef.update({ status: 'suspended' });
  assert.equal((await update(details, primary)).status, 403);
  await orgRef.update({ status: 'active' });
  await db.collection('users').doc(primary.uid).update({ status: 'suspended' });
  assert.equal((await update(details, primary)).status, 403);

  const uid = `${prefix}-signup`, requestId = `${prefix}-request`;
  const userRef = db.collection('users').doc(uid); refs.push(userRef, db.collection('organizations').doc(uid));
  const request = await save('verificationRequests', requestId, { uploaderUid: uid, targetUid: uid, type: 'org_authorization', status: 'pending' });
  const profile = { organizationName: 'New Test Kitchen', organizationType: 'feeding_program', coordinatorName: 'Test Coordinator',
    coordinatorDesignation: 'Coordinator', barangay: 'Lahug', address: details.address, phone: '+639171234567', authorizationRequestId: requestId,
    deviceMode: 'basic', trainingAcknowledged: true, responsibilityAcknowledged: true };
  assert.equal(validateOrgAdminProfile({ ...profile, address: '' }).valid, false);
  assert.equal(validateOrgAdminProfile({ ...profile, trainingAcknowledged: false }).valid, false);
  assert.equal((await signupOrgAdminWithProfile(db, uid, profile)).status, 'pending_training');
  const userProfile = (await userRef.get()).data();
  assert.equal(userProfile.trainingAcknowledged, true); assert.equal(userProfile.responsibilityAcknowledged, true);
  assert.equal((await db.collection('organizations').doc(uid).get()).data().address, details.address);
  await request.update({ status: 'approved' });
  await userRef.update({ status: 'active', trustStatus: 'approved' });
  await db.collection('organizations').doc(uid).update({ status: 'active', address: '456 Updated Street, Lahug, Cebu City' });
  assert.equal((await signupOrgAdminWithProfile(db, uid, profile)).status, 'active');
  assert.equal((await db.collection('organizations').doc(uid).get()).data().address, '456 Updated Street, Lahug, Cebu City');
  await userRef.update({ status: 'rejected' });
  await assert.rejects(signupOrgAdminWithProfile(db, uid, profile), /account_ineligible/);
  await userRef.update({ status: 'active' });
  await db.collection('organizations').doc(uid).update({ status: 'suspended' });
  await assert.rejects(signupOrgAdminWithProfile(db, uid, profile), /account_ineligible/);
  const conflict = `${prefix}-collision`;
  await save('organizations', conflict, { primaryContactUid: 'someone-else', status: 'active' });
  await assert.rejects(signupOrgAdminWithProfile(db, conflict, profile), /organization_exists/);
  assert.equal((await db.collection('organizations').doc(conflict).get()).data().primaryContactUid, 'someone-else');
  console.log('PASS: org address/acknowledgments, approved signup retry, suspension/rejection, collision protection, primary-only validated/audited details command.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const uid of accounts) {
    const audit = await db.collection('auditLogs').where('actorUid', '==', uid).get();
    await Promise.all(audit.docs.map(d => d.ref.delete()));
    await admin.auth().deleteUser(uid).catch(() => {});
  }
  await Promise.all(refs.map(ref => ref.delete())); await admin.app().delete();
});
