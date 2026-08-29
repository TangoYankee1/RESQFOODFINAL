process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { sendNotification } = require('../functions/lib/notify');

async function run(){
  console.log('Running notification helper test...');
  const recipient = 'uid_donor_1';
  const title = 'Test Notification';
  const body = 'This is a test from the notification helper.';

  const res = await sendNotification(db, recipient, title, body, { actorUid: 'uid_system' });
  console.log('sendNotification result:', res);

  const notifSnap = await db.collection('notifications').doc(res.notificationId).get();
  console.log('Stored notification exists:', notifSnap.exists, notifSnap.data());

  const auditQ = await db.collection('auditLogs').where('entityId', '==', res.notificationId).get();
  console.log('Audit entries for notification:', auditQ.size);
}

run().catch(e=>{ console.error(e); process.exit(1); });
