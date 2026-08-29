/**
 * Notification helper: write notifications and optional audit entries.
 * Intended to be used inside transactions or as a small Cloud Function.
 */
async function sendNotification(firestore, recipientUid, title, body, meta){
  const notifRef = firestore.collection('notifications').doc();
  const now = new Date();
  await notifRef.set({
    notificationId: notifRef.id,
    recipientUid,
    title,
    body,
    meta: meta || null,
    read: false,
    createdAt: now
  });

  // audit the notification send
  const auditRef = firestore.collection('auditLogs').doc();
  await auditRef.set({
    logId: auditRef.id,
    entityType: 'notification',
    entityId: notifRef.id,
    action: 'notification_sent',
    actorUid: meta && meta.actorUid || null,
    details: { title, body, meta },
    createdAt: now
  });

  return { success: true, notificationId: notifRef.id };
}

module.exports = { sendNotification };
