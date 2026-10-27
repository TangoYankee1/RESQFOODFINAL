// Donor commands. Identity comes from Auth; amounts/times/destination are validated here.
const crypto = require('node:crypto');
const HOLD_HOURS = { Kanin: 6, Tinapay: 6, Gulay: 4, Tinapa: 4, Manok: 3, Baboy: 3, Processed: 3, Other: 2 };
const asDate = value => value?.toDate ? value.toDate() : new Date(value);

async function listDonationDestinations(db) {
  const snapshot = await db.collection('organizations').where('status', '==', 'active').get();
  return { success: true, organizations: snapshot.docs.map(doc => ({
    id: doc.id, name: doc.data().orgName || 'Organization', barangay: doc.data().barangay || '',
  })) };
}

async function donorMissionContact(db, uid, donationId) {
  if (typeof donationId !== 'string' || !donationId || donationId.includes('/')) return { success: false, reason: 'invalid_donation' };
  const donation = await db.collection('donations').doc(donationId).get();
  if (!donation.exists) return { success: false, reason: 'not_found' };
  const d = donation.data();
  if (d.donorId !== uid) return { success: false, reason: 'permission-denied' };
  if (!d.volunteerId || !['scheduled','pickedUp','enRoute','delivered'].includes(d.status)) return { success: false, reason: 'no_assigned_volunteer' };
  const volunteer = await db.collection('users').doc(d.volunteerId).get();
  const phone = volunteer.data()?.phoneNumber || '';
  return { success: true, name: volunteer.data()?.fullName || 'Volunteer', phone: /^\+639\d{9}$/.test(phone) ? phone : null };
}

function validateDonation(input, now = new Date()) {
  const p = input || {};
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(p.requestId || '')) return 'invalid_request_id';
  if (!Object.hasOwn(HOLD_HOURS, p.foodType)) return 'invalid_food_type';
  if (typeof p.quantityKg !== 'number' || !Number.isFinite(p.quantityKg) || p.quantityKg < 0.1 || p.quantityKg > 500) return 'invalid_quantity';
  if (typeof p.pickupAddress !== 'string' || p.pickupAddress.trim().length < 5 || p.pickupAddress.length > 200) return 'invalid_address';
  if (typeof p.description !== 'string' || p.description.length > 300) return 'invalid_description';
  if (typeof p.orgId !== 'string' || !p.orgId || p.orgId.includes('/')) return 'destination_required';
  if (p.safetyDeclared !== true || p.postingConfirmed !== true) return 'safety_confirmation_required';
  const start = asDate(p.pickupWindowStart), end = asDate(p.pickupWindowEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end <= now) return 'invalid_pickup_window';
  // Allow a five-minute form-entry grace for an immediate pickup start.
  if (start.getTime() < now.getTime() - 300000 || end.getTime() > now.getTime() + HOLD_HOURS[p.foodType] * 3600000) return 'outside_pickup_policy';
  return null;
}

async function createDonorDonation(db, uid, input) {
  // Retry lookup precedes time validation: a lost response must not duplicate a post.
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(input?.requestId || '')) return { success: false, reason: 'invalid_request_id' };
  const ref = db.collection('donations').doc(`${uid}_${input.requestId}`);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify([
    input.foodType, input.quantityKg, input.description, input.pickupAddress, input.orgId,
    input.pickupWindowStart, input.pickupWindowEnd, input.safetyDeclared, input.postingConfirmed,
  ])).digest('hex');
  return db.runTransaction(async tx => {
    const user = await tx.get(db.collection('users').doc(uid));
    if (!user.exists || user.data().role !== 'donor' || user.data().status !== 'active') return { success: false, reason: 'permission-denied' };
    const existing = await tx.get(ref);
    if (existing.exists) return existing.data().requestFingerprint === fingerprint
      ? { success: true, donationId: ref.id, reused: true }
      : { success: false, reason: 'request_conflict' };
    const now = new Date(), invalid = validateDonation(input, now);
    if (invalid) return { success: false, reason: invalid };
    const org = await tx.get(db.collection('organizations').doc(input.orgId));
    if (!org.exists || org.data().status !== 'active') return { success: false, reason: 'destination_inactive' };
    const profile = user.data();
    const audit = db.collection('auditLogs').doc();
    tx.create(ref, {
      donationId: ref.id, donorId: uid, donorName: profile.businessName || profile.fullName || 'Donor',
      barangay: profile.barangay || null, orgId: org.id, orgName: org.data().orgName || 'Organization',
      foodType: input.foodType, quantityKg: input.quantityKg, description: input.description.trim(),
      pickupAddress: input.pickupAddress.trim(), pickupWindowStart: asDate(input.pickupWindowStart),
      pickupWindowEnd: asDate(input.pickupWindowEnd), status: 'pending', volunteerId: null,
      safetyDeclared: true, postingConfirmed: true, safetyDeclaredAt: now,
      requestFingerprint: fingerprint, createdAt: now, updatedAt: now,
      statusHistory: [{ status: 'pending', actorUid: uid, actorRole: 'donor', at: now }],
    });
    tx.set(audit, { action: 'donation_created', entityType: 'donation', entityId: ref.id,
      donationId: ref.id, actorUid: uid, actorRole: 'donor', createdAt: now });
    return { success: true, donationId: ref.id, reused: false };
  });
}

async function cancelDonorDonation(db, uid, donationId) {
  if (typeof donationId !== 'string' || !donationId || donationId.includes('/')) return { success: false, reason: 'invalid_donation' };
  return db.runTransaction(async tx => {
    const ref = db.collection('donations').doc(donationId), snap = await tx.get(ref);
    if (!snap.exists) return { success: false, reason: 'not_found' };
    const d = snap.data();
    if (d.donorId !== uid) return { success: false, reason: 'permission-denied' };
    if (d.status === 'cancelled') return { success: true, reused: true };
    if (d.status !== 'pending') return { success: false, reason: 'already_claimed' };
    const now = new Date();
    const expired = asDate(d.pickupWindowEnd) <= now;
    const status = expired ? 'expired' : 'cancelled';
    tx.update(ref, { status, updatedAt: now, statusHistory: [...(d.statusHistory || []), { status, actorUid: uid, actorRole: 'donor', at: now }] });
    tx.set(db.collection('auditLogs').doc(), { action: `donation_${status}`, entityType: 'donation',
      entityId: donationId, donationId, actorUid: uid, createdAt: now });
    return { success: true, status };
  });
}

// Lazy expiry keeps the capstone free of scheduler services. Opening the donor
// board refreshes expired pending posts; claims still enforce deadlines independently.
async function refreshDonorExpiry(db, uid) {
  const pending = await db.collection('donations').where('donorId', '==', uid).where('status', '==', 'pending').get();
  let expiredCount = 0;
  for (const doc of pending.docs) {
    if (asDate(doc.data().pickupWindowEnd) <= new Date()) {
      const result = await cancelDonorDonation(db, uid, doc.id);
      if (result.status === 'expired') expiredCount++;
    }
  }
  return { success: true, expiredCount };
}

module.exports = { HOLD_HOURS, validateDonation, listDonationDestinations, createDonorDonation, cancelDonorDonation, refreshDonorExpiry, donorMissionContact };
