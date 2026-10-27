/**
 * Create or update a canonical user profile server-side.
 * New users receive the donor role. Another role cannot use donor signup.
 *
 * Timestamps use `new Date()` (server-generated) to match every other lib in
 * this codebase (assignRole, claim, invite, lifecycle, pin, qr, …). We
 * deliberately avoid FieldValue.serverTimestamp() here: the repo has two
 * copies of @google-cloud/firestore (root + functions/), and a sentinel
 * minted by one copy is rejected by the serializer of the other with a
 * "custom prototypes / ServerTimestampTransform" error.
 */
async function signupWithProfile(firestore, uid, profile) {
  if (!uid) return { success: false, reason: 'unauthenticated' };

  const fullName = String(profile && profile.fullName || '').trim();
  const phone = String(profile && profile.phone || '').trim();
  const barangay = profile && profile.barangay || null;

  if (fullName.length < 3 || fullName.length > 100) return { success: false, reason: 'invalid_name' };
  if (phone && !/^\+?63\d{9,10}$/.test(phone) && !/^\d{10}$/.test(phone)) return { success: false, reason: 'invalid_phone' };
  const donorType = profile.donorType || 'individual';
  if (!['individual', 'business'].includes(donorType)) return { success: false, reason: 'invalid_donor_type' };
  const businessName = String(profile.businessName || '').trim();
  if (donorType === 'business' && (businessName.length < 2 || businessName.length > 150)) return { success: false, reason: 'invalid_business_name' };
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return { success: false, reason: 'invalid_email' };
  if (String(profile.address || '').length > 200) return { success: false, reason: 'invalid_address' };
  if (String(profile.permitNumber || '').length > 100) return { success: false, reason: 'invalid_permit' };

  const userRef = firestore.collection('users').doc(uid);

  try {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (snap.exists && snap.data().role && snap.data().role !== 'donor') throw new Error('role_conflict');
      const consentRef = firestore.collection('consentRecords').doc(`${uid}_donor_v1-2026-10`);
      const consent = await tx.get(consentRef);
      const now = new Date();
      const docData = {
        fullName,
        phoneNumber: phone || null,
        barangay: barangay || null,
        email: profile.email || null, address: String(profile.address || '').trim() || null,
        donorType, businessName: donorType === 'business' ? businessName : null,
        permitNumber: donorType === 'business' ? String(profile.permitNumber || '').trim() || null : null,
        profileComplete: true,
        updatedAt: now,
      };

      if (!snap.exists) {
        docData.createdAt = now;
        docData.role = 'donor';
        docData.status = 'active';
        tx.set(userRef, docData);
      } else {
        if (!snap.data().role) docData.role = 'donor';
        if (!snap.data().status) docData.status = 'active';
        tx.update(userRef, docData);
      }
      if (!consent.exists && profile.safetyConsent === true && profile.privacyConsent === true) {
        tx.create(consentRef, { uid, version: 'v1-2026-10', kinds: ['safety', 'privacy'], acceptedAt: now, createdAt: now });
      }
    });
    return { success: true };
  } catch (err) {
    if (err.message === 'role_conflict') return { success: false, reason: 'role_conflict' };
    console.error('signupWithProfile error:', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { signupWithProfile };
