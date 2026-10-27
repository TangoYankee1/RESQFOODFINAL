const ALLOWED_TRANSITIONS = {
  donor: {
    pending: ['cancelled']
  },
  volunteer: {
    scheduled: ['pending'],
    pickedUp: ['enRoute'],
    enRoute: ['delivered']
  },
  orgAdmin: {}, // Receipt confirmation requires the atomic handover command.
  // Administrators supervise accounts and reports; they do not impersonate handlers.
  lguAdmin: {},
  systemAdmin: {}
};

async function transitionDonationStatus(firestore, donationId, actorUid, nextStatus, actorRole){
  const donationRef = firestore.collection('donations').doc(donationId);

  return firestore.runTransaction(async (tx) => {
    const actor = await tx.get(firestore.collection('users').doc(actorUid));
    if (!actor.exists || actor.data().role !== actorRole || actor.data().status !== 'active') {
      return { success: false, reason: 'permission-denied' };
    }
    const snapshot = await tx.get(donationRef);
    if(!snapshot.exists){
      return { success: false, reason: 'not_found' };
    }

    const current = snapshot.data();
    const currentStatus = current.status;
    const validStatuses = ALLOWED_TRANSITIONS[actorRole] || {};
    const legalNextStatuses = validStatuses[currentStatus] || [];
    const isAllowed = legalNextStatuses.includes(nextStatus);

    if(!isAllowed){
      return { success: false, reason: 'invalid_transition', currentStatus, requestedStatus: nextStatus, actorRole };
    }

    // enforce ownership rules for donor cancellations and volunteer updates
    if(actorRole === 'donor' && current.donorId !== actorUid){
      return { success: false, reason: 'not_owner', currentStatus, requestedStatus: nextStatus };
    }

    if(actorRole === 'volunteer' && current.volunteerId !== actorUid && currentStatus !== 'pending'){
      return { success: false, reason: 'not_assigned_volunteer', currentStatus, requestedStatus: nextStatus };
    }

    const now = new Date();
    tx.update(donationRef, {
      status: nextStatus,
      ...(nextStatus === 'pending' ? { volunteerId: null, volunteerName: null } : {}),
      updatedAt: now,
      statusHistory: [...(current.statusHistory || []), { status: nextStatus, actorUid, actorRole, at: now }]
    });

    const auditRef = firestore.collection('auditLogs').doc();
    tx.set(auditRef, {
      action: 'donation_status_changed', entityType: 'donation', entityId: donationId, createdAt: now,
      type: 'donationStatusChanged',
      donationId,
      actorUid,
      actorRole,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      at: now
    });

    const recipientUid = actorRole === 'donor' ? (current.volunteerId || current.donorId) : current.donorId;
    const notificationRef = firestore.collection('notifications').doc();
    tx.set(notificationRef, {
      title: 'Donation status updated',
      body: `Donation ${donationId} moved from ${currentStatus} to ${nextStatus}.`,
      donationId,
      recipientUid,
      actorUid,
      status: nextStatus,
      createdAt: now,
      read: false
    });

    return { success: true, previousStatus: currentStatus, newStatus: nextStatus };
  });
}

module.exports = { transitionDonationStatus, ALLOWED_TRANSITIONS };
