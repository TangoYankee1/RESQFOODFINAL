const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SLOTS = ['morning', 'afternoon', 'evening'];
const TRANSPORT = ['walk', 'bicycle', 'motorcycle', 'car'];
const COMMITMENTS = ['regular', 'backup'];

function isValidPhone(phone) {
  return /^\+639\d{9}$/.test(phone || '');
}

function validateVolunteerProfile(profile) {
  const errors = {};
  const fullName = String(profile && profile.fullName || '').trim();
  const nickname = String(profile && profile.nickname || '').trim();
  const phone = String(profile && profile.phone || '').trim();
  const emergencyContact = profile && profile.emergencyContact || {};
  const availability = profile && profile.availability || {};
  const preferredBarangays = Array.isArray(profile && profile.preferredBarangays)
    ? profile.preferredBarangays : [];
  const verificationRequestId = String(profile && profile.verificationRequestId || '').trim();

  if (fullName.length < 3 || fullName.length > 100) errors.fullName = 'invalid_name';
  if (nickname.length < 2 || nickname.length > 40) errors.nickname = 'invalid_nickname';
  if (!isValidPhone(phone)) errors.phone = 'invalid_phone';
  if (!emergencyContact.name || String(emergencyContact.name).trim().length < 3) errors.emergencyName = 'invalid_emergency_name';
  if (!isValidPhone(emergencyContact.phone)) errors.emergencyPhone = 'invalid_emergency_phone';
  if (!TRANSPORT.includes(profile && profile.transport)) errors.transport = 'invalid_transport';
  if (!COMMITMENTS.includes(profile && profile.commitment)) errors.commitment = 'invalid_commitment';
  if (!preferredBarangays.length || preferredBarangays.length > 10) errors.preferredBarangays = 'invalid_barangays';
  if (!verificationRequestId) errors.verificationRequest = 'missing_verification_request';

  const selectedSlots = DAYS.flatMap((day) => SLOTS.map((slot) => `${day}-${slot}`))
    .filter((slot) => availability[slot] === true);
  if (!selectedSlots.length) errors.availability = 'invalid_availability';

  return { valid: Object.keys(errors).length === 0, errors };
}

async function signupVolunteerWithProfile(firestore, auth, uid, profile) {
  if (!uid) return { success: false, reason: 'unauthenticated' };

  const validation = validateVolunteerProfile(profile);
  if (!validation.valid) return { success: false, reason: 'invalid_profile', errors: validation.errors };

  const userRef = firestore.collection('users').doc(uid);
  const verificationRef = firestore.collection('verificationRequests').doc(String(profile.verificationRequestId).trim());
  const verificationSnapshot = await verificationRef.get();
  if (!verificationSnapshot.exists) return { success: false, reason: 'invalid_verification_request' };
  const verification = verificationSnapshot.data();
  if (verification.uploaderUid !== uid || verification.targetUid !== uid
    || verification.type !== 'volunteer_id' || verification.status !== 'pending') {
    return { success: false, reason: 'invalid_verification_request' };
  }
  const now = new Date();
  const safeProfile = {
    fullName: String(profile.fullName).trim(),
    phoneNumber: String(profile.phone).trim(),
    nickname: String(profile.nickname).trim(),
    barangay: String(profile.barangay || '').trim() || null,
    preferredBarangays: profile.preferredBarangays,
    availability: profile.availability,
    transport: profile.transport,
    commitment: profile.commitment,
    emergencyContact: {
      name: String(profile.emergencyContact.name).trim(),
      phone: String(profile.emergencyContact.phone).trim(),
    },
    teamCode: String(profile.teamCode || '').trim() || null,
    status: 'pending_orientation',
    profileComplete: true,
    role: 'volunteer',
    trustStatus: 'pending_review',
    verificationRequestId: verificationRef.id,
    referralCode: String(profile.referralCode || '').trim() || null,
    updatedAt: now,
    createdAt: now,
  };

  try {
    await firestore.runTransaction(async (tx) => {
      const existing = await tx.get(userRef);
      if (existing.exists && existing.data().role && existing.data().role !== 'volunteer') {
        throw new Error('role_conflict');
      }
      tx.set(userRef, safeProfile, { merge: true });
    });
    await auth.setCustomUserClaims(uid, { role: 'volunteer' });
    return { success: true, status: safeProfile.status };
  } catch (error) {
    console.error('signupVolunteerWithProfile error:', error);
    if (error.message === 'role_conflict') return { success: false, reason: 'role_conflict' };
    return { success: false, reason: 'internal' };
  }
}

module.exports = { signupVolunteerWithProfile, validateVolunteerProfile };