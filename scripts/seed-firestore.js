// Emulator-only fixtures using the same canonical donation command as the app.
// Existing fixture profiles/approval state and existing missions are preserved.
const admin = require('firebase-admin');
const { createDonorDonation } = require('../functions/lib/donor');
const projectId = 'resqfood-ec8f5';
for (const [key, fallback] of Object.entries({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })) {
  const value = process.env[key] || fallback;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(value)) throw new Error(`${key} must point to a local emulator`);
  process.env[key] = value;
}
admin.initializeApp({ projectId });
const db = admin.firestore();
const orgId = 'capstone-kitchen-1';
const users = [
  { uid:'capstone-donor-1', role:'donor', fullName:'Capstone Donor', phoneNumber:'+639170001001' },
  { uid:'capstone-volunteer-1', role:'volunteer', fullName:'Capstone Volunteer', phoneNumber:'+639170001002' },
  { uid:'capstone-org-1', role:'orgAdmin', fullName:'Capstone Receiver', phoneNumber:'+639170001003', orgId },
];
async function run() {
  for (const user of users) {
    let account;
    try { account = await admin.auth().getUser(user.uid); }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      account = await admin.auth().createUser({ uid:user.uid, phoneNumber:user.phoneNumber, displayName:user.fullName });
    }
    if (account.phoneNumber !== user.phoneNumber) throw new Error(`Fixture identity conflict: ${user.uid}`);
    const profile = db.collection('users').doc(user.uid);
    const current = await profile.get();
    if (current.exists && current.data().role !== user.role) throw new Error(`Fixture role conflict: ${user.uid}`);
    if (!current.exists) await profile.create({ ...user, barangay:'Lahug', address:'Capstone fixture address, Lahug',
      status:'active', trustStatus:'approved', profileComplete:true, createdAt:new Date(), updatedAt:new Date() });
    await admin.auth().setCustomUserClaims(user.uid, { ...account.customClaims, role:user.role });
  }
  const org = db.collection('organizations').doc(orgId);
  if (!(await org.get()).exists) await org.create({ orgId, orgName:'Capstone Kitchen', barangay:'Lahug',
    address:'123 Demo Street, Lahug, Cebu City', phone:users[2].phoneNumber,
    status:'active', primaryContactUid:'capstone-org-1', verifierUids:['capstone-org-1'], mode:'standard', createdAt:new Date() });
  const result = await createDonorDonation(db, 'capstone-donor-1', {
    requestId:`seed-${Date.now()}`, foodType:'Kanin', quantityKg:3.5,
    description:'Fictional emulator fixture', pickupAddress:'Capstone fixture address, Lahug', orgId,
    pickupWindowStart:new Date(Date.now()+60000).toISOString(), pickupWindowEnd:new Date(Date.now()+3600000).toISOString(),
    safetyDeclared:true, postingConfirmed:true,
  });
  if (!result.success) throw new Error(result.reason);
  console.log(`Local fixture ready: ${result.donationId}. QR/PIN must be issued through the app; none are hardcoded.`);
}
run().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>admin.app().delete());
