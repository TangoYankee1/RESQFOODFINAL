// Minimal contact details for the currently assigned handler, never board-wide profiles.
async function volunteerMissionContact(db, uid, donationId) {
  if (typeof donationId !== 'string' || !donationId || donationId.includes('/')) return { success: false, reason: 'invalid_argument' };
  const donation = await db.collection('donations').doc(donationId).get();
  if (!donation.exists) return { success: false, reason: 'not_found' };
  const d = donation.data();
  if (d.volunteerId !== uid) return { success: false, reason: 'permission-denied' };
  const [donor, org] = await Promise.all([
    db.collection('users').doc(d.donorId).get(),
    d.orgId ? db.collection('organizations').doc(d.orgId).get() : null,
  ]);
  const donorData = donor.data() || {}, orgData = org?.data() || {};
  const phone = value => /^\+639\d{9}$/.test(value || '') ? value : null;
  return { success: true,
    donor: { name: donorData.businessName || donorData.fullName || d.donorName || 'Donor', phone: phone(donorData.phoneNumber) },
    destination: { name: orgData.orgName || d.orgName || 'Receiving organization', phone: phone(orgData.phone),
      address: orgData.address || null, barangay: orgData.barangay || null } };
}
module.exports = { volunteerMissionContact };
