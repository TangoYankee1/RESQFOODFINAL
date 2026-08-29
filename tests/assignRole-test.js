process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { assignRole } = require('../functions/lib/assignRole');

async function run() {
  console.log('Running assignRole-test...');
  const actorUid = 'system_admin_uid';
  const actorRole = 'systemAdmin';
  const targetUid = 'target_user_1';
  const role = 'lguAdmin';

  const res = await assignRole(db, admin.auth(), actorUid, actorRole, targetUid, role);
  console.log('assignRole result:', res);
  if(!res.success) process.exit(1);

  const snap = await db.collection('users').doc(targetUid).get();
  console.log('User doc after assign:', snap.exists, snap.data());

  const user = await admin.auth().getUser(targetUid).catch(()=>null);
  console.log('Auth user custom claims:', user ? user.customClaims : null);

  console.log('assignRole-test complete');
}

run().catch(e=>{ console.error(e); process.exit(1); });
