const { FieldValue } = require('firebase-admin/firestore');

/**
 * Create or update a canonical user profile server-side.
 * Does NOT set `role` — role assignment is admin-only.
 */
async function signupWithProfile(firestore, uid, profile) {
  if (!uid) return { success: false, reason: 'unauthenticated' };

  const fullName = (profile && profile.fullName || '').trim();
  const phone = (profile && profile.phone || '').trim();
  const barangay = profile && profile.barangay || null;

  if (fullName.length < 3 || fullName.length > 100) return { success: false, reason: 'invalid_name' };
  if (phone && !/^\+?63\d{9,10}$/.test(phone) && !/^\d{10}$/.test(phone)) return { success: false, reason: 'invalid_phone' };

  const userRef = firestore.collection('users').doc(uid);

  try {
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const now = FieldValue.serverTimestamp();
      const docData = {
        fullName,
        phoneNumber: phone || null,
        barangay: barangay || null,
        profileComplete: true,
        updatedAt: now,
      };

      if (!snap.exists) {
        docData.createdAt = now;
        // role intentionally omitted
        tx.set(userRef, docData);
      } else {
        tx.update(userRef, docData);
      }
    });
    return { success: true };
  } catch (err) {
    console.error('signupWithProfile error:', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { signupWithProfile };
