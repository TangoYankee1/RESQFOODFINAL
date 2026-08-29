process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { signupWithProfile } = require('../../functions/lib/authSignup');
const { assignRole } = require('../../functions/lib/assignRole');

async function run() {
  console.log('Running signup/admin emulator test...');

  const uid = 'signup-user-1';
  const adminUid = 'signup-admin-1';

  await admin.auth().deleteUser(uid).catch(() => null);
  await admin.auth().deleteUser(adminUid).catch(() => null);

  await admin.auth().createUser({ uid: uid, email: `${uid}@example.com`, emailVerified: true, displayName: 'Signup User' });
  await admin.auth().createUser({ uid: adminUid, email: `${adminUid}@example.com`, emailVerified: true, displayName: 'System Admin' });

  const signupRes = await signupWithProfile(db, uid, {
    fullName: 'Signup User',
    phone: '+639171234567',
    barangay: 'Lapaz'
  });
  console.log('signupWithProfile result:', signupRes);
  if (!signupRes.success) process.exit(1);

  const userSnap = await db.collection('users').doc(uid).get();
  console.log('users doc after signup:', userSnap.data());
  if (!userSnap.exists || !userSnap.data().fullName) process.exit(1);

  const assignRes = await assignRole(db, admin.auth(), adminUid, 'systemAdmin', uid, 'volunteer');
  console.log('assignRole result:', assignRes);
  if (!assignRes.success) process.exit(1);

  const claims = await admin.auth().getUser(uid);
  console.log('custom claims after assignRole:', claims.customClaims);
  if (!claims.customClaims || claims.customClaims.role !== 'volunteer') process.exit(1);

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.data() || userDoc.data().role !== 'volunteer') process.exit(1);

  console.log('signup/admin emulator test complete');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
