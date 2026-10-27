// Local integration test: issued OTP -> authenticated callable -> donor profile.
const assert = require('node:assert/strict');
const project = 'resqfood-ec8f5';
const authUrl = 'http://127.0.0.1:9099';
const functionUrl = `http://127.0.0.1:5001/${project}/us-central1/signupWithProfile`;

async function post(url, body, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000), // allow cold local function worker startup.
  });
  return { status: response.status, body: await response.json() };
}

async function run() {
  const phoneNumber = '+63917' + String(Date.now()).slice(-7);
  const endpoint = `${authUrl}/identitytoolkit.googleapis.com/v1/accounts`;
  const sent = await post(`${endpoint}:sendVerificationCode?key=emulator`, { phoneNumber, recaptchaToken: 'emulator' });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const codes = await fetch(`${authUrl}/emulator/v1/projects/${project}/verificationCodes`).then(r => r.json());
  const issued = codes.verificationCodes.find(c => c.phoneNumber === phoneNumber);
  assert.ok(issued, 'Emulator should issue a code');
  const wrongCode = issued.code === '000000' ? '111111' : '000000';
  const wrong = await post(`${endpoint}:signInWithPhoneNumber?key=emulator`, { sessionInfo: sent.body.sessionInfo, code: wrongCode });
  assert.notEqual(wrong.status, 200, 'Wrong OTP must be rejected');
  const signedIn = await post(`${endpoint}:signInWithPhoneNumber?key=emulator`, { sessionInfo: sent.body.sessionInfo, code: issued.code });
  assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  const profile = { fullName: 'Capstone OTP Test', phone: phoneNumber, barangay: 'Lahug', safetyConsent: true, privacyConsent: true };
  const anonymous = await post(functionUrl, { data: profile });
  assert.equal(anonymous.status, 401);
  const mismatch = await post(functionUrl, { data: { ...profile, phone: '+639171111111' } }, signedIn.body.idToken);
  assert.equal(mismatch.status, 400);
  const signup = await post(functionUrl, { data: profile }, signedIn.body.idToken);
  assert.equal(signup.status, 200, JSON.stringify(signup.body));
  assert.equal(signup.body.result.success, true);

  process.env.GCLOUD_PROJECT = project;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: project });
  try {
    const account = await admin.auth().getUser(signedIn.body.localId);
    const saved = await admin.firestore().collection('users').doc(account.uid).get();
    assert.equal(account.customClaims.role, 'donor');
    assert.equal(saved.data().role, 'donor');
    assert.equal(saved.data().status, 'active');
    console.log('PASS: issued OTP, wrong-code rejection, callable auth, verified phone, donor claim/profile');
    await saved.ref.delete();
    await admin.auth().deleteUser(account.uid);
  } finally {
    await admin.app().delete();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
