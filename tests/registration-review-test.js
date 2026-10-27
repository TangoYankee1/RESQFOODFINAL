process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { signupOrgAdminWithProfile } = require('../functions/lib/orgAdminSignup');
const { reviewVerificationRequest } = require('../functions/lib/reviewVerification');
const { createInvite, consumeInvite } = require('../functions/lib/invite');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), prefix = `registration-review-${Date.now()}`;
const uid = `${prefix}-org`, lguUid = `${prefix}-lgu`, requestId = `${prefix}-request`;
const fixtures = [];
async function save(collection, id, data) {
  const ref = db.collection(collection).doc(id); fixtures.push(ref); await ref.set(data); return ref;
}
async function run() {
  await admin.auth().createUser({ uid }); await admin.auth().createUser({ uid: lguUid });
  await save('verificationRequests', requestId, { uploaderUid: uid, targetUid: uid, type: 'org_authorization', status: 'pending' });
  const profile = { organizationName: 'Capstone Kitchen', organizationType: 'soup_kitchen', coordinatorName: 'Test Coordinator',
    phone: '+639171234567', barangay: 'Lahug', address: '123 Test Street, Lahug, Cebu City', authorizationRequestId: requestId, deviceMode: 'basic',
    trainingAcknowledged: true, responsibilityAcknowledged: true, role: 'systemAdmin' };
  fixtures.push(db.collection('users').doc(uid), db.collection('organizations').doc(uid));
  const signup = await signupOrgAdminWithProfile(db, uid, profile);
  assert.equal(signup.success, true);
  assert.equal((await db.collection('users').doc(uid).get()).data().role, 'orgAdmin');
  assert.equal((await db.collection('organizations').doc(uid).get()).data().primaryContactUid, uid);
  const duplicateRequest = `${prefix}-duplicate-request`;
  await save('verificationRequests', duplicateRequest, { uploaderUid: uid, targetUid: uid, type: 'org_authorization', status: 'pending' });
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', duplicateRequest, 'approved', 'Duplicate must not activate organization')).success, false);
  assert.equal((await db.collection('organizations').doc(uid).get()).data().status, 'pending_training');
  const reviewed = await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', requestId, 'approved', 'Training and document checked');
  assert.equal(reviewed.success, true);
  assert.equal((await db.collection('organizations').doc(uid).get()).data().status, 'active');
  assert.equal((await admin.auth().getUser(uid)).customClaims.role, 'orgAdmin');
  await admin.auth().setCustomUserClaims(uid, { preservedClaim: true });
  const auditBeforeRetry = await db.collection('auditLogs').where('entityId', '==', requestId).get();
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', requestId, 'approved', 'Retry claim synchronization')).retried, true);
  assert.deepEqual((await admin.auth().getUser(uid)).customClaims, { preservedClaim: true, role: 'orgAdmin' });
  assert.equal((await db.collection('auditLogs').where('entityId', '==', requestId).get()).size, auditBeforeRetry.size, 'Retry must not duplicate the review audit');
  await db.collection('users').doc(uid).update({ status: 'suspended' });
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', requestId, 'approved', 'Retry cannot reactivate')).success, false);
  await db.collection('users').doc(uid).update({ status: 'active' });
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', requestId, 'rejected', 'Duplicate')).success, false);
  await signupOrgAdminWithProfile(db, uid, profile);
  assert.equal((await db.collection('users').doc(uid).get()).data().status, 'active', 'Retry cannot reset approval');

  const lguRequest = `${prefix}-lgu-request`;
  await save('users', lguUid, { requestedRole: 'lguAdmin', status: 'pending_review' });
  const request = await save('verificationRequests', lguRequest, { uploaderUid: lguUid, targetUid: lguUid, type: 'lgu_authorization', status: 'pending' });
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', lguRequest, 'approved', 'Checked')).success, false, 'No LGU activation without invite');
  const invite = await createInvite(db, 'trusted-reviewer', 'lgu');
  fixtures.push(db.collection('invites').doc(invite.inviteId));
  const consumed = await Promise.all([consumeInvite(db, invite.token, lguUid), consumeInvite(db, invite.token, uid)]);
  assert.equal(consumed.filter(r => r.success).length, 1);
  const usedBy = (await db.collection('invites').doc(invite.inviteId).get()).data().usedBy;
  // A second dedicated invite keeps the LGU approval check independent of the race winner.
  const bound = await createInvite(db, 'trusted-reviewer', 'lgu');
  fixtures.push(db.collection('invites').doc(bound.inviteId));
  await consumeInvite(db, bound.token, lguUid);
  await request.update({ inviteId: bound.inviteId });
  await db.collection('users').doc(lguUid).update({ verificationRequestId: lguRequest, inviteId: bound.inviteId });
  assert.ok(usedBy);
  assert.equal((await reviewVerificationRequest(db, admin.auth(), 'trusted-reviewer', lguRequest, 'approved', 'Invite and authorization checked')).success, true);
  assert.equal((await admin.auth().getUser(lguUid)).customClaims.role, 'lguAdmin');
  console.log('PASS: organization creation, role injection ignored, approval, retry preservation, LGU invite requirement, concurrent invite consumption');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await Promise.all(fixtures.map(ref => ref.delete()));
  await Promise.all([uid,lguUid].map(id => admin.auth().deleteUser(id).catch(() => {})));
  await admin.app().delete();
});
