// Simulate callable auth context and invoke the exported handler directly.
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { claimDonationCallableHandler } = require('../functions/index');

async function run(){
  console.log('Running callable-handler concurrent test...');

  const volA = { uid: 'uid_vol_1', token: { role: 'volunteer' } };
  const volB = { uid: 'uid_vol_2', token: { role: 'volunteer' } };

  // ensure volunteer two exists
  await db.collection('users').doc(volB.uid).set({ uid: volB.uid, role: 'volunteer', fullName: 'Volunteer Two', createdAt: new Date() });

  const p1 = claimDonationCallableHandler({ donationId: 'don_0001' }, { auth: volA });
  const p2 = claimDonationCallableHandler({ donationId: 'don_0001' }, { auth: volB });

  const results = await Promise.all([p1.catch(e=>({ error: e.code || e.message })), p2.catch(e=>({ error: e.code || e.message }))]);
  console.log('Callable results:', results);

  const final = await db.collection('donations').doc('don_0001').get();
  console.log('Final donation:', final.exists ? final.data() : 'missing');

  const audits = await db.collection('auditLogs').where('donationId', '==', 'don_0001').get();
  const notifs = await db.collection('notifications').where('donationId', '==', 'don_0001').get();
  console.log('Audit count:', audits.size, 'Notif count:', notifs.size);
}

run().catch(e=>{ console.error(e); process.exit(1); });
