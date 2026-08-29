process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'resqfood-ec8f5';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();

const { verifyQr } = require('../functions/lib/qr');
const crypto = require('crypto');

function hashToken(token){ return crypto.createHash('sha256').update(token).digest('hex'); }

async function run(){
  console.log('Running qr-test...');
  const token = crypto.randomBytes(16).toString('hex');
  const tokenHash = hashToken(token);
  const docRef = db.collection('qrCodes').doc();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60*60*1000);
  await docRef.set({ tokenHash, donationId: 'don-123', createdAt: admin.firestore.FieldValue.serverTimestamp(), expiresAt, used: false });

  const res = await verifyQr(db, token, 'verifier_1');
  console.log('first verify result:', res);
  if(!res.success) process.exit(1);

  const res2 = await verifyQr(db, token, 'verifier_2');
  console.log('second verify result (should fail):', res2);
  if(res2.success) process.exit(1);

  console.log('qr-test complete');
}

run().catch(e=>{ console.error(e); process.exit(1); });
