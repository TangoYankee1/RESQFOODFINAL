process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const admin = require('firebase-admin');
const assert = require('node:assert/strict');
const { signupVolunteerWithProfile, validateVolunteerProfile } = require('../functions/lib/volunteerSignup');

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const firestore = admin.firestore();
const volunteerPhone = '+63916' + String(Date.now()).slice(-7);

function validProfile() {
  return {
    fullName: 'Volunteer Example',
    nickname: 'V Example',
    phone: volunteerPhone,
    barangay: 'Lahug',
    preferredBarangays: ['Lahug'],
    availability: { 'sat-morning': true },
    transport: 'bicycle',
    commitment: 'regular',
    termsAccepted: true,
    emergencyContact: { name: 'Emergency Example', phone: '+639181234567' },
    teamCode: null,
  };
}

async function run() {
  const uid = `volunteer-test-${Date.now()}`;
  await admin.auth().deleteUser(uid).catch(() => null);
  await admin.auth().createUser({ uid, phoneNumber: volunteerPhone });

  // volunteerSignup requires a PENDING verification request uploaded by the same
  // user (self-verified volunteer_id). Seed it before signup — mirrors the real
  // flow where the volunteer uploads an ID for review first.
  const requestId = `vol-req-${Date.now()}`;
  await firestore.collection('verificationRequests').doc(requestId).set({
    uploaderUid: uid,
    targetUid: uid,
    type: 'volunteer_id',
    status: 'pending',
    createdAt: new Date(),
  });

  const result = await signupVolunteerWithProfile(firestore, admin.auth(), uid, {
    ...validProfile(),
    verificationRequestId: requestId,
  });
  if (!result.success || result.status !== 'pending_orientation') throw new Error(`signup failed: ${JSON.stringify(result)}`);

  const user = await admin.auth().getUser(uid);
  if (user.customClaims.role !== 'volunteer') throw new Error('volunteer role was not assigned server-side');

  const profile = (await firestore.collection('users').doc(uid).get()).data();
  if (profile.role !== 'volunteer' || profile.status !== 'pending_orientation') throw new Error('canonical volunteer profile is incomplete');
  assert.equal(profile.termsAccepted, true);
  assert.ok(profile.termsAcceptedAt);
  assert.equal(validateVolunteerProfile({ ...validProfile(), verificationRequestId: requestId, termsAccepted: false }).valid, false);
  assert.equal(validateVolunteerProfile({ ...validProfile(), verificationRequestId: requestId, barangay: '' }).valid, false);
  await firestore.collection('verificationRequests').doc(requestId).update({ status: 'approved' });
  await firestore.collection('users').doc(uid).update({ status: 'active', trustStatus: 'approved' });
  await admin.auth().setCustomUserClaims(uid, { preserved: true });
  const retry = await signupVolunteerWithProfile(firestore, admin.auth(), uid, { ...validProfile(), verificationRequestId: requestId });
  assert.equal(retry.status, 'active');
  assert.deepEqual((await admin.auth().getUser(uid)).customClaims, { preserved: true, role: 'volunteer' });
  await firestore.collection('users').doc(uid).update({ status: 'suspended' });
  assert.equal((await signupVolunteerWithProfile(firestore, admin.auth(), uid, { ...validProfile(), verificationRequestId: requestId })).success, false);

  const injected = { ...validProfile(), verificationRequestId: 'req-x', role: 'systemAdmin' };
  if (!validateVolunteerProfile(injected).valid) throw new Error('valid volunteer profile was rejected');
  const invalid = { ...validProfile(), verificationRequestId: 'req-x' };
  invalid.transport = 'teleport';
  if (validateVolunteerProfile(invalid).valid) throw new Error('invalid transport was accepted');

  console.log('Volunteer signup emulator test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
