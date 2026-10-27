// Integration checks against running emulators; fixtures use a unique prefix.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const prefix = `review-${Date.now()}`;
const fixtures = [];
const accounts = [];
async function save(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  fixtures.push(ref);
  await ref.set(data);
  return ref;
}
async function post(url, data, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data), signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: await r.json() };
}
async function user(label, role) {
  const uid = `${prefix}-${label}`;
  const email = `${uid}@example.com`, password = 'CapstoneTest123!';
  await admin.auth().createUser({ uid, email, password });
  accounts.push(uid);
  await admin.auth().setCustomUserClaims(uid, { role });
  await save('users', uid, { fullName: label, role, status: 'active', trustStatus: 'approved', barangay: 'Lahug' });
  const signed = await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator', { email, password, returnSecureToken: true });
  assert.equal(signed.status, 200);
  return { uid, token: signed.body.idToken };
}
async function call(name, data, actor) {
  return post(`http://127.0.0.1:5001/resqfood-ec8f5/us-central1/${name}`, { data }, actor?.token);
}
async function denied(name, data, actor) {
  const r = await call(name, data, actor);
  assert.ok(r.status >= 400 || r.body.result?.success === false, `${name} unexpectedly allowed: ${JSON.stringify(r)}`);
}
async function allowed(name, data, actor) {
  const r = await call(name, data, actor);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.result.success, true, JSON.stringify(r));
}
async function run() {
  const donor = await user('donor', 'donor'), volunteer = await user('volunteer', 'volunteer');
  const other = await user('other-volunteer', 'volunteer'), org = await user('org', 'orgAdmin');
  const unrelated = await user('other-org', 'orgAdmin'), lgu = await user('lgu', 'lguAdmin');
  const system = await user('system', 'systemAdmin');
  const orgId = `${prefix}-organization`;
  await save('organizations', orgId, { status: 'active', primaryContactUid: org.uid, verifierUids: [org.uid] });
  await save('organizations', `${prefix}-other`, { status: 'active', primaryContactUid: unrelated.uid, verifierUids: [unrelated.uid] });
  const donationId = `${prefix}-donation`;
  await save('donations', donationId, { donorId: donor.uid, orgId, status: 'pending', statusHistory: [],
    pickupWindowEnd: new Date(Date.now() + 3600000), createdAt: new Date() });
  await denied('claimDonationCallable', { donationId });
  await denied('claimDonationCallable', { donationId }, donor);
  const unroutedId = `${prefix}-unrouted`;
  await save('donations', unroutedId, { donorId: donor.uid, status: 'pending', pickupWindowEnd: new Date(Date.now() + 3600000) });
  await denied('claimDonationCallable', { donationId: unroutedId }, volunteer);
  assert.equal((await db.collection('donations').doc(unroutedId).get()).data().status, 'pending');
  const expiredId = `${prefix}-expired`;
  await save('donations', expiredId, { donorId: donor.uid, orgId, status: 'pending', pickupWindowEnd: new Date(Date.now() - 1) });
  await denied('claimDonationCallable', { donationId: expiredId }, volunteer);
  const claims = await Promise.all([call('claimDonationCallable', { donationId }, volunteer), call('claimDonationCallable', { donationId }, other)]);
  assert.equal(claims.filter(r => r.body.result?.success).length, 1, 'One competing claimant must win');
  const notifications = await db.collection('notifications').where('donationId', '==', donationId).get();
  assert.equal(notifications.size, 1);
  assert.equal(notifications.docs[0].data().recipientUid, donor.uid);
  const current = (await db.collection('donations').doc(donationId).get()).data();
  const assigned = current.volunteerId === volunteer.uid ? volunteer : other;
  const unassigned = assigned === volunteer ? other : volunteer;
  await db.collection('users').doc(donor.uid).update({ phoneNumber: '+639171234567', emergencyContact: { name: 'Private field', phone: '+639181234567' } });
  await db.collection('organizations').doc(orgId).update({ phone: '+639181234567', orgName: 'Receiving Kitchen', barangay: 'Lahug' });
  const contact = await call('volunteerMissionContact', { donationId }, assigned);
  assert.equal(contact.body.result.donor.phone, '+639171234567');
  assert.equal(contact.body.result.destination.name, 'Receiving Kitchen');
  assert.equal(contact.body.result.donor.emergencyContact, undefined, 'Contact response must not expose the donor profile');
  await denied('volunteerMissionContact', { donationId }, unassigned);
  await denied('volunteerMissionContact', { donationId }, donor);
  await db.collection('users').doc(assigned.uid).update({ status: 'suspended' });
  await denied('volunteerMissionContact', { donationId }, assigned);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pending' }, assigned);
  await db.collection('users').doc(assigned.uid).update({ status: 'active' });
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pickedUp' }, unassigned);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pickedUp' }, org);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pickedUp' }, lgu);
  await allowed('transitionDonationStatusCallable', { donationId, nextStatus: 'pending' }, assigned);
  assert.equal((await db.collection('donations').doc(donationId).get()).data().volunteerId, null);
  await allowed('claimDonationCallable', { donationId }, assigned);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pickedUp' }, assigned);
  const pickupPin = await call('issuePin', { donationId, purpose: 'pickup' }, donor);
  await allowed('confirmHandover', { donationId, purpose: 'pickup', mode: 'pin', proof: pickupPin.body.result.pin, requestId: prefix+'-pickup' }, assigned);
  for (const nextStatus of ['enRoute','delivered']) await allowed('transitionDonationStatusCallable', { donationId, nextStatus }, assigned);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'verified' }, unrelated);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'verified' }, lgu);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'verified' }, org);
  const receiptPin = await call('issuePin', { donationId, purpose: 'verify' }, assigned);
  await allowed('confirmHandover', { donationId, purpose: 'verify', mode: 'pin', proof: receiptPin.body.result.pin, requestId: prefix+'-receipt' }, org);
  await denied('assignRole', { uid: donor.uid, role: 'systemAdmin' }, lgu);
  await denied('setUserStatus', { targetUid: system.uid, status: 'suspended' }, lgu);
  await allowed('setUserStatus', { targetUid: donor.uid, status: 'suspended' }, system);
  await denied('issueCredential', { donationId }, donor); // token still says donor; live profile is suspended.
  await denied('sendNotificationCallable', { recipientUid: donor.uid, title: 'Fake', body: 'Fake' }, volunteer);
  const legacy = await post('http://127.0.0.1:5001/resqfood-ec8f5/us-central1/claimDonation', { donationId, volunteerId: other.uid });
  assert.equal(legacy.status, 410);
  console.log('PASS: five roles, competing claims, assignment, release, transport, org receipt, suspension, admin separation, retired HTTP, atomic receipt');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await Promise.all(fixtures.map(ref => ref.delete()));
  await Promise.all(accounts.map(uid => admin.auth().deleteUser(uid)));
  await admin.app().delete();
});
