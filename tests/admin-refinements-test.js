process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { exportCsv, toCsv } = require('../functions/lib/csvExport');
const { createInvite } = require('../functions/lib/invite');
const { signupLguWithProfile } = require('../functions/lib/lguSignup');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), prefix = `admin-refinements-${Date.now()}`, refs = [];
const actorUid = `${prefix}-reviewer`;
async function save(collection, id, data) {
  const ref = db.collection(collection).doc(id); refs.push(ref); await ref.set(data); return ref;
}
async function invite(meta = {}, hours = 72) {
  const value = await createInvite(db, actorUid, 'lgu', meta, hours);
  assert.equal(value.success, true);
  refs.push(db.collection('invites').doc(value.inviteId));
  return value;
}
async function request(uid, inviteId) {
  const id = `${uid}-request`;
  await save('verificationRequests', id, { uploaderUid: uid, targetUid: uid, type: 'lgu_authorization', status: 'pending', inviteId });
  refs.push(db.collection('users').doc(uid));
  return id;
}
async function run() {
  const barangay = `${prefix}-barangay`, now = new Date();
  await save('donations', `${prefix}-unrelated`, { barangay: 'Other', status: 'verified', foodType: 'Unrelated', createdAt: new Date(now.getTime()+1000) });
  await save('donations', `${prefix}-wrong-status`, { barangay, status: 'pending', createdAt: now });
  await save('donations', `${prefix}-matching`, { barangay, status: 'verified', foodType: '=HYPERLINK("bad")', quantityKg: 2, createdAt: new Date(now.getTime()-1000) });
  await save('donations', `${prefix}-old`, { barangay, status: 'verified', foodType: 'Old', createdAt: new Date(now.getTime()-40*86400000) });
  const exported = await exportCsv(db, { actorUid, actorRole: 'lguAdmin', barangay, status: 'verified', range: '7', max: 1 });
  assert.equal(exported.rowCount, 1, 'Filters must precede the row limit');
  assert.ok(exported.csv.includes(`${prefix}-matching`));
  assert.ok(exported.csv.includes("'=HYPERLINK"));
  assert.equal((await exportCsv(db, { actorUid, actorRole: 'donor' })).success, false);
  assert.equal((await exportCsv(db, { actorUid, actorRole: 'systemAdmin', range: 'invalid' })).success, false);
  assert.equal(toCsv([['a\rb', '\t=1', '+1', '-1', '@SUM(A1)', 'a"b']]), '"a\rb",\'\t=1,\'+1,\'-1,\'@SUM(A1),"a""b"');
  const action = `${prefix}-action`;
  await save('auditLogs', `${prefix}-modern`, { action, actorUid, entityType: 'user', entityId: 'modern', createdAt: now });
  await save('auditLogs', `${prefix}-legacy`, { type: action, uid: actorUid, donationId: 'legacy-donation', at: new Date(now.getTime()-1000) });
  const audit = await exportCsv(db, { kind: 'audit', actorUid, actorRole: 'systemAdmin', action, max: 2 });
  assert.equal(audit.rowCount, 2);
  assert.ok(audit.csv.includes('legacy-donation'));
  assert.ok(audit.csv.includes('modern'));
  assert.equal((await createInvite(db, actorUid, 'systemAdmin', {}, 72)).success, false);
  assert.equal((await createInvite(db, actorUid, 'lgu', {}, -1)).success, false);

  const bound = await invite({ email: 'official@barangay.gov.ph', allowedDomain: 'barangay.gov.ph', barangay: 'Lahug' });
  const uid = `${prefix}-applicant`, requestId = await request(uid, bound.inviteId);
  const profile = { token: bound.token, verificationRequestId: requestId, fullName: 'Test LGU Applicant', designation: 'Coordinator',
    email: 'official@barangay.gov.ph', phone: '+639171234567', barangay: 'Lahug', auditAcknowledged: true };
  assert.equal((await signupLguWithProfile(db, uid, { ...profile, email: 'other@barangay.gov.ph' })).reason, 'invite_mismatch');
  assert.equal((await signupLguWithProfile(db, uid, { ...profile, barangay: 'Mabolo' })).reason, 'invite_mismatch');
  assert.equal((await db.collection('invites').doc(bound.inviteId).get()).data().used, false);
  assert.equal((await signupLguWithProfile(db, uid, profile)).success, true);
  assert.equal((await db.collection('users').doc(uid).get()).data().role, undefined);
  assert.equal((await db.collection('users').doc(uid).get()).data().emailVerified, false);
  await db.collection('invites').doc(bound.inviteId).update({ expiresAt: new Date(0) });
  await db.collection('users').doc(uid).update({ status: 'active', role: 'lguAdmin' });
  assert.equal((await signupLguWithProfile(db, uid, profile)).status, 'active', 'Retry cannot reset approval');
  await db.collection('users').doc(uid).update({ status: 'suspended' });
  assert.equal((await signupLguWithProfile(db, uid, profile)).success, false);
  const expired = await invite();
  const expiredUid = `${prefix}-expired`, expiredRequest = await request(expiredUid, expired.inviteId);
  await db.collection('invites').doc(expired.inviteId).update({ expiresAt: new Date(0) });
  assert.equal((await signupLguWithProfile(db, expiredUid, { ...profile, token: expired.token, verificationRequestId: expiredRequest })).reason, 'expired_invite');
  const race = await invite();
  const contenders = [`${prefix}-race-a`, `${prefix}-race-b`];
  const raceRequests = await Promise.all(contenders.map(id => request(id, race.inviteId)));
  const results = await Promise.all(contenders.map((id, i) => signupLguWithProfile(db, id, { ...profile, token: race.token, verificationRequestId: raceRequests[i] })));
  assert.equal(results.filter(r => r.success).length, 1, 'Only one application may consume the invite');
  console.log('PASS: filtered/limited CSV, formula escaping, legacy audit normalization, invite validation, bound LGU application, expiry, retry preservation, concurrent submission.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all(refs.map(ref => ref.delete()));
  const audits = await db.collection('auditLogs').where('actorUid', '==', actorUid).get();
  await Promise.all(audits.docs.map(d => d.ref.delete()));
  await admin.app().delete();
});
