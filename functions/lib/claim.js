const { FieldValue } = require('firebase-admin/firestore');

/**
 * Atomically claim a donation.
 * @param {FirebaseFirestore.Firestore} firestore
 * @param {string} donationId
 * @param {string} volunteerId
 * @returns {Promise<object>} result { success, reason }
 */
async function claimDonation(firestore, donationId, volunteerId){
  const donationRef = firestore.collection('donations').doc(donationId);

  return firestore.runTransaction(async (tx)=>{
    const actor = await tx.get(firestore.collection('users').doc(volunteerId));
    if (!actor.exists || actor.data().role !== 'volunteer' || actor.data().status !== 'active') {
      return { success: false, reason: 'permission-denied' };
    }
    const snap = await tx.get(donationRef);
    if(!snap.exists){
      return { success: false, reason: 'not_found' };
    }

    const data = snap.data();
    if(data.status !== 'pending'){
      return { success: false, reason: 'not_pending', currentStatus: data.status };
    }
    if (typeof data.orgId !== 'string' || !data.orgId || data.orgId.includes('/')) {
      return { success: false, reason: 'destination_required' };
    }
    {
      const org = await tx.get(firestore.collection('organizations').doc(data.orgId));
      if (!org.exists || org.data().status !== 'active') return { success: false, reason: 'destination_inactive' };
    }

    const now = new Date();
    const deadline = data.pickupWindowEnd?.toDate ? data.pickupWindowEnd.toDate() : new Date(data.pickupWindowEnd);
    if (!Number.isFinite(deadline.getTime()) || deadline <= now) return { success: false, reason: 'expired' };

    // update donation
    tx.update(donationRef, {
      status: 'scheduled',
      volunteerId: volunteerId,
      volunteerName: actor.data().fullName || actor.data().nickname || 'Volunteer',
      updatedAt: now,
      statusHistory: FieldValue.arrayUnion({ status: 'scheduled', actorUid: volunteerId, at: now })
    });

    // audit log
    const auditRef = firestore.collection('auditLogs').doc();
    tx.set(auditRef, {
      action: 'donation_claimed', entityType: 'donation', entityId: donationId, actorUid: volunteerId, createdAt: now,
      type: 'claimDonation',
      donationId,
      volunteerId,
      at: now
    });

    // notification (will be picked up by functions in prod)
    const notifRef = firestore.collection('notifications').doc();
    tx.set(notifRef, {
      title: 'Donation Claimed',
      recipientUid: data.donorId,
      body: `Donation ${donationId} was claimed by ${volunteerId}`,
      donationId,
      volunteerId,
      createdAt: now,
      read: false
    });

    return { success: true };
  });
}

module.exports = { claimDonation };
