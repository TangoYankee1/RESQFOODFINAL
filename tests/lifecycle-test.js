process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { transitionDonationStatus } = require('../functions/lib/lifecycle');

async function run(){
  const donationId = 'don_lifecycle_test';
  const donorId = 'uid_donor_1';
  const volunteerId = 'uid_vol_1';

  await db.collection('donations').doc(donationId).set({
    donationId,
    donorId,
    volunteerId,
    status: 'scheduled',
    foodType: 'cooked',
    quantityKg: 2,
    pickupAddress: 'Test address',
    statusHistory: [{ status: 'scheduled', actorUid: volunteerId, actorRole: 'volunteer', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const first = await transitionDonationStatus(db, donationId, volunteerId, 'pickedUp', 'volunteer');
  console.log('first transition:', first);

  const second = await transitionDonationStatus(db, donationId, volunteerId, 'scheduled', 'volunteer');
  console.log('second transition (invalid):', second);

  const final = await db.collection('donations').doc(donationId).get();
  console.log('final status:', final.data().status);
  const auditCount = await db.collection('auditLogs').where('donationId', '==', donationId).get();
  const notifCount = await db.collection('notifications').where('donationId', '==', donationId).get();
  console.log('audit count:', auditCount.size, 'notification count:', notifCount.size);
}

run().catch((err)=>{ console.error(err); process.exit(1); });
