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
  if (typeof profile?.address !== 'string' || profile.address.trim().length < 10 || profile.address.trim().length > 300) errors.address = 'invalid_address';
  if (coordinatorName.length < 3 || coordinatorName.length > 100) errors.coordinatorName = 'invalid_coordinator_name';
  if (!/^\+639\d{9}$/.test(phone)) errors.phone = 'invalid_phone';
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(requestId)) errors.authorizationRequest = 'invalid_authorization_request';
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

  const userRef = firestore.collection('users').doc(uid);
  // One organization per primary contact keeps the capstone schema simple.
  const orgRef = firestore.collection('organizations').doc(uid);
  const now = new Date();
  const safeProfile = {
    organizationName: String(profile.organizationName).trim(),
    organizationType: profile.organizationType,
    barangay: String(profile.barangay).trim(),
    address: profile.address.trim(),
    coordinatorName: String(profile.coordinatorName).trim(),
    coordinatorDesignation: String(profile.coordinatorDesignation || '').trim() || null,
    phoneNumber: String(profile.phone).trim(),
    authorizationRequestId: requestRef.id,
    deviceMode: profile.deviceMode,
    trainingAcknowledged: true,
    responsibilityAcknowledged: true,
    acknowledgedAt: now,
    status: 'pending_training',
    trustStatus: 'pending_review',
    profileComplete: true,
    requestedRole: 'orgAdmin',
    role: 'orgAdmin',
    orgId: orgRef.id,
    fullName: String(profile.coordinatorName).trim(),
    updatedAt: now,
    createdAt: now,
  };

  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    const requestSnapshot = await transaction.get(requestRef);
    const existingOrg = await transaction.get(orgRef);
    if (existing.exists && (existing.data().role || existing.data().requestedRole)
      && (existing.data().role || existing.data().requestedRole) !== 'orgAdmin') throw new Error('role_conflict');
    if (existing.exists && ['suspended', 'rejected'].includes(existing.data().status)) throw new Error('account_ineligible');
    if (existingOrg.exists && ['suspended', 'rejected'].includes(existingOrg.data().status)) throw new Error('account_ineligible');
    if (existing.exists && existing.data().profileComplete) {
      if (existing.data().authorizationRequestId !== requestRef.id || existing.data().orgId !== orgRef.id
        || !existingOrg.exists || existingOrg.data().primaryContactUid !== uid) throw new Error('already_registered');
      return;
    }
    if (existingOrg.exists) throw new Error('organization_exists');
    const request = requestSnapshot.data();
    if (!request || request.uploaderUid !== uid || request.targetUid !== uid
      || request.type !== 'org_authorization' || request.status !== 'pending') throw new Error('invalid_authorization_request');
    transaction.set(orgRef, {
      orgId: orgRef.id, primaryContactUid: uid, verifierUids: [uid],
      orgName: safeProfile.organizationName, orgType: safeProfile.organizationType,
      barangay: safeProfile.barangay, phone: safeProfile.phoneNumber,
      address: safeProfile.address,
      mode: safeProfile.deviceMode, status: 'pending_training', createdAt: now, updatedAt: now,
    });
    transaction.set(userRef, safeProfile, { merge: true });
    transaction.update(requestRef, { targetUid: uid, updatedAt: now });
  });

  const saved = await userRef.get();
  return { success: true, status: saved.data().status, trustStatus: saved.data().trustStatus };
}

module.exports = { signupOrgAdminWithProfile, validateOrgAdminProfile };
