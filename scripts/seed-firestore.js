/**
 * scripts/seed-firestore.js
 *
 * Seed script skeleton for populating the local Firestore emulator with test data.
 * Usage (local emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-firestore.js
 *
 * For real projects, authenticate with a service account and set GOOGLE_APPLICATION_CREDENTIALS.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function main(){
  // If running against emulator, no credentials needed; set FIRESTORE_EMULATOR_HOST.
  // Provide a fallback projectId so the Admin SDK can initialize against the emulator.
  // For production/service-account runs, set GOOGLE_APPLICATION_CREDENTIALS or use cert(...).
  const defaultProjectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'resqfood-ec8f5';
  initializeApp({ projectId: defaultProjectId });
  const db = getFirestore();

  console.log('Seeding sample users and donations...');

  const users = [
    { uid: 'uid_donor_1', role: 'donor', fullName: 'Donor One', phoneNumber: '0900', barangay: 'Barangay 1', status: 'active' },
    { uid: 'uid_vol_1', role: 'volunteer', fullName: 'Volunteer One', phoneNumber: '0911', barangay: 'Barangay 1', status: 'active' },
    { uid: 'uid_org_1', role: 'orgAdmin', fullName: 'Org Admin', phoneNumber: '0922', barangay: 'Barangay 1', status: 'active' }
  ];

  for(const u of users){
    await db.collection('users').doc(u.uid).set({ ...u, createdAt: new Date(), updatedAt: new Date() });
  }

  const donation = {
    donationId: 'don_0001',
    donorId: 'uid_donor_1',
    volunteerId: null,
    organizationId: null,
    status: 'pending',
    foodType: 'cooked',
    quantityKg: 3.5,
    pickupWindowStart: new Date(Date.now() + 1000 * 60 * 60),
    pickupWindowEnd: new Date(Date.now() + 1000 * 60 * 60 * 3),
    pickupAddress: '123 Barangay St.',
    barangay: 'Barangay 1',
    safetyDeclared: true,
    fallbackPin: '4921',
    qrPayload: 'don_0001|4921',
    statusHistory: [{ status: 'pending', actorUid: 'uid_donor_1', at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await db.collection('donations').doc(donation.donationId).set(donation);

  console.log('Seed complete.');
}

main().catch(err=>{ console.error(err); process.exit(1); });
