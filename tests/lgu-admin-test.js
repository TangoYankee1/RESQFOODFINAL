process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { setUserStatus } = require('../functions/lib/adminActions');
const { reviewVerificationRequest } = require('../functions/lib/reviewVerification');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), prefix = `lgu-audit-${Date.now()}`, refs = [];
async function save(collection, id, data) {
  const ref = db.collection(collection).doc(id); refs.push(ref); await ref.set(data); return ref;
}
async function run() {
  const actorUid = prefix + '-actor', primary = prefix + '-primary', secondary = prefix + '-secondary', orgId = prefix + '-org';
  const actor = await save('users', actorUid, { role: 'lguAdmin', status: 'active' });
  const org = await save('organizations', orgId, { primaryContactUid: primary, verifierUids: [secondary], status: 'active' });
  for (const uid of [primary, secondary]) await save('users', uid, { role: 'orgAdmin', status: 'active', trustStatus: 'approved', orgId });
  const change = (targetUid, status) => setUserStatus(db, { actorUid, actorRole: 'lguAdmin', targetUid, status });
  assert.equal((await change(secondary, 'suspended')).success, true);
  assert.equal((await org.get()).data().status, 'active', 'Secondary suspension must not suspend the organization');
  assert.equal((await change(primary, 'suspended')).success, true);
  assert.equal((await org.get()).data().status, 'suspended');
  assert.equal((await change(secondary, 'active')).success, true);
  assert.equal((await org.get()).data().status, 'suspended', 'Secondary activation must not reactivate the organization');
  assert.equal((await change(primary, 'active')).success, true);
  const before = await db.collection('auditLogs').where('actorUid', '==', actorUid).get();
  await change(primary, 'active');
  assert.equal((await db.collection('auditLogs').where('actorUid', '==', actorUid).get()).size, before.size, 'No duplicate audit for unchanged status');
  assert.equal((await change(actorUid, 'suspended')).success, false);
  const pending = prefix + '-pending';
  await save('users', pending, { role: 'volunteer', status: 'pending_training', trustStatus: 'pending' });
  assert.equal((await change(pending, 'active')).reason, 'approval_required');
  await actor.update({ status: 'suspended' });
  assert.equal((await change(primary, 'suspended')).reason, 'permission-denied');
  const applicant = prefix + '-applicant', request = prefix + '-duplicate', inviteId = prefix + '-invite';
  await save('users', applicant, { role: 'lguAdmin', status: 'active', verificationRequestId: 'canonical', inviteId });
  await save('invites', inviteId, { kind: 'lgu', used: true, usedBy: applicant });
  await save('verificationRequests', request, { targetUid: applicant, uploaderUid: applicant, type: 'lgu_authorization', status: 'pending', inviteId });
  assert.equal((await reviewVerificationRequest(db, {}, actorUid, request, 'rejected', 'Duplicate')).reason, 'invalid_authorization_request');
  assert.equal((await db.collection('users').doc(applicant).get()).data().status, 'active');
  console.log('PASS: LGU live permissions, approval boundaries, primary/secondary organization status, idempotent audit, canonical LGU review');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  const logs = await db.collection('auditLogs').where('actorUid', '==', prefix + '-actor').get();
  await Promise.all([...refs, ...logs.docs.map(doc => doc.ref)].map(ref => ref.delete()));
  await admin.app().delete();
});
