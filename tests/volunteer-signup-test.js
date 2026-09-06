process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const admin = require('firebase-admin');
const { signupVolunteerWithProfile, validateVolunteerProfile } = require('../functions/lib/volunteerSignup');

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const firestore = admin.firestore();

function validProfile() {
  return {
    fullName: 'Volunteer Example',
    nickname: 'V Example',
    phone: '+639171234567',
    barangay: 'Lahug',
    preferredBarangays: ['Lahug'],
    availability: { 'sat-morning': true },
    transport: 'bicycle',
    commitment: 'regular',
    emergencyContact: { name: 'Emergency Example', phone: '+639181234567' },
    teamCode: null,
  };
}

async function run() {
  const uid = `volunteer-test-${Date.now()}`;
  await admin.auth().deleteUser(uid).catch(() => null);
  await admin.auth().createUser({ uid, phoneNumber: '+639171234567' });

  const result = await signupVolunteerWithProfile(firestore, admin.auth(), uid, validProfile());
  if (!result.success || result.status !== 'pending_orientation') throw new Error(`signup failed: ${JSON.stringify(result)}`);

  const user = await admin.auth().getUser(uid);
  if (user.customClaims.role !== 'volunteer') throw new Error('volunteer role was not assigned server-side');

  const profile = (await firestore.collection('users').doc(uid).get()).data();
  if (profile.role !== 'volunteer' || profile.status !== 'pending_orientation') throw new Error('canonical volunteer profile is incomplete');

  const injected = validProfile();
  injected.role = 'systemAdmin';
  if (!validateVolunteerProfile(injected).valid) throw new Error('valid volunteer profile was rejected');
  const invalid = validProfile();
  invalid.transport = 'teleport';
  if (validateVolunteerProfile(invalid).valid) throw new Error('invalid transport was accepted');

  console.log('Volunteer signup emulator test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});