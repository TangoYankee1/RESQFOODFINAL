const admin = require('firebase-admin');
const { claimDonation } = require('../functions/lib/claim');

// Initialize to point at emulator
const projectId = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
admin.initializeApp({ projectId });
const db = admin.firestore();

async function run(){
  console.log('Starting concurrent claim test on donation don_0001');

  const volA = 'uid_vol_1';
  const volB = 'uid_vol_2';

  // ensure volunteer B exists for clearer audit
  await db.collection('users').doc(volB).set({ uid: volB, role: 'volunteer', fullName: 'Volunteer Two', createdAt: new Date() });

  // run two concurrent attempts
  const p1 = claimDonation(db, 'don_0001', volA);
  const p2 = claimDonation(db, 'don_0001', volB);

  const results = await Promise.all([p1, p2].map(p => p.catch(e=>({ error: e.message }))));
  console.log('Results:', results);

  // show final donation
  const final = await db.collection('donations').doc('don_0001').get();
  console.log('Final donation data:', final.data());

  // list audit logs and notifications created
  const audits = await db.collection('auditLogs').where('donationId', '==', 'don_0001').get();
  console.log('Audit log count:', audits.size);
  const notifs = await db.collection('notifications').where('donationId', '==', 'don_0001').get();
  console.log('Notification count:', notifs.size);
}

run().catch(e=>{ console.error(e); process.exit(1); });
