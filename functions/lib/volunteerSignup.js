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
  if (!String(profile?.barangay || '').trim()) errors.barangay = 'invalid_barangay';
  if (profile?.termsAccepted !== true) errors.terms = 'terms_required';
  if (!emergencyContact.name || String(emergencyContact.name).trim().length < 3) errors.emergencyName = 'invalid_emergency_name';
  if (!isValidPhone(emergencyContact.phone)) errors.emergencyPhone = 'invalid_emergency_phone';
  if (!TRANSPORT.includes(profile && profile.transport)) errors.transport = 'invalid_transport';
  if (!COMMITMENTS.includes(profile && profile.commitment)) errors.commitment = 'invalid_commitment';
  if (!preferredBarangays.length || preferredBarangays.length > 10
    || preferredBarangays.some(value => typeof value !== 'string' || !value.trim() || value.length > 100)) errors.preferredBarangays = 'invalid_barangays';
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(verificationRequestId)) errors.verificationRequest = 'invalid_verification_request';

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
  const now = new Date();
  const safeProfile = {
    fullName: String(profile.fullName).trim(),
    phoneNumber: String(profile.phone).trim(),
    nickname: String(profile.nickname).trim(),
    barangay: String(profile.barangay || '').trim() || null,
    preferredBarangays: [...new Set(profile.preferredBarangays.map(value => value.trim()))],
    availability: Object.fromEntries(DAYS.flatMap(day => SLOTS.map(slot => `${day}-${slot}`)).map(slot => [slot, profile.availability[slot] === true])),
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
    termsAccepted: true,
    termsAcceptedAt: now,
    referralCode: String(profile.referralCode || '').trim() || null,
    updatedAt: now,
    createdAt: now,
  };

  try {
    await firestore.runTransaction(async (tx) => {
      const existing = await tx.get(userRef);
      const verificationSnapshot = await tx.get(verificationRef);
      if (existing.exists && (existing.data().role || existing.data().requestedRole)
        && (existing.data().role || existing.data().requestedRole) !== 'volunteer') {
        throw new Error('role_conflict');
      }
      if (existing.exists && ['suspended', 'rejected'].includes(existing.data().status)) throw new Error('account_ineligible');
      if (existing.exists && existing.data().profileComplete) {
        if (existing.data().verificationRequestId !== verificationRef.id) throw new Error('already_registered');
        return;
      }
      const verification = verificationSnapshot.data();
      if (!verification || verification.uploaderUid !== uid || verification.targetUid !== uid
        || verification.type !== 'volunteer_id' || verification.status !== 'pending') throw new Error('invalid_verification_request');
      tx.set(userRef, safeProfile, { merge: true });
    });
    const account = await auth.getUser(uid);
    await auth.setCustomUserClaims(uid, { ...account.customClaims, role: 'volunteer' });
    const saved = await userRef.get();
    return { success: true, status: saved.data().status };
  } catch (error) {
    if (['role_conflict', 'already_registered', 'account_ineligible', 'invalid_verification_request'].includes(error.message)) return { success: false, reason: error.message };
    console.error('signupVolunteerWithProfile error:', error);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { signupVolunteerWithProfile, validateVolunteerProfile };
