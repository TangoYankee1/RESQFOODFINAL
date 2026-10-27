// Run against Auth/Firestore/Functions emulators. Uses real issued OTP/callables.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(), prefix = `donor-test-${Date.now()}`, users = [], refs = [];
async function post(url, body, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  return { status: r.status, body: await r.json() };
}
const call = (name, data, user) => post(`http://127.0.0.1:5001/resqfood-ec8f5/us-central1/${name}`, { data }, user?.token);
async function ok(name, data, user) {
  const r = await call(name, data, user); assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.body.result.success, true, JSON.stringify(r)); return r.body.result;
}
async function denied(name, data, user) {
  const r = await call(name, data, user); assert.ok(r.status >= 400, `${name} should fail: ${JSON.stringify(r)}`);
}
async function phoneUser(offset) {
  const phoneNumber = '+63918' + String(Date.now() + offset).slice(-7);
  const auth = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts';
  const sent = await post(`${auth}:sendVerificationCode?key=emulator`, { phoneNumber, recaptchaToken: 'emulator' });
  const codes = await fetch('http://127.0.0.1:9099/emulator/v1/projects/resqfood-ec8f5/verificationCodes').then(r => r.json());
  const code = codes.verificationCodes.find(c => c.phoneNumber === phoneNumber).code;
  const signed = await post(`${auth}:signInWithPhoneNumber?key=emulator`, { sessionInfo: sent.body.sessionInfo, code });
  const user = { uid: signed.body.localId, token: signed.body.idToken, phone: phoneNumber };
  users.push(user.uid); return user;
}
async function refreshToken(user) {
  const token = await admin.auth().createCustomToken(user.uid);
  const signed = await post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator', { token, returnSecureToken: true });
  assert.equal(signed.status, 200); user.token = signed.body.idToken;
}
async function run() {
  const donor = await phoneUser(1), other = await phoneUser(2);
  const signup = user => ({ fullName: 'Capstone Donor', phone: user.phone, barangay: 'Lahug',
    email: 'donor@example.com', address: 'Example Street, Lahug', donorType: 'business', businessName: 'Capstone Eatery', permitNumber: 'CAPSTONE-ONLY-123',
    safetyConsent: true, privacyConsent: true, role: 'systemAdmin' });
  await denied('signupWithProfile', { ...signup(donor), safetyConsent: false }, donor);
  for (const user of [donor,other]) {
    await ok('signupWithProfile', signup(user), user); await refreshToken(user);
    refs.push(db.collection('users').doc(user.uid), db.collection('consentRecords').doc(`${user.uid}_donor_v1-2026-10`));
  }
  const profile = (await db.collection('users').doc(donor.uid).get()).data();
  assert.equal(profile.role, 'donor'); assert.equal(profile.businessName, 'Capstone Eatery'); assert.equal(profile.address, 'Example Street, Lahug');
  assert.equal(profile.permitNumber, 'CAPSTONE-ONLY-123');
  const orgId = `${prefix}-org`, org = db.collection('organizations').doc(orgId); refs.push(org);
  await org.set({ orgName: 'Capstone Kitchen', status: 'active', barangay: 'Lahug', primaryContactUid: 'test-contact', verifierUids: [] });
  assert.ok((await ok('listDonationDestinations', {}, donor)).organizations.some(o => o.id === orgId));
  const payload = { requestId: `${prefix}-post`, foodType: 'Kanin', quantityKg: 2.5, description: 'Capstone fixture', pickupAddress: profile.address,
    orgId, pickupWindowStart: new Date(Date.now()+60000).toISOString(), pickupWindowEnd: new Date(Date.now()+3600000).toISOString(), safetyDeclared: true, postingConfirmed: true,
    donorId: other.uid, status: 'verified', points: 9999 };
  await denied('createDonorDonation', { ...payload, quantityKg: -1 }, donor);
  await denied('createDonorDonation', { ...payload, safetyDeclared: false }, donor);
  await denied('createDonorDonation', { ...payload, pickupWindowEnd: new Date(Date.now()+7*3600000).toISOString() }, donor);
  await denied('createDonorDonation', { ...payload, orgId: 'missing-organization' }, donor);
  const created = await ok('createDonorDonation', payload, donor);
  const donation = db.collection('donations').doc(created.donationId); refs.push(donation);
  const stored = (await donation.get()).data();
  assert.equal(stored.donorId, donor.uid); assert.equal(stored.status, 'pending'); assert.equal(stored.orgId, orgId); assert.equal(stored.points, undefined);
  const retry = await ok('createDonorDonation', payload, donor); assert.equal(retry.donationId, created.donationId); assert.equal(retry.reused, true);
  await denied('createDonorDonation', { ...payload, quantityKg: 3 }, donor);
  await denied('cancelDonorDonation', { donationId: donation.id }, other);
  await denied('issueCredential', { donationId: donation.id }, other);
  const qr = await ok('issueCredential', { donationId: donation.id, purpose: 'pickup' }, donor);
  refs.push(db.collection('qrNonces').doc(qr.payload.nonce));
  assert.equal(qr.payload.purpose, 'pickup'); assert.ok(qr.payload.expiresAt <= stored.pickupWindowEnd.toMillis());
  const regenerated = await ok('issueCredential', { donationId: donation.id, purpose: 'pickup' }, donor);
  refs.push(db.collection('qrNonces').doc(regenerated.payload.nonce));
  assert.notEqual(qr.payload.nonce, regenerated.payload.nonce);
  assert.equal((await donation.get()).data().pickupNonce, regenerated.payload.nonce);
  await denied('issueCredential', { donationId: donation.id, purpose: 'verify' }, donor);
  const pin = await ok('issuePin', { donationId: donation.id, purpose: 'pickup' }, donor);
  refs.push(db.collection('pins').doc(`${donation.id}_pickup`)); assert.match(pin.pin, /^\d{4}$/);
  const cancelled = await ok('cancelDonorDonation', { donationId: donation.id }, donor); assert.equal(cancelled.status, 'cancelled');
  assert.equal((await ok('cancelDonorDonation', { donationId: donation.id }, donor)).reused, true);
  await denied('issueCredential', { donationId: donation.id }, donor);
  await denied('issuePin', { donationId: donation.id, purpose: 'pickup' }, donor);
  const audits = await db.collection('auditLogs').where('donationId', '==', donation.id).get();
  assert.equal(audits.docs.filter(d => d.data().action === 'donation_created').length, 1);
  assert.equal(audits.docs.filter(d => d.data().action === 'donation_cancelled').length, 1);
  await admin.auth().setCustomUserClaims(other.uid, { role: 'volunteer' });
  await db.collection('users').doc(other.uid).update({ role: 'volunteer', status: 'active' });
  await refreshToken(other);
  const racePost = await ok('createDonorDonation', { ...payload, requestId: `${prefix}-race` }, donor);
  const raceDoc = db.collection('donations').doc(racePost.donationId); refs.push(raceDoc);
  const race = await Promise.all([call('cancelDonorDonation', { donationId: raceDoc.id }, donor), call('claimDonationCallable', { donationId: raceDoc.id }, other)]);
  assert.equal(race.filter(r => r.body.result?.success === true).length, 1, 'Cancellation and claim cannot both win');
  await donation.update({ status: 'scheduled', volunteerId: other.uid });
  await denied('cancelDonorDonation', { donationId: donation.id }, donor);
  assert.equal((await ok('donorMissionContact', { donationId: donation.id }, donor)).phone, other.phone);
  await denied('donorMissionContact', { donationId: donation.id }, other);
  await donation.update({ status: 'pending', pickupWindowEnd: new Date(Date.now()-1000) });
  await ok('refreshDonorExpiry', {}, donor);
  assert.equal((await donation.get()).data().status, 'expired');
  const statsSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/js/core/donorStats.js'), 'utf8');
  const { donorStats } = await import('data:text/javascript;base64,' + Buffer.from(statsSource).toString('base64'));
  assert.deepEqual(donorStats([{ status: 'verified', quantityKg: 2.5 }, { status: 'cancelled' }, { status: 'expired' }]),
    { totalDonations: 3, verifiedCount: 1, cancelledCount: 1, expiredCount: 1, totalDonatedKg: 2.5, points: 10, reliabilityScore: 5 });
  await db.collection('users').doc(donor.uid).update({ status: 'suspended' });
  await denied('createDonorDonation', { ...payload, requestId: `${prefix}-suspended` }, donor);
  console.log('PASS: donor OTP/profile/consent, destination, validated and idempotent posting, ownership, pickup QR/PIN, audited cancellation, expiry, derived statistics, suspension');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await Promise.all(refs.map(ref => ref.delete())); await Promise.all(users.map(uid => admin.auth().deleteUser(uid)));
  await admin.app().delete();
});
