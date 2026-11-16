const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const admin = require('firebase-admin');
process.env.GCLOUD_PROJECT = `demo-admin-${Date.now()}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
delete process.env.APP_ADMIN_EMAIL;
const { provision } = require('../scripts/seed-app-admin');
const { assignRole } = require('../functions/lib/assignRole');
const { setUserStatus } = require('../functions/lib/adminActions');
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const auth = app.auth(), db = app.firestore();
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resqfood-admin-test-'));
const credential = () => JSON.parse(fs.readFileSync(path.join(directory, 'system-admin-credentials.json')));
async function login(email, password) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ email, password, returnSecureToken: true, targetProjectId: process.env.GCLOUD_PROJECT }),
  });
  return response.ok;
}
async function run() {
  const first = await provision({ directory });
  const before = credential();
  assert.equal(first.created, true);
  assert.ok(before.password.length >= 32);
  assert.equal(await login(before.email, before.password), true);
  const initial = (await db.doc(`users/${first.uid}`).get()).data();
  await auth.setCustomUserClaims(first.uid, { role: 'systemAdmin', preserved: true });
  const again = await provision({ directory });
  assert.equal(again.created, false);
  assert.equal(credential().password, before.password);
  assert.equal((await db.doc(`users/${first.uid}`).get()).data().createdAt.toMillis(), initial.createdAt.toMillis());
  process.env.APP_ADMIN_EMAIL = 'second@resqfood.local';
  await assert.rejects(provision({ directory }), /second email/);
  delete process.env.APP_ADMIN_EMAIL;
  const other = await auth.createUser({ email: 'normal@resqfood.local' });
  await db.doc(`users/${other.uid}`).set({ role: 'donor', status: 'active' });
  assert.equal((await assignRole(db, auth, first.uid, 'systemAdmin', other.uid, 'systemAdmin')).success, false);
  assert.equal((await assignRole(db, auth, first.uid, 'systemAdmin', first.uid, 'donor')).success, false);
  assert.equal((await assignRole(db, auth, other.uid, 'systemAdmin', first.uid, 'donor')).success, false);
  assert.equal((await assignRole(db, auth, first.uid, 'systemAdmin', other.uid, 'volunteer')).success, true);
  assert.equal((await setUserStatus(db, { targetUid: first.uid, actorUid: first.uid, actorRole: 'systemAdmin', status: 'suspended' })).success, false);
  await db.doc(`users/${other.uid}`).set({ role: 'lguAdmin', status: 'active' }, { merge: true });
  await db.doc(`users/${first.uid}`).update({ role: 'donor' });
  assert.equal((await setUserStatus(db, { targetUid: first.uid, actorUid: other.uid, actorRole: 'lguAdmin', status: 'suspended' })).success, false);
  await assert.rejects(provision({ directory }), /recovery/);
  await auth.updateUser(first.uid, { disabled: true });
  await provision({ directory, reset: true });
  const after = credential();
  assert.notEqual(after.password, before.password);
  assert.equal(await login(before.email, before.password), false);
  assert.equal(await login(after.email, after.password), true);
  assert.equal((await auth.getUser(first.uid)).customClaims.preserved, true);
  assert.equal((await db.doc(`users/${first.uid}`).get()).data().createdAt.toMillis(), initial.createdAt.toMillis());
  await auth.setCustomUserClaims(other.uid, { role: 'systemAdmin' });
  await assert.rejects(provision({ directory }), /Multiple administrator/);
  assert.equal((await auth.getUser(other.uid)).customClaims.role, 'systemAdmin');
  console.log('PASS: singleton setup, idempotency, role/status protection, recovery and password login. Isolated emulator project only.');
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await app.delete();
  fs.rmSync(directory, { recursive: true, force: true });
});
