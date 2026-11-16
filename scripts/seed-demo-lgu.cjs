// Local demonstration fixtures only. No SMS or email is sent.
const admin = require('firebase-admin');
const fs = require('node:fs');
const path = require('node:path');
const { createInvite } = require('../functions/lib/invite');
const { signupLguWithProfile } = require('../functions/lib/lguSignup');
const { reviewVerificationRequest } = require('../functions/lib/reviewVerification');
const sitios = require('../functions/lib/lahug-sitios.json');
for (const [name, fallback] of Object.entries({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199' })) {
  const value = process.env[name] || fallback;
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(value)) throw new Error('Loopback emulators required.');
  process.env[name] = value;
}
const app = admin.initializeApp({ projectId: 'resqfood-ec8f5', storageBucket: 'resqfood-ec8f5.appspot.com' });
const db = app.firestore(), auth = app.auth();
const fixtures = [
  ['01', 'Maria Elena Santos', 'ACACIA', 'Demo Food Assistance Coordinator'],
  ['02', 'Jose Miguel Reyes', 'ANAPOG', 'Demo Community Welfare Coordinator'],
  ['03', 'Ana Patricia Cruz', 'SAN JOSE', 'Demo Food Rescue Coordinator'],
  ['04', 'Carlo Daniel Mendoza', 'SUDLON', 'Demo Community Operations Coordinator'],
].map(([id, name, sitio, designation]) => ({ uid: `demo-lgu-${id}`, fullName: `${name} (Demo)`,
  sitio, coveredSitios: [sitio], designation, barangay: 'Lahug', city: 'Cebu City',
  address: `Demo coordination desk, Sitio ${sitio}, Barangay Lahug, Cebu City`,
  email: `lgu.demo${id}@resqfood.example`, phoneNumber: `+6391700091${id}`,
  demo: true, fixtureSource: 'seed-demo-lgu-v1', coverageNote: 'Demonstration assignment only; LGU permissions remain barangay-wide.' }));

function demoPdf(name, sitio) {
  const lines = ['RESQFOOD - DEMO AUTHORIZATION FIXTURE', 'NOT AN OFFICIAL GOVERNMENT DOCUMENT', name, `Assigned sitio: ${sitio}, Barangay Lahug`, 'For local thesis demonstration only. No real appointment or signature.'];
  const stream = 'BT /F1 12 Tf 45 760 Td ' + lines.map((line, i) => `${i ? '0 -24 Td ' : ''}(${line.replace(/[()\\]/g, '\\$&')}) Tj`).join('\n') + '\nET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function run() {
  const singleton = await db.doc('systemConfig/systemAdministrator').get();
  const actorUid = singleton.data()?.uid;
  if (!actorUid) throw new Error('Run seed:app-admin first.');
  const actor = await db.doc(`users/${actorUid}`).get();
  if (actor.data()?.role !== 'systemAdmin' || actor.data()?.status !== 'active') throw new Error('Active system admin required.');
  // Preflight all identities before creating any fixtures.
  for (const f of fixtures) {
    if (!sitios.includes(f.sitio)) throw new Error('Unknown sitio');
    const p = await db.doc(`users/${f.uid}`).get();
    if (p.exists && p.data().fixtureSource !== f.fixtureSource) throw new Error(`Existing profile conflict: ${f.uid}`);
    for (const lookup of [() => auth.getUser(f.uid), () => auth.getUserByEmail(f.email), () => auth.getUserByPhoneNumber(f.phoneNumber)]) {
      const u = await lookup().catch(e => { if (e.code === 'auth/user-not-found') return null; throw e; });
      if (u && (u.uid !== f.uid || u.email !== f.email || u.phoneNumber !== f.phoneNumber || u.customClaims?.role === 'systemAdmin')) throw new Error(`Existing Auth identity conflict: ${f.uid}`);
    }
  }
  for (const f of fixtures) {
    const userRef = db.doc(`users/${f.uid}`);
    const existing = await userRef.get();
    if (existing.data()?.status === 'active' && existing.data()?.trustStatus === 'approved') {
      const u = await auth.getUser(f.uid);
      if (u.disabled || u.customClaims?.role !== 'lguAdmin') throw new Error(`Existing fixture needs manual recovery: ${f.uid}`);
      continue;
    }
    if (existing.exists && existing.data().status !== 'pending_review') throw new Error(`Existing fixture not eligible: ${f.uid}`);
    let account = await auth.getUser(f.uid).catch(e => { if (e.code === 'auth/user-not-found') return null; throw e; });
    if (!account) account = await auth.createUser({ uid: f.uid, displayName: f.fullName, email: f.email, phoneNumber: f.phoneNumber, emailVerified: false });
    const requestId = `demo-lgu-authorization-${f.uid}`;
    if (!existing.exists) {
      const invite = await createInvite(db, actorUid, 'lgu', { email: f.email, barangay: 'Lahug', demo: true }, 72);
      if (!invite.success) throw new Error('Invite fixture creation failed');
      const storagePath = `authorization-letters/${f.uid}/lgu/demo-authorization.pdf`;
      await app.storage().bucket().file(storagePath).save(demoPdf(f.fullName, f.sitio), { contentType: 'application/pdf', resumable: false });
      await db.doc(`verificationRequests/${requestId}`).set({ requestId, uploaderUid: f.uid, targetUid: f.uid,
        type: 'lgu_authorization', status: 'pending', inviteId: invite.inviteId, storagePath,
        demo: true, createdAt: new Date(), updatedAt: new Date() });
      const result = await signupLguWithProfile(db, f.uid, { ...f, phone: f.phoneNumber, auditAcknowledged: true, verificationRequestId: requestId, token: invite.token });
      if (!result.success) throw new Error(`Signup failed: ${result.reason}`);
      await userRef.set({ ...f, profileComplete: true }, { merge: true });
    }
    const reviewed = await reviewVerificationRequest(db, auth, actorUid, requestId, 'approved', 'Local DEMO fixture only. Fictional identity and authorization; not a real LGU appointment.');
    if (!reviewed.success) throw new Error(`Review failed: ${reviewed.reason}`);
  }
  for (const f of fixtures) {
    const u = await auth.getUser(f.uid), p = (await db.doc(`users/${f.uid}`).get()).data();
    if (u.customClaims?.role !== 'lguAdmin' || p.status !== 'active' || p.trustStatus !== 'approved' || p.sitio !== f.sitio) throw new Error(`Verification failed: ${f.uid}`);
  }
  const directory = path.join(__dirname, '../.local-config');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'demo-lgu-accounts.json'), JSON.stringify({ login: 'http://localhost:5000/admin/login.html', authentication: 'Phone OTP from Auth emulator terminal; no password or actual SMS', accounts: fixtures }, null, 2));
  console.log('Verified four active, approved demo LGU accounts. Details: .local-config/demo-lgu-accounts.json');
  for (const f of fixtures) console.log(`${f.fullName} | ${f.phoneNumber} | ${f.sitio}`);
}
run().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => app.delete());
