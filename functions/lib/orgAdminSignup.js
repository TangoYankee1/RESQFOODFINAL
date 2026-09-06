const ORG_TYPES = ['soup_kitchen', 'feeding_program', 'church_group', 'nonprofit'];
const DEVICE_MODES = ['standard', 'basic'];

function validateOrgAdminProfile(profile) {
  const errors = {};
  const organizationName = String(profile && profile.organizationName || '').trim();
  const coordinatorName = String(profile && profile.coordinatorName || '').trim();
  const phone = String(profile && profile.phone || '').trim();
  const requestId = String(profile && profile.authorizationRequestId || '').trim();

  if (organizationName.length < 3 || organizationName.length > 150) errors.organizationName = 'invalid_organization_name';
  if (!ORG_TYPES.includes(profile && profile.organizationType)) errors.organizationType = 'invalid_organization_type';
  if (!profile || !String(profile.barangay || '').trim()) errors.barangay = 'invalid_barangay';
  if (coordinatorName.length < 3 || coordinatorName.length > 100) errors.coordinatorName = 'invalid_coordinator_name';
  if (!/^\+639\d{9}$/.test(phone)) errors.phone = 'invalid_phone';
  if (!requestId) errors.authorizationRequest = 'missing_authorization_request';
  if (!DEVICE_MODES.includes(profile && profile.deviceMode)) errors.deviceMode = 'invalid_device_mode';
  if (profile && profile.trainingAcknowledged !== true) errors.trainingAcknowledged = 'training_required';
  if (profile && profile.responsibilityAcknowledged !== true) errors.responsibilityAcknowledged = 'responsibility_required';

  return { valid: Object.keys(errors).length === 0, errors };
}

async function signupOrgAdminWithProfile(firestore, uid, profile) {
  if (!uid) return { success: false, reason: 'unauthenticated' };
  const validation = validateOrgAdminProfile(profile);
  if (!validation.valid) return { success: false, reason: 'invalid_profile', errors: validation.errors };

  const requestRef = firestore.collection('verificationRequests').doc(String(profile.authorizationRequestId).trim());
  const requestSnapshot = await requestRef.get();
  if (!requestSnapshot.exists) return { success: false, reason: 'invalid_authorization_request' };
  const request = requestSnapshot.data();
  if (request.uploaderUid !== uid || request.targetUid !== uid
    || request.type !== 'org_authorization' || request.status !== 'pending') {
    return { success: false, reason: 'invalid_authorization_request' };
  }

  const userRef = firestore.collection('users').doc(uid);
  const now = new Date();
  const safeProfile = {
    organizationName: String(profile.organizationName).trim(),
    organizationType: profile.organizationType,
    barangay: String(profile.barangay).trim(),
    coordinatorName: String(profile.coordinatorName).trim(),
    coordinatorDesignation: String(profile.coordinatorDesignation || '').trim() || null,
    phoneNumber: String(profile.phone).trim(),
    authorizationRequestId: requestRef.id,
    deviceMode: profile.deviceMode,
    status: 'pending_training',
    trustStatus: 'pending_review',
    profileComplete: true,
    requestedRole: 'orgAdmin',
    updatedAt: now,
    createdAt: now,
  };

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    if (existing.exists && existing.data().role && existing.data().role !== 'orgAdmin') throw new Error('role_conflict');
    transaction.set(userRef, safeProfile, { merge: true });
    transaction.update(requestRef, { targetUid: uid, updatedAt: now });
  });

  return { success: true, status: safeProfile.status, trustStatus: safeProfile.trustStatus };
}

module.exports = { signupOrgAdminWithProfile, validateOrgAdminProfile };
