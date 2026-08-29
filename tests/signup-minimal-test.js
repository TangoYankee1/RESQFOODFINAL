process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { signupWithProfile } = require('../functions/lib/authSignup');

async function run() {
  console.log('Running signup-minimal-test...');
  const uid = 'test_user_signup_1';
  const profile = { fullName: 'Test User', phone: '+639171234567', barangay: 'Lahug' };

  const res = await signupWithProfile(db, uid, profile);
  console.log('signupWithProfile result:', res);

  const snap = await db.collection('users').doc(uid).get();
  console.log('User doc exists:', snap.exists, snap.data());

  if (!res.success) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
