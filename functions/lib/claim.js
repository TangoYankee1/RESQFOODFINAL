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
    const snap = await tx.get(donationRef);
    if(!snap.exists){
      return { success: false, reason: 'not_found' };
    }

    const data = snap.data();
    if(data.status !== 'pending'){
      return { success: false, reason: 'not_pending', currentStatus: data.status };
    }

    const now = new Date();

    // update donation
    tx.update(donationRef, {
      status: 'scheduled',
      volunteerId: volunteerId,
      updatedAt: now,
      statusHistory: FieldValue.arrayUnion({ status: 'scheduled', actorUid: volunteerId, at: now })
    });

    // audit log
    const auditRef = firestore.collection('auditLogs').doc();
    tx.set(auditRef, {
      type: 'claimDonation',
      donationId,
      volunteerId,
      at: now
    });

    // notification (will be picked up by functions in prod)
    const notifRef = firestore.collection('notifications').doc();
    tx.set(notifRef, {
      title: 'Donation Claimed',
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
