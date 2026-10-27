// Integration checks against running emulators; fixtures use a unique prefix.
process.env.GCLOUD_PROJECT = 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const prefix = `handover-${Date.now()}`;
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
  const donor = await user('donor','donor'), volunteer = await user('volunteer','volunteer');
  const stranger = await user('stranger','volunteer'), org = await user('org','orgAdmin');
  const verifier = await user('verifier','orgAdmin'), unrelated = await user('unrelated','orgAdmin');
  const orgId = `${prefix}-org`;
  await save('organizations', orgId, { status: 'active', primaryContactUid: org.uid, verifierUids: [org.uid,verifier.uid] });
  const donationId = `${prefix}-donation`;
  const ref = await save('donations', donationId, { status: 'scheduled', donorId: donor.uid, volunteerId: volunteer.uid, orgId,
    foodType: 'Kanin', quantityKg: 2.5, pickupWindowEnd: new Date(Date.now()+3600000), statusHistory: [], createdAt: new Date() });
  const issued = await call('issueCredential', { donationId, purpose: 'pickup' }, donor);
  assert.equal(issued.body.result.success, true, JSON.stringify(issued));
  const payload = issued.body.result.payload;
  fixtures.push(db.collection('qrNonces').doc(payload.nonce));
  const pickup = { donationId, purpose: 'pickup', mode: 'qr', proof: JSON.stringify(payload), requestId: `${prefix}-pickup` };
  await allowed('previewHandover', pickup, volunteer);
  assert.equal((await ref.get()).data().status, 'scheduled');
  assert.equal((await db.collection('qrNonces').doc(payload.nonce).get()).data().used, false, 'Preview cannot burn a credential');
  assert.equal((await db.collection('auditLogs').where('donationId','==',donationId).get()).size, 0);
  await denied('confirmHandover', pickup, stranger);
  await denied('confirmHandover', pickup, donor);
  await denied('confirmHandover', { ...pickup, purpose: 'verify' }, org);
  await denied('confirmHandover', { ...pickup, proof: JSON.stringify({ ...payload, donorId: stranger.uid }) }, volunteer);
  await denied('transitionDonationStatusCallable', { donationId, nextStatus: 'pickedUp' }, volunteer);
  await db.collection('users').doc(volunteer.uid).update({ status: 'suspended' });
  await denied('confirmHandover', pickup, volunteer);
  await db.collection('users').doc(volunteer.uid).update({ status: 'active' });
  const results = await Promise.all([call('confirmHandover', pickup, volunteer), call('confirmHandover', pickup, volunteer)]);
  assert.equal(results.filter(r=>r.body.result?.success).length,2, 'Identical retry returns the committed receipt');
  assert.equal(results.filter(r=>r.body.result?.reused).length,1);
  assert.equal((await ref.get()).data().status,'pickedUp');
  assert.equal((await db.collection('qrNonces').doc(payload.nonce).get()).data().used,true);
  fixtures.push(db.collection('handoverReceipts').doc(`${donationId}_pickup`));
  await denied('confirmHandover', { ...pickup, requestId: `${prefix}-replay` }, volunteer);
  assert.equal((await db.collection('auditLogs').where('donationId','==',donationId).get()).size,1);
  assert.equal((await db.collection('notifications').where('donationId','==',donationId).get()).size,1);
  for (const nextStatus of ['enRoute','delivered']) await allowed('transitionDonationStatusCallable',{donationId,nextStatus},volunteer);
  await allowed('confirmHandover', pickup, volunteer); // lost response retried after transport advanced.
  await denied('transitionDonationStatusCallable',{donationId,nextStatus:'verified'},org);
  const issuePin = () => call('issuePin',{donationId,purpose:'verify'},volunteer);
  let pin = (await issuePin()).body.result.pin;
  const pinRef = db.collection('pins').doc(`${donationId}_verify`); fixtures.push(pinRef);
  const receipt = { donationId, purpose:'verify', mode:'pin', proof:pin, requestId:`${prefix}-receipt` };
  await denied('confirmHandover',receipt,unrelated);
  const wrong = pin === '9999' ? '8888' : '9999';
  await Promise.all([1,2,3].map(i=>denied('confirmHandover',{...receipt,proof:wrong,requestId:`${prefix}-wrong-${i}`},org)));
  assert.equal((await pinRef.get()).data().attempts,3);
  await denied('confirmHandover',receipt,org);
  assert.equal((await ref.get()).data().status,'delivered', 'Failed proofs cannot change delivery state');
  pin = (await issuePin()).body.result.pin;
  const first = {...receipt,proof:pin}, second = {...receipt,proof:pin,requestId:`${prefix}-other-verifier`};
  const confirmed = await Promise.all([call('confirmHandover',first,org),call('confirmHandover',second,verifier)]);
  assert.equal(confirmed.filter(r=>r.body.result?.success).length,1, 'Two verifiers cannot both consume a handover');
  assert.equal((await ref.get()).data().status,'verified');
  fixtures.push(db.collection('handoverReceipts').doc(`${donationId}_verify`));
  await pinRef.update({expiresAt:new Date(Date.now()-1000)});
  const winner = confirmed[0].body.result?.success ? [first,org] : [second,verifier];
  await allowed('confirmHandover',winner[0],winner[1]); // durable success survives code expiry.
  const audits = await db.collection('auditLogs').where('donationId','==',donationId).get();
  assert.equal(audits.docs.filter(d=>d.data().action==='handover_confirmed').length,2);
  assert.equal((await ref.get()).data().statusHistory.length,4);

  const expId = `${prefix}-expired`;
  const expired = await save('donations',expId,{status:'scheduled',donorId:donor.uid,volunteerId:volunteer.uid,orgId,pickupWindowEnd:new Date(Date.now()+3600000)});
  const old = (await call('issueCredential',{donationId:expId,purpose:'pickup'},donor)).body.result.payload;
  const latest = (await call('issueCredential',{donationId:expId,purpose:'pickup'},donor)).body.result.payload;
  for(const p of [old,latest]) fixtures.push(db.collection('qrNonces').doc(p.nonce));
  const attempt = {donationId:expId,purpose:'pickup',mode:'qr',proof:JSON.stringify(old),requestId:`${prefix}-old`};
  await denied('confirmHandover',attempt,volunteer);
  await expired.update({pickupWindowEnd:new Date(Date.now()-1000)});
  await denied('confirmHandover',{...attempt,proof:JSON.stringify(latest)},volunteer);
  assert.equal((await db.collection('qrNonces').doc(latest.nonce).get()).data().used,false);
  console.log('PASS: read-only preview; atomic pickup/receipt; direct-transition bypass blocked; ownership/suspension; QR signature/purpose/replacement/expiry; concurrent PIN lock; exactly-once history/audit/notifications; durable retries after expiry');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await Promise.all(fixtures.map(ref=>ref.delete()));
  await Promise.all(accounts.map(uid=>admin.auth().deleteUser(uid)));
  await admin.app().delete();
});
