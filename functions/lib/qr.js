const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');

function hashToken(token){
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a QR token: find qrCodes doc by token hash, ensure unused and unexpired,
 * then mark used and write an audit log. Returns associated metadata (e.g., donationId).
 */
async function verifyQr(firestore, token, verifierUid){
  const tokenHash = hashToken(token);
  const q = await firestore.collection('qrCodes').where('tokenHash','==',tokenHash).limit(1).get();
  if(q.empty) return { success: false, reason: 'not_found' };
  const doc = q.docs[0];
  const data = doc.data();
  const now = new Date();
  if(data.used) return { success: false, reason: 'used' };
  if(data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() < now) return { success: false, reason: 'expired' };

  const qrRef = firestore.collection('qrCodes').doc(doc.id);
  const auditRef = firestore.collection('auditLogs').doc();
  try{
    await firestore.runTransaction(async (tx)=>{
      tx.update(qrRef, { used: true, usedBy: verifierUid || null, usedAt: FieldValue.serverTimestamp() });
      tx.set(auditRef, {
        logId: auditRef.id,
        entityType: 'qrCode',
        entityId: qrRef.id,
        action: 'verify_qr',
        actorUid: verifierUid || null,
        details: { donationId: data.donationId || null },
        createdAt: FieldValue.serverTimestamp()
      });
    });
    return { success: true, donationId: data.donationId || null };
  }catch(err){
    console.error('verifyQr transaction error', err);
    return { success: false, reason: 'internal' };
  }
}

module.exports = { verifyQr };
